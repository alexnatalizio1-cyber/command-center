'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import {
  Settings,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  ToggleLeft,
  ToggleRight,
  Link2,
  Bot,
  Info,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export default function SettingsPanel() {
  const { data: session } = useSession();
  const [sheetId, setSheetId] = useLocalStorage<string>('pinhigh-sheet-id', '');
  const [geminiEnabled, setGeminiEnabled] = useLocalStorage<boolean>('gemini-enabled', true);
  const [autoFetchContext, setAutoFetchContext] = useLocalStorage<boolean>('gemini-auto-fetch', true);
  const [voiceEnabled, setVoiceEnabled] = useLocalStorage<boolean>('gemini-voice-enabled', true);
  const [testingSheet, setTestingSheet] = useState(false);
  const [sheetTestResult, setSheetTestResult] = useState<'success' | 'error' | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const testSheetConnection = async () => {
    if (!sheetId.trim()) return;
    setTestingSheet(true);
    setSheetTestResult(null);
    try {
      const res = await fetch(`/api/sheets?spreadsheetId=${encodeURIComponent(sheetId)}`);
      if (res.ok) {
        setSheetTestResult('success');
      } else {
        setSheetTestResult('error');
      }
    } catch {
      setSheetTestResult('error');
    } finally {
      setTestingSheet(false);
    }
  };

  if (!mounted) return null;

  const isConnected = !!session;

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
      aria-label={value ? 'Disable' : 'Enable'}
    >
      {value ? (
        <ToggleRight className="w-7 h-7 text-accent" />
      ) : (
        <ToggleLeft className="w-7 h-7 text-gray-300 dark:text-zinc-600" />
      )}
    </button>
  );

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="w-6 h-6 text-gray-400 dark:text-zinc-500" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">Manage connections and preferences</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* A) Google Account */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <img src="/icons/google.svg" alt="" className="w-4 h-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Google Account</h3>
            <span className={`ml-auto flex items-center gap-1.5 text-xs font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {isConnected && session?.user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2">
                {session.user.image && (
                  <img src={session.user.image} alt="" className="w-10 h-10 rounded-full" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{session.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{session.user.email}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Scopes Granted</p>
                {['Gmail (read/send)', 'Calendar (read/write)', 'Drive (read)', 'Sheets (read)'].map((scope) => (
                  <div key={scope} className="flex items-center gap-2 text-xs text-gray-600 dark:text-zinc-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    {scope}
                  </div>
                ))}
              </div>

              <button
                onClick={() => signIn('google')}
                className="btn-ghost text-sm w-full flex items-center justify-center gap-2 min-h-[44px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn('google')}
              className="btn-primary text-sm w-full min-h-[44px]"
            >
              Connect Google Account
            </button>
          )}
        </div>

        {/* B) PinHigh Integration */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <span className="text-sm">⛳</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">PinHigh Integration</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-zinc-400 block mb-1.5">
                Google Sheet ID
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  placeholder="Enter your Sheet ID..."
                  className="input-base flex-1 text-sm"
                />
                <button
                  onClick={testSheetConnection}
                  disabled={!sheetId.trim() || testingSheet}
                  className="btn-ghost text-sm whitespace-nowrap flex items-center gap-1.5 min-h-[44px] disabled:opacity-30"
                >
                  {testingSheet ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  Test
                </button>
              </div>
              {sheetTestResult === 'success' && (
                <p className="text-xs text-green-500 mt-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connection successful
                </p>
              )}
              {sheetTestResult === 'error' && (
                <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Could not connect. Check the Sheet ID.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* C) Gemini Agent */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-blue-500" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Gemini Agent</h3>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-2 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Enable Gemini Agent</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Show the floating chat button</p>
              </div>
              <Toggle value={geminiEnabled} onChange={setGeminiEnabled} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-2 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Auto-fetch context</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Load email/calendar data for Gemini</p>
              </div>
              <Toggle value={autoFetchContext} onChange={setAutoFetchContext} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-surface-2 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Voice input</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400">Enable microphone for voice commands</p>
              </div>
              <Toggle value={voiceEnabled} onChange={setVoiceEnabled} />
            </div>
          </div>
        </div>

        {/* D) About */}
        <div className="card">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-zinc-500/10 flex items-center justify-center">
              <Info className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">About</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500 dark:text-zinc-400">Version</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">1.0.0</span>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://pin-high.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm flex items-center gap-1.5 min-h-[44px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                PinHigh App
              </a>
              <a
                href="https://github.com/alexnatalizio1-cyber/pin-high"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost text-sm flex items-center gap-1.5 min-h-[44px]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
