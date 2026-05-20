import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getServiceAuthClient, hasServiceAuth } from '@/lib/google-service-auth';
import {
  runResearch,
  renderEmailHtml,
  sendEmail,
  logToSheet,
  readHistory,
  recentDomainsFromHistory,
  today,
} from '@/lib/blancco-research';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function checkAuth(
  req: NextRequest,
  hasSession: boolean,
): { ok: boolean; isCron: boolean } {
  const secret = process.env.MARKET_RESEARCH_CRON_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.replace(/^Bearer\s+/i, '');
  if (secret && bearer && bearer === secret) return { ok: true, isCron: true };
  return { ok: hasSession, isCron: false };
}

function recipients(): string[] {
  return (process.env.MARKET_RESEARCH_RECIPIENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Run the daily research pipeline.
 * Auth: a valid Bearer cron secret (GitHub Actions) OR a logged-in session
 * (the dashboard "Run now" button). Pass {"dryRun": true} to preview the picks
 * without sending email or writing the history Sheet.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { ok, isCron } = checkAuth(req, Boolean(session?.user));
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body?.dryRun === true;
    } catch {
      // no body — full run
    }

    if (!hasServiceAuth()) {
      return NextResponse.json(
        {
          error:
            'Service Google auth not configured. Set GOOGLE_REFRESH_TOKEN (plus GOOGLE_CLIENT_ID/SECRET) for the sending mailbox so the agent can email and log unattended.',
        },
        { status: 503 },
      );
    }
    const auth = getServiceAuthClient();

    // Avoid repeating companies featured in the last ~14 days, and detect if
    // today's email already went out (idempotency for the multi-cron daily
    // window — only the first invocation actually sends).
    let recentDomains = new Set<string>();
    let alreadySentToday = false;
    const todayStr = today();
    try {
      const hist = await readHistory(auth, 120);
      recentDomains = recentDomainsFromHistory(hist.rows);
      alreadySentToday = hist.rows.some(
        (r) => (r[0] ?? '').trim() === todayStr,
      );
    } catch {
      // history not available yet — proceed with empty set
    }

    // Cron path: if today's row is already in the Sheet, the first cron of the
    // day already delivered — short-circuit so back-up crons never duplicate.
    // Dashboard (session) sends always run on demand.
    if (isCron && !dryRun && alreadySentToday) {
      return NextResponse.json({
        skipped: true,
        reason: 'already sent today',
        date: todayStr,
        emailed: false,
      });
    }

    const result = await runResearch(recentDomains);

    if (dryRun) {
      return NextResponse.json({ ...result, dryRun: true, emailed: false });
    }

    const html = renderEmailHtml(result);
    const to = recipients();

    let emailed = false;
    let emailError: string | null = null;
    if (to.length === 0) {
      emailError =
        'MARKET_RESEARCH_RECIPIENTS not set — skipped sending. Picks were still logged.';
    } else {
      try {
        await sendEmail(
          auth,
          to,
          `Blancco SDR Target Accounts - ${result.date}`,
          html,
        );
        emailed = true;
      } catch (e) {
        emailError = e instanceof Error ? e.message : 'Email send failed';
      }
    }

    let sheetId: string | null = null;
    try {
      sheetId = await logToSheet(auth, result);
    } catch (e) {
      sheetId = null;
    }

    return NextResponse.json({
      ...result,
      emailed,
      emailError,
      recipients: to,
      sheetId,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error running research';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Recent history for the dashboard panel. Session required. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!hasServiceAuth()) {
      return NextResponse.json({ rows: [], sheetId: null, configured: false });
    }
    const auth = getServiceAuthClient();
    const { sheetId, rows } = await readHistory(auth, 30);
    return NextResponse.json({ rows, sheetId, configured: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to read history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
