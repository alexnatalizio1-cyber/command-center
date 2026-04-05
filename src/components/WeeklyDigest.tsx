'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Palette, BarChart3, Wrench, RefreshCw } from 'lucide-react';

interface DigestCard {
  type: 'content' | 'metric' | 'build';
  title: string;
  description: string;
  actionItem: string;
}

interface DigestData {
  cards: DigestCard[];
  generatedAt: string;
}

const STORAGE_KEY = 'cc-weekly-digest';

const TYPE_CONFIG = {
  content: { label: 'Content', icon: Palette, accent: 'border-l-purple-500', badgeBg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  metric: { label: 'Metric', icon: BarChart3, accent: 'border-l-blue-500', badgeBg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  build: { label: 'Build', icon: Wrench, accent: 'border-l-green-500', badgeBg: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400' },
};

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

function getNextMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + diff);
  return next.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function WeeklyDigest() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as DigestData;
        setDigest(parsed);

        // Auto-fetch on Mondays if digest is stale
        if (isMonday()) {
          const generatedDate = new Date(parsed.generatedAt).toDateString();
          const today = new Date().toDateString();
          if (generatedDate !== today) {
            generateDigest();
          }
        }
      }
    } catch {
      // silent
    }
  }, []);

  const generateDigest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/gemini/weekly-digest', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate digest');
      const data = await res.json();

      // API returns `recommendations` with `action` field; normalize to `cards` with `actionItem`
      const rawCards = data.cards || data.recommendations || [];
      const normalizedCards = rawCards.map((c: DigestCard & { action?: string }) => ({
        type: c.type || 'content',
        title: c.title || '',
        description: c.description || '',
        actionItem: c.actionItem || c.action || '',
      }));

      const newDigest: DigestData = {
        cards: normalizedCards,
        generatedAt: data.generatedAt || new Date().toISOString(),
      };

      setDigest(newDigest);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newDigest));
    } catch {
      // If API fails, show a fallback
      const fallback: DigestData = {
        cards: [
          { type: 'content', title: 'Share a tip', description: 'Post a quick golf improvement tip on social media to engage your audience.', actionItem: 'Draft a short-form post about course strategy.' },
          { type: 'metric', title: 'Review signups', description: 'Check waitlist growth from last week and identify top referral sources.', actionItem: 'Export waitlist data and compare week-over-week.' },
          { type: 'build', title: 'Ship a feature', description: 'Focus on the highest-impact feature in your backlog this week.', actionItem: 'Pick one task from the roadmap and complete it.' },
        ],
        generatedAt: new Date().toISOString(),
      };
      setDigest(fallback);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    } finally {
      setLoading(false);
    }
  }, []);

  if (!mounted) return null;

  const monday = isMonday();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Weekly Digest</h3>
          {monday && (
            <span className="badge bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Monday
            </span>
          )}
        </div>
        {digest && (
          <button
            onClick={generateDigest}
            className="btn-ghost p-1.5"
            disabled={loading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {loading && !digest && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface-2 p-4 border-l-2 border-surface-3">
              <div className="h-3 bg-surface-3 rounded w-16 mb-2" />
              <div className="h-4 bg-surface-3 rounded w-3/4 mb-1.5" />
              <div className="h-3 bg-surface-3 rounded w-full mb-1" />
              <div className="h-3 bg-surface-3 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {!loading && !digest && (
        <div className="text-center py-4">
          {monday ? (
            <>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mb-3">
                Ready to generate your weekly recommendations.
              </p>
              <button
                onClick={generateDigest}
                className="btn-primary text-sm py-2 px-4"
              >
                Generate Digest
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-zinc-500">
              Next digest: {getNextMonday()}
            </p>
          )}
        </div>
      )}

      {digest && (
        <div className="space-y-3">
          {digest.cards.map((card, i) => {
            const config = TYPE_CONFIG[card.type] || TYPE_CONFIG.content;
            const Icon = config.icon;
            return (
              <div
                key={i}
                className={`rounded-xl bg-surface-2 p-3.5 border-l-2 ${config.accent} transition-all hover:bg-surface-3`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`badge ${config.badgeBg} flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {card.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mb-2">
                  {card.description}
                </p>
                <p className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                  Action: {card.actionItem}
                </p>
              </div>
            );
          })}

          {!monday && (
            <button
              onClick={generateDigest}
              disabled={loading}
              className="w-full text-center text-xs text-accent font-medium py-2 hover:bg-surface-2 rounded-xl transition-colors min-h-[44px] flex items-center justify-center"
            >
              {loading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                'Regenerate Digest'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
