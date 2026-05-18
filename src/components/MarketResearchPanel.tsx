'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Eye,
  Send,
} from 'lucide-react';

interface HistoryRow {
  date: string;
  rank: string;
  company: string;
  domain: string;
  location: string;
  tier: string;
  vertical: string;
  revenue: string;
  fitScore: string;
  crmStatus: string;
  signals: string;
  whyNow: string;
  eventType: string;
  confidence: string;
  contact: string;
  sources: string;
}

function toRow(r: string[]): HistoryRow {
  return {
    date: r[0] ?? '',
    rank: r[1] ?? '',
    company: r[2] ?? '',
    domain: r[3] ?? '',
    location: r[4] ?? '',
    tier: r[5] ?? '',
    vertical: r[6] ?? '',
    revenue: r[7] ?? '',
    fitScore: r[8] ?? '',
    crmStatus: r[9] ?? '',
    signals: r[10] ?? '',
    whyNow: r[11] ?? '',
    eventType: r[12] ?? '',
    confidence: r[13] ?? '',
    contact: r[14] ?? '',
    sources: r[15] ?? '',
  };
}

const CONF_BADGE: Record<string, string> = {
  high: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400',
  medium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  low: 'bg-gray-100 dark:bg-zinc-500/10 text-gray-500 dark:text-zinc-400',
  none: 'bg-gray-100 dark:bg-zinc-500/10 text-gray-400 dark:text-zinc-500',
};

export default function MarketResearchPanel() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/market-research');
      if (res.status === 401) {
        setMessage('Sign in to view market research.');
        return;
      }
      const data = await res.json();
      setConfigured(data.configured !== false);
      setRows((data.rows ?? []).map(toRow));
    } catch {
      setMessage('Could not load research history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadHistory();
  }, [loadHistory]);

  const run = useCallback(
    async (dryRun: boolean) => {
      setRunning(true);
      setMessage(null);
      setNotes([]);
      try {
        const res = await fetch('/api/market-research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dryRun }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error ?? 'Run failed.');
          return;
        }
        setNotes(data.notes ?? []);
        if (dryRun) {
          setMessage(
            `Preview: ${data.picks?.length ?? 0} target accounts selected (not sent, not logged).`,
          );
          setRows(
            (data.picks ?? []).map((p: any) =>
              toRow([
                data.date,
                String(p.fitScore),
                p.name,
                p.domain ?? '',
                [p.city, p.state, p.country].filter(Boolean).join(', '),
                p.tier,
                p.vertical,
                p.revenuePrinted ?? '',
                String(p.fitScore),
                p.crmStatus,
                (p.signals ?? [])
                  .map((s: any) => `${s.label} (+${s.points})`)
                  .join('; '),
                p.whyNow?.whyNow ?? '',
                p.whyNow?.eventType ?? '',
                p.whyNow?.confidence ?? '',
                p.suggestedContact ?? '',
                (p.whyNow?.sources ?? []).join(' | '),
              ]),
            ),
          );
        } else {
          const sent = data.emailed
            ? `emailed to ${(data.recipients ?? []).length} recipient(s)`
            : data.emailError ?? 'email skipped';
          setMessage(
            `Run complete: ${data.picks?.length ?? 0} accounts — ${sent}.`,
          );
          await loadHistory();
        }
      } catch {
        setMessage('Run failed (network or server error).');
      } finally {
        setRunning(false);
      }
    },
    [loadHistory],
  );

  if (!mounted) return null;

  const latestDate = rows[0]?.date;
  const latest = rows.filter((r) => r.date === latestDate);
  const older = rows.filter((r) => r.date !== latestDate);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Market Research
          </h3>
          <span className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            Blancco SDR
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => run(true)}
            disabled={running}
            className="btn-ghost p-1.5 flex items-center gap-1 text-xs"
            title="Preview without sending"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => run(false)}
            disabled={running}
            className="btn-ghost p-1.5 flex items-center gap-1 text-xs"
            title="Run now and email the SDR team"
          >
            {running ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {!configured && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3.5 mb-3 flex gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            Not fully configured yet. Set <code>APOLLO_API_KEY</code>,{' '}
            <code>GOOGLE_REFRESH_TOKEN</code>, and{' '}
            <code>MARKET_RESEARCH_RECIPIENTS</code> to enable the daily agent.
          </p>
        </div>
      )}

      {message && (
        <div className="rounded-xl bg-surface-2 p-3 mb-3 text-xs text-gray-600 dark:text-zinc-300">
          {message}
        </div>
      )}

      {notes.length > 0 && (
        <div className="rounded-xl bg-surface-2 p-3 mb-3 text-[11px] text-gray-500 dark:text-zinc-400 space-y-1">
          {notes.map((n, i) => (
            <div key={i}>&bull; {n}</div>
          ))}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl bg-surface-2 p-4 border-l-2 border-surface-3"
            >
              <div className="h-4 bg-surface-3 rounded w-1/2 mb-2" />
              <div className="h-3 bg-surface-3 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
            No research yet. Preview the picks or run the agent to email the SDR
            team.
          </p>
          <button
            onClick={() => run(true)}
            disabled={running}
            className="btn-primary text-sm py-2 px-4"
          >
            {running ? 'Working…' : 'Preview today’s 5'}
          </button>
        </div>
      )}

      {latest.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wider">
            {latestDate}
          </p>
          {latest.map((r, i) => (
            <div
              key={`${r.company}-${i}`}
              className="rounded-xl bg-surface-2 p-3.5 border-l-2 border-l-indigo-500"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {r.company}
                    </h4>
                    {r.domain && (
                      <a
                        href={`https://${r.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-indigo-500"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                    {[r.vertical, r.tier, r.location, r.crmStatus]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span
                    className={`badge ${CONF_BADGE[r.confidence] ?? CONF_BADGE.none}`}
                  >
                    {r.confidence || 'n/a'}
                  </span>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {r.fitScore}
                  </span>
                </div>
              </div>
              {r.signals && (
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1.5">
                  {r.signals}
                </p>
              )}
              {r.whyNow && (
                <p className="text-xs text-gray-700 dark:text-zinc-300 mt-1.5">
                  <span className="font-medium">Why now:</span> {r.whyNow}
                </p>
              )}
              {r.contact && (
                <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1">
                  Target: {r.contact}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {older.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-accent font-medium cursor-pointer py-1.5">
            History ({older.length} earlier picks)
          </summary>
          <div className="mt-2 space-y-1.5">
            {older.map((r, i) => (
              <div
                key={`${r.company}-old-${i}`}
                className="flex items-center justify-between text-[11px] text-gray-500 dark:text-zinc-400 py-1 border-b border-border last:border-0"
              >
                <span className="truncate">
                  {r.date} · {r.company}
                </span>
                <span className="flex-shrink-0 ml-2">
                  {r.vertical} · {r.fitScore}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
