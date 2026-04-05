'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Circle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

interface GmailWidgetProps {
  isAuthenticated: boolean;
  compact?: boolean;
}

export default function GmailWidget({ isAuthenticated, compact = false }: GmailWidgetProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchEmails = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gmail');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmails(data.messages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmails(); }, [isAuthenticated]);

  const extractName = (from: string) => {
    const match = from.match(/^([^<]+)/);
    return match ? match[1].trim().replace(/"/g, '') : from;
  };

  if (!isAuthenticated) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <img src="/icons/gmail.svg" alt="Gmail" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Gmail</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Sign in to view emails</p>
          </div>
        </div>
      </div>
    );
  }

  const displayEmails = compact ? emails.slice(0, 4) : emails;

  return (
    <div className={compact ? 'card' : 'animate-fade-in'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
            <img src="/icons/gmail.svg" alt="" className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{compact ? 'Inbox' : 'Gmail'}</h3>
          {emails.filter((e) => e.unread).length > 0 && (
            <span className="badge bg-red-50 dark:bg-red-500/15 text-red-500 dark:text-red-400">
              {emails.filter((e) => e.unread).length}
            </span>
          )}
        </div>
        {!compact && (
          <button onClick={(e) => { e.stopPropagation(); fetchEmails(); }} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="space-y-0.5">
        {displayEmails.map((email) => (
          <div key={email.id} className="p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200">
            <div className="flex items-start gap-2">
              {email.unread && <Circle className="w-1.5 h-1.5 fill-accent text-accent mt-2 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] truncate ${email.unread ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-zinc-400'}`}>
                    {extractName(email.from)}
                  </p>
                  <span className="text-[10px] text-gray-300 dark:text-zinc-600 flex-shrink-0 tabular-nums">
                    {email.date ? formatDistanceToNow(new Date(email.date), { addSuffix: true }) : ''}
                  </span>
                </div>
                <p className={`text-[13px] truncate ${email.unread ? 'text-gray-600 dark:text-zinc-300' : 'text-gray-400 dark:text-zinc-500'}`}>
                  {email.subject}
                </p>
              </div>
            </div>
          </div>
        ))}
        {displayEmails.length === 0 && !loading && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">No emails</p>
        )}
        {loading && displayEmails.length === 0 && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-2.5 rounded-xl">
                <div className="h-3.5 bg-surface-3 rounded w-1/3 mb-2" />
                <div className="h-3 bg-surface-3 rounded w-2/3" />
              </div>
            ))}
          </div>
        )}
      </div>

      {compact && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-accent/80 font-medium flex items-center gap-1 group-hover:text-accent group-hover:gap-1.5 transition-all">
            Open Gmail <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </div>
  );
}
