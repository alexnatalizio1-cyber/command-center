/**
 * Blancco SDR market-research agent.
 *
 * Pipeline: pull North American enterprise / mid-market accounts from Apollo
 * (Blancco's connected workspace), score them on signals that map to a
 * data-sanitization buying motion, enrich the strongest with live web context
 * ("why now") via Gemini + Google Search grounding, then select the daily 5
 * with vertical diversity. Results are emailed to the SDR team and appended to
 * a Google Sheet for history.
 *
 * Honesty rule enforced throughout: when a signal or web context is absent we
 * say so explicitly rather than inventing a rationale.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// ---------------------------------------------------------------------------
// Ideal Customer Profile — North American enterprise end-user motion.
// End-users erasing their OWN assets: data centers, financial services,
// healthcare, government, large IT orgs. Compliance + asset-lifecycle driven.
// ---------------------------------------------------------------------------

export const ICP = {
  locations: ['United States', 'Canada'],
  // ~70% enterprise, ~30% mid-market — but ranking is signal-driven, not size.
  enterpriseEmployeeRanges: [
    '1001,5000',
    '5001,10000',
    '10001,50000',
    '50001,100000',
    '100001,500000',
  ],
  midMarketEmployeeRanges: ['201,500', '501,1000'],
  // Verticals with large device estates + regulatory pressure on data disposal.
  keywords: [
    'financial services',
    'banking',
    'insurance',
    'healthcare',
    'hospital',
    'pharmaceutical',
    'government',
    'telecommunications',
    'data center',
    'technology',
  ],
};

export type Tier = 'enterprise' | 'mid-market';

export interface ApolloAccount {
  id: string;
  name: string;
  domain?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  city?: string;
  state?: string;
  country?: string;
  revenuePrinted?: string;
  revenue?: number;
  sicCodes: string[];
  naicsCodes: string[];
  headcountGrowth6m?: number | null;
  headcountGrowth12m?: number | null;
  headcountGrowth24m?: number | null;
  hasIntentSignal: boolean;
  intentLevel?: string | null;
  intentPages: string[];
  numContacts?: number | null;
  lastActivityDate?: string | null;
  accountStageId?: string | null;
  parentAccountName?: string | null;
  tier: Tier;
}

export interface SignalComponent {
  label: string;
  points: number;
  detail: string;
}

export interface ScoredAccount extends ApolloAccount {
  fitScore: number;
  signals: SignalComponent[];
  crmStatus: string;
}

export interface WhyNow {
  whyNow: string;
  eventType: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sources: string[];
}

export interface Pick extends ScoredAccount {
  vertical: string;
  whyNow: WhyNow;
  suggestedContact: string;
  suggestedSolution: string;
}

// ---------------------------------------------------------------------------
// Apollo REST client.
//
// The connected Apollo MCP is only available to the interactive agent, never to
// this deployed route, so production calls the Apollo REST API directly with
// APOLLO_API_KEY. The request/response shape below was validated against the
// live workspace.
// ---------------------------------------------------------------------------

const APOLLO_SEARCH_URL =
  'https://api.apollo.io/api/v1/mixed_companies/search';

function num(v: unknown): number | null {
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
}

function mapAccount(raw: any, tier: Tier): ApolloAccount {
  const intent = raw?.intent_signal_account;
  const intentPages: string[] =
    intent?.website_visitor_metrics?.pages?.slice?.(0, 5) ?? [];
  return {
    id: String(raw?.id ?? raw?.organization_id ?? ''),
    name: String(raw?.name ?? 'Unknown'),
    domain: raw?.primary_domain ?? raw?.domain ?? undefined,
    websiteUrl: raw?.website_url ?? undefined,
    linkedinUrl: raw?.linkedin_url ?? undefined,
    city: raw?.city ?? raw?.organization_city ?? undefined,
    state: raw?.state ?? raw?.organization_state ?? undefined,
    country: raw?.country ?? raw?.organization_country ?? undefined,
    revenuePrinted: raw?.organization_revenue_printed ?? undefined,
    revenue: num(raw?.organization_revenue) ?? undefined,
    sicCodes: Array.isArray(raw?.sic_codes) ? raw.sic_codes.map(String) : [],
    naicsCodes: Array.isArray(raw?.naics_codes)
      ? raw.naics_codes.map(String)
      : [],
    headcountGrowth6m: num(raw?.organization_headcount_six_month_growth),
    headcountGrowth12m: num(raw?.organization_headcount_twelve_month_growth),
    headcountGrowth24m: num(
      raw?.organization_headcount_twenty_four_month_growth,
    ),
    hasIntentSignal: Boolean(raw?.has_intent_signal_account),
    intentLevel: intent?.overall_intent ?? null,
    intentPages,
    numContacts: num(raw?.num_contacts),
    lastActivityDate: raw?.last_activity_date ?? null,
    accountStageId: raw?.account_stage_id ?? null,
    parentAccountName: raw?.parent_account?.name ?? null,
    tier,
  };
}

async function apolloSearch(
  apiKey: string,
  employeeRanges: string[],
  tier: Tier,
  page: number,
  perPage: number,
): Promise<{ accounts: ApolloAccount[]; totalPages: number }> {
  const res = await fetch(APOLLO_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      organization_locations: ICP.locations,
      organization_num_employees_ranges: employeeRanges,
      q_organization_keyword_tags: ICP.keywords,
      page,
      per_page: perPage,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Apollo search failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const data: any = await res.json();
  const rows: any[] =
    (Array.isArray(data?.accounts) && data.accounts.length
      ? data.accounts
      : data?.organizations) ?? [];
  const totalPages = num(data?.pagination?.total_pages) ?? 1;
  return { accounts: rows.map((r) => mapAccount(r, tier)), totalPages };
}

// ---------------------------------------------------------------------------
// Signal scoring. Every component is transparent so the email can explain the
// "why". Weights reflect how directly each signal implies a data-sanitization
// need (decommissioning / asset reclamation / compliance).
// ---------------------------------------------------------------------------

const SIC_VERTICAL: { test: (sic: string, naics: string) => boolean; name: string }[] =
  [
    {
      name: 'Financial Services',
      test: (s, n) => s.startsWith('60') || s.startsWith('61') || s.startsWith('62') || n.startsWith('52'),
    },
    {
      name: 'Insurance',
      test: (s, n) => s.startsWith('63') || s.startsWith('64') || n.startsWith('524'),
    },
    {
      name: 'Healthcare & Pharma',
      test: (s, n) =>
        s.startsWith('80') || s.startsWith('283') || n.startsWith('62') || n.startsWith('3254'),
    },
    {
      name: 'Government & Public Sector',
      test: (s, n) => s.startsWith('91') || s.startsWith('92') || s.startsWith('93') || n.startsWith('92'),
    },
    {
      name: 'Telecom',
      test: (s, n) => s.startsWith('48') || n.startsWith('517'),
    },
    {
      name: 'Technology & Data Center',
      test: (s, n) => s.startsWith('737') || s.startsWith('357') || n.startsWith('5415') || n.startsWith('5182'),
    },
  ];

export function classifyVertical(a: ApolloAccount): string {
  const sic = a.sicCodes[0] ?? '';
  const naics = a.naicsCodes[0] ?? '';
  for (const v of SIC_VERTICAL) {
    if (v.test(sic, naics)) return v.name;
  }
  return 'Other / Diversified';
}

function mostNegative(...vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter(
    (v): v is number => typeof v === 'number' && !Number.isNaN(v),
  );
  if (!nums.length) return null;
  return Math.min(...nums);
}

export function scoreAccount(a: ApolloAccount): ScoredAccount {
  const signals: SignalComponent[] = [];

  // Workforce contraction -> device reclamation, site/data-center consolidation.
  const decline = mostNegative(
    a.headcountGrowth12m,
    a.headcountGrowth24m,
    a.headcountGrowth6m,
  );
  if (decline !== null && decline < -0.03) {
    const pct = Math.round(decline * 100);
    const pts = Math.min(35, Math.round(Math.abs(decline) * 100 * 1.2));
    signals.push({
      label: 'Workforce contraction',
      points: pts,
      detail: `Headcount down ${pct}% — returned devices, decommissioning and asset reclamation typically follow, all requiring certified erasure.`,
    });
  }

  // Active intent on blancco.com — the single strongest buying signal.
  if (a.hasIntentSignal) {
    const lvl = (a.intentLevel ?? 'low').toLowerCase();
    const pts = lvl === 'high' ? 40 : lvl === 'medium' ? 28 : 16;
    const pageHint = a.intentPages.length
      ? ` Recently viewed: ${a.intentPages.slice(0, 2).join(', ')}.`
      : '';
    signals.push({
      label: `Blancco.com intent (${lvl})`,
      points: pts,
      detail: `Tracked website intent against Blancco content.${pageHint}`,
    });
  }

  // Whitespace: low contact coverage / no recent touch = open SDR opportunity.
  const contacts = a.numContacts ?? 0;
  const stale =
    !a.lastActivityDate ||
    Date.now() - new Date(a.lastActivityDate).getTime() >
      120 * 24 * 60 * 60 * 1000;
  if (contacts < 5 && stale) {
    signals.push({
      label: 'Open whitespace',
      points: 12,
      detail: `Only ${contacts} mapped contacts and no recent activity — low prior coverage, room for net-new outreach.`,
    });
  }

  // Vertical fit — regulated, data-heavy industries.
  const vertical = classifyVertical(a);
  if (vertical !== 'Other / Diversified') {
    signals.push({
      label: `Regulated vertical: ${vertical}`,
      points: 10,
      detail: `${vertical} carries strict data-disposal compliance obligations (GDPR/CCPA, HIPAA, GLBA, etc.).`,
    });
  }

  // Scale of asset estate — secondary to signals per the brief.
  if (a.tier === 'enterprise') {
    signals.push({
      label: 'Large asset estate',
      points: 6,
      detail: 'Enterprise scale implies a large, continuously refreshed device/drive estate.',
    });
  }

  // CRM status — annotate, do not exclude (per brief: no exclusions).
  let crmStatus = 'Net-new (not in CRM)';
  if (a.parentAccountName && /blancco/i.test(a.parentAccountName)) {
    crmStatus = 'Existing Blancco account';
  } else if ((a.numContacts ?? 0) > 0 || a.lastActivityDate) {
    crmStatus = 'Known account (some CRM history)';
  }

  const fitScore = Math.min(
    100,
    signals.reduce((s, c) => s + c.points, 0),
  );

  return { ...a, signals, fitScore, crmStatus };
}

// ---------------------------------------------------------------------------
// "Why now" — live web context via Gemini + Google Search grounding.
// If grounding is unavailable or finds nothing credible, we degrade honestly.
// ---------------------------------------------------------------------------

const EVENT_FOCUS =
  'layoffs or workforce reductions; mergers, acquisitions or divestitures; ' +
  'data center closure, consolidation or cloud migration; hardware/asset ' +
  'refresh programs; new CISO/CIO/Head of IT Asset Management; data breach or ' +
  'new data-privacy regulatory exposure; ESG / circular-economy or sustainable ' +
  'IT disposal commitments';

export async function enrichWhyNow(
  a: ScoredAccount,
): Promise<WhyNow> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      whyNow:
        'Live web context unavailable (GEMINI_API_KEY not set). Rationale is based on Apollo structured signals only.',
      eventType: 'structured-only',
      confidence: 'none',
      sources: [],
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      // Google Search grounding for fresh, citable context.
      tools: [{ googleSearch: {} } as any],
    });

    const prompt = `You are a B2B sales researcher for Blancco, the market leader in certified software data erasure / data sanitization (wipes drives & devices without destroying hardware; audit-ready compliance).

Research the company "${a.name}"${a.domain ? ` (${a.domain})` : ''} located in ${[a.city, a.state, a.country].filter(Boolean).join(', ') || 'North America'}.

Find PUBLIC events from roughly the last 90 days that create a data-sanitization need: ${EVENT_FOCUS}.

Rules:
- Only report events you can support with a credible, recent source.
- If you cannot find a credible recent event, set confidence to "none" and say so plainly. DO NOT speculate or fabricate.
- Be specific and concise (max 2 sentences for whyNow).

Respond ONLY with strict JSON, no markdown:
{"whyNow":"...","eventType":"layoffs|m&a|datacenter|refresh|leadership|breach|regulatory|esg|none","confidence":"high|medium|low|none","sources":["url", "..."]}`;

    const result = await model.generateContent(prompt);
    const text = result.response
      .text()
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(text) as Partial<WhyNow>;
    const grounding =
      (result.response as any)?.candidates?.[0]?.groundingMetadata
        ?.groundingChunks ?? [];
    const groundedUrls: string[] = grounding
      .map((g: any) => g?.web?.uri)
      .filter((u: unknown): u is string => typeof u === 'string');

    const sources = Array.from(
      new Set([...(parsed.sources ?? []), ...groundedUrls]),
    ).slice(0, 4);

    const confidence = (
      ['high', 'medium', 'low', 'none'] as const
    ).includes(parsed.confidence as any)
      ? (parsed.confidence as WhyNow['confidence'])
      : 'none';

    return {
      whyNow:
        parsed.whyNow?.trim() ||
        'No credible recent public event found; rationale rests on Apollo structured signals.',
      eventType: parsed.eventType || 'none',
      confidence,
      sources,
    };
  } catch (err) {
    return {
      whyNow:
        'Live web enrichment failed for this account; rationale rests on Apollo structured signals only (no speculation added).',
      eventType: 'structured-only',
      confidence: 'none',
      sources: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Contact / solution guidance.
// ---------------------------------------------------------------------------

function guidance(p: ScoredAccount): {
  suggestedContact: string;
  suggestedSolution: string;
} {
  const vertical = classifyVertical(p);
  const contact =
    'CISO / CIO, Head of IT Asset Management, or Data Protection / Privacy Officer';
  let solution =
    'Blancco Drive Eraser + Management Console for certified, audit-ready erasure across the IT asset estate.';
  if (/Data Center/.test(vertical)) {
    solution =
      'Blancco Data Center solution — automated erasure of drives, LUNs, servers and VMs during decommissioning.';
  } else if (/Financial|Insurance/.test(vertical)) {
    solution =
      'Blancco Drive/LUN Eraser with compliance reporting for GLBA / PCI / SEC data-disposal requirements.';
  } else if (/Healthcare/.test(vertical)) {
    solution =
      'Blancco erasure with HIPAA-aligned tamper-proof certificates for end-of-life media.';
  }
  return { suggestedContact: contact, suggestedSolution: solution };
}

// ---------------------------------------------------------------------------
// Orchestration.
// ---------------------------------------------------------------------------

export interface RunResult {
  date: string;
  picks: Pick[];
  candidatesEvaluated: number;
  notes: string[];
}

function dayRotation(totalPages: number): number {
  const cap = Math.max(1, Math.min(totalPages, 200));
  const dayIdx = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  return (dayIdx % cap) + 1;
}

export async function runResearch(
  recentlyPickedDomains: Set<string>,
): Promise<RunResult> {
  const notes: string[] = [];
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    throw new Error(
      'APOLLO_API_KEY is not set. The agent needs an Apollo API key to search accounts.',
    );
  }

  // Probe to learn page count, then rotate the page daily for fresh picks.
  const probe = await apolloSearch(
    apiKey,
    ICP.enterpriseEmployeeRanges,
    'enterprise',
    1,
    1,
  );
  const page = dayRotation(probe.totalPages);

  const [ent, mid] = await Promise.all([
    apolloSearch(apiKey, ICP.enterpriseEmployeeRanges, 'enterprise', page, 50),
    apolloSearch(apiKey, ICP.midMarketEmployeeRanges, 'mid-market', page, 25),
  ]);

  const pool = [...ent.accounts, ...mid.accounts].filter((a) => {
    const c = (a.country ?? '').toLowerCase();
    return c.includes('united states') || c.includes('canada') || c === 'us' || c === 'usa';
  });

  const deduped = pool.filter(
    (a) => !a.domain || !recentlyPickedDomains.has(a.domain.toLowerCase()),
  );
  notes.push(
    `${pool.length} North American candidates pulled (Apollo page ${page}); ${deduped.length} after removing accounts featured in the last 14 days.`,
  );

  const scored = deduped
    .map(scoreAccount)
    .filter((s) => s.signals.length > 0)
    .sort((a, b) => b.fitScore - a.fitScore);

  if (scored.length === 0) {
    notes.push(
      'No candidates cleared the signal threshold today. Reporting zero picks rather than padding the list with low-confidence accounts.',
    );
    return { date: today(), picks: [], candidatesEvaluated: pool.length, notes };
  }

  // Enrich the strongest ~10 with live web context.
  const shortlist = scored.slice(0, 10);
  const enriched: Pick[] = [];
  for (const s of shortlist) {
    const whyNow = await enrichWhyNow(s);
    const eventBoost =
      whyNow.confidence === 'high'
        ? 18
        : whyNow.confidence === 'medium'
          ? 10
          : whyNow.confidence === 'low'
            ? 4
            : 0;
    const g = guidance(s);
    enriched.push({
      ...s,
      fitScore: Math.min(100, s.fitScore + eventBoost),
      vertical: classifyVertical(s),
      whyNow,
      suggestedContact: g.suggestedContact,
      suggestedSolution: g.suggestedSolution,
    });
  }

  enriched.sort((a, b) => b.fitScore - a.fitScore);

  // Final 5 with vertical diversity (max 2 per vertical) and a soft size mix.
  const picks: Pick[] = [];
  const perVertical: Record<string, number> = {};
  for (const p of enriched) {
    if (picks.length >= 5) break;
    const v = p.vertical;
    if ((perVertical[v] ?? 0) >= 2) continue;
    perVertical[v] = (perVertical[v] ?? 0) + 1;
    picks.push(p);
  }
  // Backfill if diversity cap left us short.
  if (picks.length < 5) {
    for (const p of enriched) {
      if (picks.length >= 5) break;
      if (!picks.includes(p)) picks.push(p);
    }
  }

  if (picks.length < 5) {
    notes.push(
      `Only ${picks.length} companies met the signal bar today — listing those rather than speculating to reach five.`,
    );
  }

  const entCount = picks.filter((p) => p.tier === 'enterprise').length;
  notes.push(
    `Size mix: ${entCount} enterprise / ${picks.length - entCount} mid-market (target ~70/30; ranking is signal-driven, so it can vary).`,
  );

  return {
    date: today(),
    picks,
    candidatesEvaluated: pool.length,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Email rendering.
// ---------------------------------------------------------------------------

function today(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const CONF_COLOR: Record<WhyNow['confidence'], string> = {
  high: '#15803d',
  medium: '#b45309',
  low: '#6b7280',
  none: '#9ca3af',
};

export function renderEmailHtml(r: RunResult): string {
  const cards = r.picks
    .map((p, i) => {
      const signalChips = p.signals
        .map(
          (s) =>
            `<span style="display:inline-block;background:#eef2ff;color:#3730a3;font-size:12px;padding:3px 9px;border-radius:999px;margin:2px 4px 2px 0;">${escapeHtml(
              s.label,
            )} +${s.points}</span>`,
        )
        .join('');
      const sources = p.whyNow.sources.length
        ? `<div style="font-size:12px;color:#6b7280;margin-top:6px;">Sources: ${p.whyNow.sources
            .map(
              (u) =>
                `<a href="${escapeAttr(u)}" style="color:#4f46e5;">${escapeHtml(
                  shortUrl(u),
                )}</a>`,
            )
            .join(' &middot; ')}</div>`
        : '';
      return `
      <tr><td style="padding:0 0 18px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:12px;border-left:4px solid #4f46e5;">
          <tr><td style="padding:16px 18px;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;">#${
              i + 1
            } &middot; ${escapeHtml(p.vertical)} &middot; ${escapeHtml(
        p.tier,
      )} &middot; ${escapeHtml(p.crmStatus)}</div>
            <div style="font-size:18px;font-weight:700;color:#111827;margin:3px 0;">
              ${
                p.websiteUrl
                  ? `<a href="${escapeAttr(
                      p.websiteUrl,
                    )}" style="color:#111827;text-decoration:none;">${escapeHtml(
                      p.name,
                    )}</a>`
                  : escapeHtml(p.name)
              }
              <span style="font-size:13px;font-weight:600;color:#4f46e5;float:right;">Fit ${
                p.fitScore
              }/100</span>
            </div>
            <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">
              ${escapeHtml(
                [p.city, p.state, p.country].filter(Boolean).join(', '),
              )}${p.revenuePrinted ? ` &middot; Revenue ${escapeHtml(p.revenuePrinted)}` : ''}${
        p.domain ? ` &middot; ${escapeHtml(p.domain)}` : ''
      }
            </div>
            <div style="margin:8px 0;">${signalChips}</div>
            <div style="font-size:14px;color:#111827;margin-top:8px;">
              <strong>Why now</strong>
              <span style="font-size:11px;color:#fff;background:${
                CONF_COLOR[p.whyNow.confidence]
              };padding:2px 7px;border-radius:999px;margin-left:6px;">${p.whyNow.confidence.toUpperCase()} confidence</span>
              <div style="margin-top:5px;color:#374151;">${escapeHtml(
                p.whyNow.whyNow,
              )}</div>
              ${sources}
            </div>
            <div style="font-size:13px;color:#374151;margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:10px;">
              <strong>Suggested play:</strong> ${escapeHtml(
                p.suggestedSolution,
              )}<br/>
              <strong>Target contact:</strong> ${escapeHtml(
                p.suggestedContact,
              )}
            </div>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join('');

  const noPicks = `<tr><td style="padding:16px;background:#fef3c7;border-radius:12px;color:#92400e;font-size:14px;">
    No accounts cleared today's signal threshold. Per the agent's honesty rule, no companies are listed rather than padding with low-confidence guesses. The methodology notes below explain the search performed.</td></tr>`;

  return `<!DOCTYPE html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
        <tr><td style="padding:0 16px 16px;">
          <div style="font-size:22px;font-weight:800;color:#111827;">Blancco SDR — Daily Target Accounts</div>
          <div style="font-size:14px;color:#6b7280;">${escapeHtml(
            r.date,
          )} &middot; North America &middot; Enterprise end-user motion</div>
        </td></tr>
        <tr><td style="padding:0 16px;"><table width="100%" cellpadding="0" cellspacing="0">
          ${r.picks.length ? cards : noPicks}
        </table></td></tr>
        <tr><td style="padding:14px 16px;">
          <div style="font-size:12px;color:#6b7280;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px;">
            <strong style="color:#374151;">How these were chosen</strong><br/>
            ${r.notes.map((n) => `&bull; ${escapeHtml(n)}`).join('<br/>')}
            <br/><br/>
            Signals are pulled from Blancco's Apollo workspace (headcount trend,
            blancco.com intent, CRM coverage, vertical) and enriched with live
            web search for recent events. Confidence reflects source quality;
            "none" means no credible recent web event was found and the
            rationale rests on structured signals only. ${r.candidatesEvaluated} accounts evaluated.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
function shortUrl(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return u.slice(0, 40);
  }
}

// ---------------------------------------------------------------------------
// Delivery + history.
// ---------------------------------------------------------------------------

export async function sendEmail(
  auth: OAuth2Client,
  recipients: string[],
  subject: string,
  html: string,
): Promise<string> {
  const gmail = google.gmail({ version: 'v1', auth });
  const raw = [
    `To: ${recipients.join(', ')}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    html,
  ].join('\r\n');
  const encoded = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
  return res.data.id ?? '';
}

const SHEET_NAME = 'Blancco Market Research Log';
const HEADER = [
  'Date',
  'Rank',
  'Company',
  'Domain',
  'Location',
  'Tier',
  'Vertical',
  'Revenue',
  'Fit Score',
  'CRM Status',
  'Signals',
  'Why Now',
  'Event Type',
  'Confidence',
  'Suggested Contact',
  'Sources',
];

async function findOrCreateSheet(auth: OAuth2Client): Promise<string> {
  if (process.env.MARKET_RESEARCH_SHEET_ID) {
    return process.env.MARKET_RESEARCH_SHEET_ID;
  }
  const drive = google.drive({ version: 'v3', auth });
  const found = await drive.files.list({
    q: `name='${SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });
  if (found.data.files && found.data.files.length > 0) {
    return found.data.files[0].id!;
  }
  const sheets = google.sheets({ version: 'v4', auth });
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: SHEET_NAME },
      sheets: [{ properties: { title: 'Log' } }],
    },
    fields: 'spreadsheetId',
  });
  const id = created.data.spreadsheetId!;
  await sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: 'Log!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [HEADER] },
  });
  return id;
}

export async function logToSheet(
  auth: OAuth2Client,
  r: RunResult,
): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth });
  const id = await findOrCreateSheet(auth);
  if (!r.picks.length) return id;
  const rows = r.picks.map((p, i) => [
    r.date,
    String(i + 1),
    p.name,
    p.domain ?? '',
    [p.city, p.state, p.country].filter(Boolean).join(', '),
    p.tier,
    p.vertical,
    p.revenuePrinted ?? '',
    String(p.fitScore),
    p.crmStatus,
    p.signals.map((s) => `${s.label} (+${s.points})`).join('; '),
    p.whyNow.whyNow,
    p.whyNow.eventType,
    p.whyNow.confidence,
    p.suggestedContact,
    p.whyNow.sources.join(' | '),
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: id,
    range: 'Log!A1',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
  return id;
}

export async function readHistory(
  auth: OAuth2Client,
  limit = 30,
): Promise<{ sheetId: string; rows: string[][] }> {
  const sheets = google.sheets({ version: 'v4', auth });
  const id = await findOrCreateSheet(auth);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: 'Log!A2:P',
  });
  const all = res.data.values ?? [];
  return { sheetId: id, rows: all.slice(-limit).reverse() };
}

export function recentDomainsFromHistory(rows: string[][]): Set<string> {
  // Column index 3 = Domain. Treat the last ~14 days of rows as recent.
  const set = new Set<string>();
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const d = (row[3] ?? '').trim().toLowerCase();
    const dateStr = row[0] ?? '';
    const t = Date.parse(dateStr);
    if (d && (Number.isNaN(t) || t >= cutoff)) set.add(d);
  }
  return set;
}
