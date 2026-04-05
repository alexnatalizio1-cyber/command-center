'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

interface DriveWidgetProps {
  isAuthenticated: boolean;
  compact?: boolean;
}

const MIME_EMOJI: Record<string, string> = {
  'application/vnd.google-apps.document': '📄',
  'application/vnd.google-apps.spreadsheet': '📊',
  'application/vnd.google-apps.presentation': '📽️',
  'application/vnd.google-apps.form': '📋',
  'application/vnd.google-apps.folder': '📁',
  'image/': '🖼️',
};

function getFileEmoji(mimeType: string) {
  for (const [key, emoji] of Object.entries(MIME_EMOJI)) {
    if (mimeType.startsWith(key)) return emoji;
  }
  return '📄';
}

export default function DriveWidget({ isAuthenticated, compact = false }: DriveWidgetProps) {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchFiles = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/drive');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFiles(data.files || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFiles(); }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
            <img src="/icons/drive.svg" alt="Drive" className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Drive</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">Sign in to view files</p>
          </div>
        </div>
      </div>
    );
  }

  const displayFiles = compact ? files.slice(0, 4) : files;

  return (
    <div className={compact ? 'card' : 'animate-fade-in'}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
            <img src="/icons/drive.svg" alt="" className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">{compact ? 'Recent Files' : 'Google Drive'}</h3>
        </div>
        {!compact && (
          <button onClick={(e) => { e.stopPropagation(); fetchFiles(); }} className="btn-ghost p-1.5" disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="space-y-0.5">
        {displayFiles.map((file) => (
          <div key={file.id} className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-surface-2 transition-all duration-200">
            <span className="text-sm flex-shrink-0">{getFileEmoji(file.mimeType)}</span>
            <p className="text-[13px] text-gray-800 dark:text-zinc-200 truncate flex-1">{file.name}</p>
            <span className="text-[10px] text-gray-300 dark:text-zinc-600 flex-shrink-0 tabular-nums">
              {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
            </span>
          </div>
        ))}
        {displayFiles.length === 0 && !loading && (
          <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-6">No files</p>
        )}
        {loading && displayFiles.length === 0 && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse p-2.5 rounded-xl"><div className="h-3.5 bg-surface-3 rounded w-2/3" /></div>
            ))}
          </div>
        )}
      </div>

      {compact && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-accent/80 font-medium flex items-center gap-1 group-hover:text-accent group-hover:gap-1.5 transition-all">
            Open Drive <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      )}
    </div>
  );
}
