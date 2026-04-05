'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Users, DollarSign, Activity, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface SheetMetric {
  label: string;
  value: string | number;
  trend?: number;
  icon: any;
  color: string;
}

interface SheetsData {
  waitlist: number;
  activeUsers: number;
  mrr: number;
  roundsLogged: number;
  trends?: {
    waitlist?: number;
    activeUsers?: number;
    mrr?: number;
    roundsLogged?: number;
  };
}

export default function SheetsPanel() {
  const { data: session } = useSession();
  const [data, setData] = useState<SheetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (!session) {
      setLoading(false);
      setError(true);
      return;
    }
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/sheets');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics: SheetMetric[] = data
    ? [
        { label: 'Waitlist', value: data.waitlist, trend: data.trends?.waitlist, icon: Users, color: 'text-blue-500' },
        { label: 'Active Users', value: data.activeUsers, trend: data.trends?.activeUsers, icon: Users, color: 'text-green-500' },
        { label: 'MRR', value: `$${data.mrr.toLocaleString()}`, trend: data.trends?.mrr, icon: DollarSign, color: 'text-yellow-500' },
        { label: 'Rounds Logged', value: data.roundsLogged.toLocaleString(), trend: data.trends?.roundsLogged, icon: Activity, color: 'text-purple-500' },
      ]
    : [];

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh Metrics</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface-2 p-4">
              <div className="h-3 bg-surface-3 rounded w-16 mb-2" />
              <div className="h-6 bg-surface-3 rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh Metrics</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-sm text-gray-400 dark:text-zinc-500">Connect Google Sheets in Settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh Metrics</h3>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="btn-ghost p-1.5"
          disabled={refreshing}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const hasTrend = typeof metric.trend === 'number';
          const isPositive = hasTrend && metric.trend! >= 0;

          return (
            <div
              key={metric.label}
              className="rounded-xl bg-surface-2 p-3.5 transition-all hover:bg-surface-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${metric.color}`} />
                <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">{metric.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-lg font-bold text-gray-900 dark:text-white">{metric.value}</span>
                {hasTrend && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(metric.trend!)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
