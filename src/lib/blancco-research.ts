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
  /** Longer, source-grounded elaboration shown behind "show more". */
  detail?: string;
  eventType: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  sources: string[];
}

export interface DecisionMaker {
  name: string;
  title: string;
  url?: string;
}

export interface Pick extends ScoredAccount {
  vertical: string;
  whyNow: WhyNow;
  suggestedContact: string;
  suggestedSolution: string;
  /** Approximate total headcount, when known. */
  employees?: string;
  /** Named IT/security decision makers found via public web search. */
  contacts: DecisionMaker[];
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

/**
 * Web research via Tavily (free tier) + free-tier Gemini for synthesis.
 *
 * Gemini's Google Search grounding is a paid-tier-only feature, so instead we
 * fetch fresh, real web results from Tavily and have free-tier Gemini extract
 * structured JSON strictly from those results. This keeps the honesty rule
 * intact (the model only sees real fetched sources) at zero cost.
 */
export interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(
  query: string,
  opts: { days?: number; max?: number; topic?: 'news' | 'general' } = {},
): Promise<{ results: TavilyResult[]; error?: string }> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return { results: [], error: 'TAVILY_API_KEY not set' };
  const topic = opts.topic ?? 'news';
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        topic,
        search_depth: 'advanced',
        // `days` only applies to the news topic; general search ignores it.
        ...(topic === 'news' ? { days: opts.days ?? 90 } : {}),
        max_results: opts.max ?? 8,
        include_answer: false,
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return {
        results: [],
        error: `Tavily HTTP ${res.status}: ${t.slice(0, 200)}`,
      };
    }
    const data: any = await res.json();
    const results: TavilyResult[] = Array.isArray(data?.results)
      ? data.results.map((r: any) => ({
          title: String(r?.title ?? ''),
          url: String(r?.url ?? ''),
          content: String(r?.content ?? '').slice(0, 600),
        }))
      : [];
    return { results };
  } catch (e) {
    return {
      results: [],
      error: e instanceof Error ? e.message : 'Tavily request failed',
    };
  }
}

// Free-tier Gemini models, in fallback order. Each model has its OWN free
// quota bucket, so a 429 ("quota exceeded") on one is very often served fine
// by the next — this is the zero-cost way to survive free-tier rate limits
// without enabling paid billing. The -lite variants carry the largest free
// daily allowances and are ideal fallbacks for this JSON-extraction task.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash-lite',
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJson(raw: string): any | undefined {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.search(/[\[{]/);
    const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return undefined;
  }
}

/**
 * Free-tier Gemini call (no grounding) that returns parsed JSON.
 *
 * Resilient to free-tier rate limits: it cycles through several free models
 * (each with an independent quota bucket) and, if every model is throttled,
 * does one slow second pass to wait out a per-minute window. This keeps the
 * agent at $0 without enabling Gemini paid billing.
 */
async function geminiJSON(
  apiKey: string,
  prompt: string,
): Promise<{ json: any; error?: string; model?: string }> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });
  let lastError = 'Gemini request failed';

  for (let pass = 0; pass < 2; pass++) {
    // Second pass waits out a per-minute throttle window before retrying.
    if (pass === 1) await sleep(8000);
    for (const model of GEMINI_MODELS) {
      let data: any;
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          },
        );
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          lastError = `Gemini HTTP ${res.status} on ${model}: ${t.slice(0, 160)}`;
          // 429 (quota) / 503 (overload): try the next model, which has a
          // separate quota bucket. Other errors: also fall through.
          continue;
        }
        data = await res.json();
      } catch (e) {
        lastError = e instanceof Error ? e.message : 'Gemini request failed';
        continue;
      }
      const raw = (data?.candidates?.[0]?.content?.parts ?? [])
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .join('')
        .trim();
      const parsed = extractJson(raw);
      if (parsed !== undefined) return { json: parsed, model };
      lastError = `Unparseable model output from ${model}${
        raw ? '' : ' (empty response)'
      }`;
    }
  }
  return { json: null, error: lastError };
}

function sourcesBlock(results: TavilyResult[]): string {
  return results
    .map(
      (r, i) =>
        `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content}`,
    )
    .join('\n\n');
}

/**
 * Best-effort named IT/security decision makers via public web search
 * (LinkedIn, leadership pages, press). Honesty rule: the model may use ONLY
 * the fetched results and must return nobody rather than invent a name. If
 * nothing credible is found the caller falls back to the generic role.
 */
export async function findDecisionMakers(
  name: string,
  domain?: string,
): Promise<DecisionMaker[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  const q = `${name} (CIO OR CISO OR "Chief Information Officer" OR "Chief Information Security Officer" OR "VP Information Technology" OR "Head of IT Asset Management" OR "IT Director" OR "Head of Infrastructure") leadership LinkedIn`;
  const { results } = await tavilySearch(q, { topic: 'general', max: 8 });
  if (results.length === 0) return [];

  const prompt = `You help a Blancco SDR find the right person to contact at a target company about certified data erasure and end-of-life IT asset decommissioning.

Company: "${name}"${domain ? ` (${domain})` : ''}.

Below are real web search results (LinkedIn profiles, leadership pages, press). From ONLY these results, list up to 3 people who are CURRENT IT or security DECISION MAKERS at THIS specific company and best to approach about data sanitization. Priority order: CIO; CISO; VP/Head of IT; Head of IT Asset Management / ITAD; IT Infrastructure Director; Data Protection / Privacy Officer.

SEARCH RESULTS:
${sourcesBlock(results)}

Rules:
- Use ONLY the results above. If a real named person who CURRENTLY works at "${name}" is not present in the results, return an empty list. DO NOT guess, infer, or invent names or titles.
- "title" must be the person's actual stated title from the results.
- "url" must be a URL copied verbatim from the results above (their LinkedIn or profile/source page).
- Exclude people who work at a different company, vendors, or recruiters.

Return JSON: {"people":[{"name":"","title":"","url":""}]}`;

  const { json } = await geminiJSON(apiKey, prompt);
  if (!json || !Array.isArray(json.people)) return [];
  const allowed = new Set(results.map((r) => r.url));
  const out: DecisionMaker[] = [];
  for (const p of json.people) {
    const nm = typeof p?.name === 'string' ? p.name.trim() : '';
    const title = typeof p?.title === 'string' ? p.title.trim() : '';
    if (!nm || !title) continue;
    const url =
      typeof p?.url === 'string' && allowed.has(p.url) ? p.url : undefined;
    out.push({ name: nm, title, url });
    if (out.length >= 3) break;
  }
  return out;
}

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

  const query = `${a.name} ${a.city ?? ''} layoffs OR acquisition OR merger OR divestiture OR "data center" OR "cloud migration" OR data breach OR CISO OR CIO OR restructuring`;
  const { results, error: searchError } = await tavilySearch(query, {
    days: 120,
    max: 6,
  });

  if (searchError || results.length === 0) {
    return {
      whyNow:
        'No recent public coverage found for this account; rationale rests on Apollo structured signals only (no speculation added).',
      eventType: 'structured-only',
      confidence: 'none',
      sources: [],
    };
  }

  const prompt = `You are a B2B sales researcher for Blancco, the market leader in certified software data erasure / data sanitization (wipes drives & devices without destroying hardware; audit-ready compliance).

Company: "${a.name}"${a.domain ? ` (${a.domain})` : ''}, ${[a.city, a.state, a.country].filter(Boolean).join(', ') || 'North America'}.

Below are real, recent web search results. Using ONLY these results, decide whether there is a credible event in roughly the last 90-120 days that creates a data-sanitization need (${EVENT_FOCUS}).

SEARCH RESULTS:
${sourcesBlock(results)}

Rules:
- Use ONLY the results above. If they do not contain a credible, relevant, recent event for THIS company, set confidence to "none" and say so plainly. DO NOT speculate or use outside knowledge.
- "sources" must be URLs taken verbatim from the results above.
- whyNow: max 2 sentences, specific.
- whyNowDetail: 3-6 sentences expanding on the specifics strictly from the results (dates, figures, what happened); empty string if no extra detail exists.

Return JSON: {"whyNow":"...","whyNowDetail":"...","eventType":"layoffs|m&a|datacenter|refresh|leadership|breach|regulatory|esg|none","confidence":"high|medium|low|none","sources":["url"]}`;

  const { json: parsed } = await geminiJSON(apiKey, prompt);

  if (!parsed) {
    return {
      whyNow:
        'Live web enrichment failed for this account; rationale rests on Apollo structured signals only (no speculation added).',
      eventType: 'structured-only',
      confidence: 'none',
      sources: [],
    };
  }

  const allowed = new Set(results.map((r) => r.url));
  const sources = (Array.isArray(parsed.sources) ? parsed.sources : [])
    .filter((u: unknown): u is string => typeof u === 'string' && allowed.has(u))
    .slice(0, 4);

  const confidence = (['high', 'medium', 'low', 'none'] as const).includes(
    parsed.confidence,
  )
    ? (parsed.confidence as WhyNow['confidence'])
    : 'none';

  return {
    whyNow:
      typeof parsed.whyNow === 'string' && parsed.whyNow.trim()
        ? parsed.whyNow.trim()
        : 'No credible recent public event found; rationale rests on Apollo structured signals.',
    detail:
      typeof parsed.whyNowDetail === 'string' && parsed.whyNowDetail.trim()
        ? parsed.whyNowDetail.trim()
        : undefined,
    eventType: parsed.eventType || 'none',
    confidence: sources.length === 0 ? 'none' : confidence,
    sources,
  };
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
  recentlyPickedKeys: Set<string>,
): Promise<RunResult> {
  const notes: string[] = [];
  const apiKey = process.env.APOLLO_API_KEY;

  // Apollo is the richer source but admin-gated. When no Apollo key is
  // present, fall back to web-only research (Gemini + Google Search), which
  // needs only a Gemini key. Output honestly flags the reduced signal depth.
  if (!apiKey) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'No data source configured. Set APOLLO_API_KEY for the full Apollo-powered agent, or GEMINI_API_KEY for web-only research mode.',
      );
    }
    return runWebResearch(recentlyPickedKeys);
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
    (a) =>
      (!a.domain || !recentlyPickedKeys.has(a.domain.toLowerCase())) &&
      !recentlyPickedKeys.has(a.name.trim().toLowerCase()),
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
      contacts: [],
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

  await Promise.all(
    picks.map(async (p) => {
      p.contacts = await findDecisionMakers(p.name, p.domain);
    }),
  );

  return {
    date: today(),
    picks,
    candidatesEvaluated: pool.length,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Web-only research mode (no Apollo). Uses Gemini + Google Search grounding to
// both DISCOVER candidate companies and explain the "why now". Lower signal
// depth than the Apollo path — no blancco.com intent, no CRM status, no
// headcount data — and the email/Sheet say so explicitly.
// ---------------------------------------------------------------------------

const KNOWN_VERTICALS = [
  'Financial Services',
  'Insurance',
  'Healthcare & Pharma',
  'Government & Public Sector',
  'Telecom',
  'Technology & Data Center',
  'Other / Diversified',
];

interface WebCompany {
  name: string;
  website?: string;
  hqCity?: string;
  hqState?: string;
  hqCountry?: string;
  sizeTier?: string;
  approxEmployees?: string;
  vertical?: string;
  eventType?: string;
  whyNow?: string;
  whyNowDetail?: string;
  confidence?: string;
  sources?: string[];
}

function hostFromUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname
      .replace(/^www\./, '')
      .toLowerCase();
  } catch {
    return undefined;
  }
}

function solutionForVertical(vertical: string): {
  suggestedContact: string;
  suggestedSolution: string;
} {
  const contact =
    'CISO / CIO, Head of IT Asset Management, or Data Protection / Privacy Officer';
  let suggestedSolution =
    'Blancco Drive Eraser + Management Console for certified, audit-ready erasure across the IT asset estate.';
  if (/Data Center/.test(vertical)) {
    suggestedSolution =
      'Blancco Data Center solution — automated erasure of drives, LUNs, servers and VMs during decommissioning.';
  } else if (/Financial|Insurance/.test(vertical)) {
    suggestedSolution =
      'Blancco Drive/LUN Eraser with compliance reporting for GLBA / PCI / SEC data-disposal requirements.';
  } else if (/Healthcare/.test(vertical)) {
    suggestedSolution =
      'Blancco erasure with HIPAA-aligned tamper-proof certificates for end-of-life media.';
  }
  return { suggestedContact: contact, suggestedSolution };
}

function buildWebPick(c: WebCompany): Pick {
  const tier: Tier =
    (c.sizeTier ?? '').toLowerCase().includes('mid') ? 'mid-market' : 'enterprise';
  const vertical = KNOWN_VERTICALS.includes(c.vertical ?? '')
    ? (c.vertical as string)
    : 'Other / Diversified';
  const event = (c.eventType ?? 'none').toLowerCase();
  const confidence: WhyNow['confidence'] = (
    ['high', 'medium', 'low', 'none'] as const
  ).includes(c.confidence as any)
    ? (c.confidence as WhyNow['confidence'])
    : 'low';

  const eventPoints = /layoff|datacenter|data center|m&a|acquisition|merger|refresh|divest/.test(
    event,
  )
    ? 35
    : /leadership|breach|regulat/.test(event)
      ? 28
      : /esg|sustain|circular/.test(event)
        ? 18
        : 12;
  const confPoints =
    confidence === 'high' ? 30 : confidence === 'medium' ? 18 : 8;
  const verticalPoints = vertical !== 'Other / Diversified' ? 10 : 0;
  const tierPoints = tier === 'enterprise' ? 6 : 0;

  const signals: SignalComponent[] = [
    {
      label: `Public event: ${c.eventType ?? 'unspecified'}`,
      points: eventPoints,
      detail:
        c.whyNow?.trim() ||
        'Event reported in public sources (see sources).',
    },
    {
      label: `Web confidence: ${confidence}`,
      points: confPoints,
      detail:
        'Strength of the public sourcing behind the "why now" (web research only — no Apollo/CRM corroboration).',
    },
  ];
  if (verticalPoints) {
    signals.push({
      label: `Regulated vertical: ${vertical}`,
      points: verticalPoints,
      detail: `${vertical} carries strict data-disposal compliance obligations.`,
    });
  }
  if (tierPoints) {
    signals.push({
      label: 'Large asset estate',
      points: tierPoints,
      detail: 'Enterprise scale implies a large, refreshed device/drive estate.',
    });
  }

  const fitScore = Math.min(
    100,
    eventPoints + confPoints + verticalPoints + tierPoints,
  );
  const g = solutionForVertical(vertical);
  const website = c.website
    ? c.website.startsWith('http')
      ? c.website
      : `https://${c.website}`
    : undefined;

  return {
    id: c.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: c.name.trim(),
    domain: hostFromUrl(c.website),
    websiteUrl: website,
    linkedinUrl: undefined,
    city: c.hqCity,
    state: c.hqState,
    country: c.hqCountry,
    revenuePrinted: undefined,
    revenue: undefined,
    sicCodes: [],
    naicsCodes: [],
    headcountGrowth6m: null,
    headcountGrowth12m: null,
    headcountGrowth24m: null,
    hasIntentSignal: false,
    intentLevel: null,
    intentPages: [],
    numContacts: null,
    lastActivityDate: null,
    accountStageId: null,
    parentAccountName: null,
    tier,
    fitScore,
    signals,
    crmStatus: 'Web research — no Apollo/CRM data',
    vertical,
    whyNow: {
      whyNow:
        c.whyNow?.trim() ||
        'No specific event text returned; see sources for context.',
      detail: c.whyNowDetail?.trim() || undefined,
      eventType: c.eventType || 'none',
      confidence,
      sources: Array.isArray(c.sources) ? c.sources.slice(0, 4) : [],
    },
    suggestedContact: g.suggestedContact,
    suggestedSolution: g.suggestedSolution,
    employees: c.approxEmployees?.trim() || undefined,
    contacts: [],
  };
}

export async function runWebResearch(
  recentlyPickedKeys: Set<string>,
): Promise<RunResult> {
  const notes: string[] = [
    'Web-only research mode (no Apollo API key). Candidates and "why now" come from live web search; blancco.com intent, headcount trend and CRM status are unavailable, so scoring is shallower than the Apollo-powered mode.',
  ];
  const apiKey = process.env.GEMINI_API_KEY as string;
  const avoid = Array.from(recentlyPickedKeys).slice(0, 30);

  // Fresh, real web results from Tavily across the event categories.
  const queries = [
    'enterprise data center closure OR decommissioning OR consolidation United States Canada',
    'company layoffs financial services OR insurance OR banking United States',
    'company merger OR acquisition OR divestiture United States enterprise',
    'data breach United States enterprise healthcare OR financial services',
    'new CISO OR CIO appointment United States enterprise company',
  ];
  const searches = await Promise.all(
    queries.map((q) => tavilySearch(q, { days: 90, max: 6 })),
  );
  const seenUrl = new Set<string>();
  const dedupedResults: TavilyResult[] = [];
  for (const s of searches) {
    for (const r of s.results) {
      if (r.url && !seenUrl.has(r.url)) {
        seenUrl.add(r.url);
        dedupedResults.push(r);
      }
    }
  }
  // Cap the corpus fed to Gemini: a smaller prompt stays well under the
  // free-tier per-minute token limit (the Weekly Digest prompt is tiny and
  // never throttles on the same key — the size difference is what 429s here).
  const results = dedupedResults.slice(0, 24);
  const searchErr = searches.find((s) => s.error)?.error;

  if (results.length === 0) {
    notes.push(
      `Web search returned no results today (${searchErr || 'empty'}); reporting zero picks rather than guessing. It will retry on the next run.`,
    );
    return { date: today(), picks: [], candidatesEvaluated: 0, notes };
  }

  const prompt = `You are a B2B sales-research analyst for Blancco, the global leader in certified software data erasure / data sanitization (permanently wipes drives and devices WITHOUT destroying hardware; audit-ready compliance for GDPR, CCPA, HIPAA, GLBA, etc.). Blancco's North American enterprise SDR team sells to organizations that erase their OWN end-of-life IT assets.

Below are real, recent web search results. From ONLY these results, identify up to 10 DISTINCT companies HEADQUARTERED in the United States or Canada that have a credible, recent event creating a data-sanitization need (layoffs/workforce reductions; M&A/divestiture; data-center closure/consolidation/cloud migration; hardware/asset refresh; new CISO/CIO/Head of IT Asset Management; data breach; new data-privacy regulatory exposure; ESG/circular-economy/sustainable IT-disposal commitment).

SEARCH RESULTS:
${sourcesBlock(results)}

Rules:
- Use ONLY the results above — do not add companies or events from outside knowledge.
- United States or Canada HQ only.
- Every company's "sources" must be URLs copied verbatim from the results above.
- Prefer large enterprise (1,000+ employees); some mid-market is fine. Aim ~70% enterprise.
- Do NOT include any of these recently-featured names: ${avoid.join(', ') || '(none)'}.
- If fewer than 10 qualify, return fewer. Do NOT fabricate.

- "whyNowDetail" must elaborate using ONLY specifics found in the results (dates, figures, what exactly happened, named locations/units) — no outside knowledge, no speculation. If the results contain no detail beyond the one-liner, return an empty string for it.

Return JSON: {"companies":[{"name":"","website":"","hqCity":"","hqState":"","hqCountry":"","sizeTier":"enterprise|mid-market","approxEmployees":"","vertical":"Financial Services|Insurance|Healthcare & Pharma|Government & Public Sector|Telecom|Technology & Data Center|Other / Diversified","eventType":"layoffs|m&a|datacenter|refresh|leadership|breach|regulatory|esg","whyNow":"1-2 specific sentences tying the event to a data-sanitization need","whyNowDetail":"3-6 sentences expanding on the specific situation strictly from the sources, and why it creates a data-sanitization need","confidence":"high|medium|low","sources":["url"]}]}`;

  const { json, error, model } = await geminiJSON(apiKey, prompt);
  let companies: WebCompany[] = [];
  if (json && Array.isArray(json.companies)) {
    notes.push(
      `Synthesis by Gemini model "${model}" over ${results.length} live web results.`,
    );
    const allowed = new Set(results.map((r) => r.url));
    companies = (json.companies as WebCompany[])
      .map((c) => ({
        ...c,
        sources: (Array.isArray(c.sources) ? c.sources : []).filter(
          (u) => typeof u === 'string' && allowed.has(u),
        ),
      }))
      .filter((c) => c.sources.length > 0);
  } else {
    notes.push(
      `Web research returned no usable data today (${error || 'no companies field'}); reporting zero picks rather than guessing. It will retry on the next run.`,
    );
    return { date: today(), picks: [], candidatesEvaluated: 0, notes };
  }

  const evaluated = companies.length;

  const naFiltered = companies.filter((c) => {
    const ct = (c.hqCountry ?? '').toLowerCase();
    return (
      ct.includes('united states') ||
      ct.includes('canada') ||
      ct === 'us' ||
      ct === 'usa' ||
      ct === 'u.s.' ||
      ct === 'u.s.a.'
    );
  });

  const deduped = naFiltered.filter((c) => {
    const nm = c.name?.trim().toLowerCase();
    const host = hostFromUrl(c.website);
    if (!nm) return false;
    if (recentlyPickedKeys.has(nm)) return false;
    if (host && recentlyPickedKeys.has(host)) return false;
    return true;
  });

  const built = deduped
    .map(buildWebPick)
    .filter((p) => p.whyNow.confidence !== 'none')
    .sort((a, b) => b.fitScore - a.fitScore);

  notes.push(
    `${evaluated} companies returned by web research; ${built.length} usable after North-America, dedupe and credible-source filtering.`,
  );

  if (built.length === 0) {
    notes.push(
      'No companies cleared the credible-signal bar today. Reporting zero rather than padding with speculation.',
    );
    return { date: today(), picks: [], candidatesEvaluated: evaluated, notes };
  }

  // Final 5 with vertical diversity (max 2 per vertical) and a soft size mix.
  const picks: Pick[] = [];
  const perVertical: Record<string, number> = {};
  for (const p of built) {
    if (picks.length >= 5) break;
    if ((perVertical[p.vertical] ?? 0) >= 2) continue;
    perVertical[p.vertical] = (perVertical[p.vertical] ?? 0) + 1;
    picks.push(p);
  }
  if (picks.length < 5) {
    for (const p of built) {
      if (picks.length >= 5) break;
      if (!picks.includes(p)) picks.push(p);
    }
  }

  if (picks.length < 5) {
    notes.push(
      `Only ${picks.length} companies met the bar today — listing those rather than speculating to reach five.`,
    );
  }
  const entCount = picks.filter((p) => p.tier === 'enterprise').length;
  notes.push(
    `Size mix: ${entCount} enterprise / ${picks.length - entCount} mid-market (target ~70/30; signal-driven, so it varies).`,
  );

  await Promise.all(
    picks.map(async (p) => {
      p.contacts = await findDecisionMakers(p.name, p.domain);
    }),
  );

  return { date: today(), picks, candidatesEvaluated: evaluated, notes };
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
      const detail = p.whyNow.detail?.trim();
      const whyMore =
        detail && detail !== p.whyNow.whyNow.trim()
          ? `<details style="margin-top:6px;">
              <summary style="cursor:pointer;color:#4f46e5;font-size:13px;list-style:none;">Show more &#9656;</summary>
              <div style="margin-top:5px;color:#374151;font-size:13px;line-height:1.5;">${escapeHtml(
                detail,
              )}</div>
            </details>`
          : '';
      const contactsHtml = p.contacts.length
        ? `<strong>Who to reach (from public sources):</strong>` +
          p.contacts
            .map(
              (c) =>
                `<div style="margin-top:3px;">&bull; ${escapeHtml(
                  c.name,
                )} &mdash; ${escapeHtml(c.title)}${
                  c.url
                    ? ` &middot; <a href="${escapeAttr(
                        c.url,
                      )}" style="color:#4f46e5;">profile</a>`
                    : ''
                }</div>`,
            )
            .join('')
        : `<strong>Target contact:</strong> ${escapeHtml(
            p.suggestedContact,
          )} <span style="color:#9ca3af;">(no named contact found in public sources)</span>`;
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
              )}${p.employees ? ` &middot; ${escapeHtml(formatEmployees(p.employees))}` : ''}${
        p.revenuePrinted ? ` &middot; Revenue ${escapeHtml(p.revenuePrinted)}` : ''
      }${p.domain ? ` &middot; ${escapeHtml(p.domain)}` : ''}
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
              ${whyMore}
              ${sources}
            </div>
            <div style="font-size:13px;color:#374151;margin-top:10px;border-top:1px dashed #e5e7eb;padding-top:10px;">
              <strong>Suggested play:</strong> ${escapeHtml(
                p.suggestedSolution,
              )}<br/>
              ${contactsHtml}
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
function formatEmployees(s: string): string {
  const v = s.trim();
  return /employee/i.test(v) ? v : `${v} employees`;
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
    p.contacts.length
      ? p.contacts.map((c) => `${c.name} (${c.title})`).join('; ')
      : p.suggestedContact,
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
  // Column 2 = Company, column 3 = Domain. Both go in one set so the Apollo
  // path (domain match) and web path (name match) can dedupe against it.
  // Treat the last ~14 days of rows as recent.
  const set = new Set<string>();
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  for (const row of rows) {
    const dateStr = row[0] ?? '';
    const t = Date.parse(dateStr);
    const recent = Number.isNaN(t) || t >= cutoff;
    if (!recent) continue;
    const name = (row[2] ?? '').trim().toLowerCase();
    const domain = (row[3] ?? '').trim().toLowerCase();
    if (name) set.add(name);
    if (domain) set.add(domain);
  }
  return set;
}
