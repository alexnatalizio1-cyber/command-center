'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Circle,
  GitCommit,
  Rocket,
  ExternalLink,
  RefreshCw,
  Github,
  Database,
  Globe,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PinHighData {
  appStatus: { online: boolean; statusCode: number } | null;
  lastCommit: {
    message: string;
    author: string;
    date: string;
    sha: string;
    url: string;
  } | null;
  lastDeployment: {
    state: string;
    createdAt: number;
    url: string | null;
    inspectorUrl: string | null;
  } | null;
}

export default function PinHighPanel() {
  const [data, setData] = useState<PinHighData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/pinhigh');
      const json = await res.json();
      setData(json);
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [fetchData]);

  const statusColor = data?.appStatus?.online
    ? 'bg-green-500'
    : 'bg-red-500';
  const statusText = data?.appStatus?.online ? 'Online' : 'Offline';
  const statusBg = data?.appStatus?.online
    ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400'
    : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400';

  const deployState = data?.lastDeployment?.state;
  const deployColor =
    deployState === 'READY'
      ? 'text-green-600 dark:text-green-400'
      : deployState === 'ERROR'
      ? 'text-red-600 dark:text-red-400'
      : 'text-yellow-600 dark:text-yellow-400';

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <span className="text-sm">⛳</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh</h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-surface-3 rounded w-2/3 mb-1.5" />
              <div className="h-3 bg-surface-3 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <span className="text-sm">⛳</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh</h3>
          {data?.appStatus && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBg}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusColor} mr-1`} />
              {statusText}
            </span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          className="btn-ghost p-1.5"
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Items */}
      <div className="space-y-3">
        {/* Last Commit */}
        {data?.lastCommit ? (
          <a
            href={data.lastCommit.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200 group"
          >
            <GitCommit className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-800 dark:text-zinc-200 truncate group-hover:text-accent transition-colors">
                {data.lastCommit.message.split('\n')[0]}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                <span className="font-mono">{data.lastCommit.sha}</span>
                {' · '}
                {formatDistanceToNow(new Date(data.lastCommit.date), { addSuffix: true })}
              </p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 text-gray-400 dark:text-zinc-500">
            <GitCommit className="w-4 h-4" />
            <p className="text-[13px]">No commit data — set GITHUB_TOKEN</p>
          </div>
        )}

        {/* Last Deployment */}
        {data?.lastDeployment ? (
          <a
            href={data.lastDeployment.inspectorUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200 group"
          >
            <Rocket className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-gray-800 dark:text-zinc-200">
                Deploy{' '}
                <span className={`font-semibold ${deployColor}`}>
                  {deployState === 'READY' ? 'Success' : deployState}
                </span>
              </p>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-0.5">
                {formatDistanceToNow(new Date(data.lastDeployment.createdAt), { addSuffix: true })}
              </p>
            </div>
          </a>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 text-gray-400 dark:text-zinc-500">
            <Rocket className="w-4 h-4" />
            <p className="text-[13px]">No deploy data — set VERCEL_PROJECT_TOKEN</p>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="mt-4 pt-3 border-t border-border">
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'App', url: 'https://pin-high.vercel.app', icon: Globe },
            { label: 'Supabase', url: 'https://supabase.com/dashboard', icon: Database },
            { label: 'GitHub', url: 'https://github.com/alexnatalizio1-cyber/pin-high', icon: Github },
            { label: 'Vercel', url: 'https://vercel.com', icon: Rocket },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-surface-2 transition-all text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
            >
              <link.icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">{link.label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
