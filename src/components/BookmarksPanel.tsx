'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, Search, Folder, Globe, X, ArrowRight } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  folder: string;
  favicon?: string;
  createdAt: string;
}

const DEFAULT_FOLDERS = ['Quick Access', 'PinHigh', 'Tools', 'Resources', 'Social', 'Other'];

const SEED_BOOKMARKS: BookmarkItem[] = [
  { id: 'seed-1', title: 'PinHigh App', url: 'https://pin-high.vercel.app', folder: 'PinHigh', favicon: 'https://www.google.com/s2/favicons?domain=pin-high.vercel.app&sz=32', createdAt: '2026-04-04T00:00:00Z' },
  { id: 'seed-2', title: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', folder: 'PinHigh', favicon: 'https://www.google.com/s2/favicons?domain=supabase.com&sz=32', createdAt: '2026-04-04T00:00:00Z' },
  { id: 'seed-3', title: 'PinHigh GitHub', url: 'https://github.com/alexnatalizio1-cyber/pin-high', folder: 'PinHigh', favicon: 'https://www.google.com/s2/favicons?domain=github.com&sz=32', createdAt: '2026-04-04T00:00:00Z' },
  { id: 'seed-4', title: 'Vercel Dashboard', url: 'https://vercel.com/dashboard', folder: 'PinHigh', favicon: 'https://www.google.com/s2/favicons?domain=vercel.com&sz=32', createdAt: '2026-04-04T00:00:00Z' },
  { id: 'seed-5', title: 'Command Center', url: 'https://command-center-wine-alpha.vercel.app', folder: 'Tools', favicon: 'https://www.google.com/s2/favicons?domain=command-center-wine-alpha.vercel.app&sz=32', createdAt: '2026-04-04T00:00:00Z' },
];

export default function BookmarksPanel({ compact = false }: { compact?: boolean }) {
  const [bookmarks, setBookmarks] = useLocalStorage<BookmarkItem[]>('cc-bookmarks', SEED_BOOKMARKS);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [activeFolder, setActiveFolder] = useState('All');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newFolder, setNewFolder] = useState('Quick Access');
  const [seeded, setSeeded] = useState(false);

  // One-time seed: merge defaults into existing bookmarks if not already present
  useEffect(() => {
    if (seeded) return;
    const missing = SEED_BOOKMARKS.filter((s) => !bookmarks.some((b) => b.url === s.url));
    if (missing.length > 0) {
      setBookmarks((prev) => [...missing, ...prev]);
    }
    setSeeded(true);
  }, [bookmarks, seeded]);

  const folders = ['All', ...Array.from(new Set([...DEFAULT_FOLDERS, ...bookmarks.map((b) => b.folder)]))];

  const addBookmark = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) return;
    let url = newUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    const bookmark: BookmarkItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      url,
      folder: newFolder,
      favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`,
      createdAt: new Date().toISOString(),
    };
    setBookmarks((prev) => [bookmark, ...prev]);
    setNewTitle('');
    setNewUrl('');
    setShowAdd(false);
  };

  const deleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const filtered = bookmarks
    .filter((b) => activeFolder === 'All' || b.folder === activeFolder)
    .filter(
      (b) =>
        !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.url.toLowerCase().includes(search.toLowerCase())
    );

  if (compact) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔖</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Bookmarks</h3>
          </div>
          <button onClick={(e) => { e.stopPropagation(); setShowAdd(true); }} className="btn-ghost p-1.5">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          {bookmarks.slice(0, 5).map((bm) => (
            <a
              key={bm.id}
              href={bm.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {bm.favicon ? (
                <img src={bm.favicon} alt="" className="w-4 h-4 rounded" />
              ) : (
                <Globe className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              )}
              <span className="text-sm text-gray-900 dark:text-white truncate">{bm.title}</span>
            </a>
          ))}
          {bookmarks.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-2">No bookmarks yet</p>
          )}
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <span className="text-xs text-accent font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
            View all <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">🔖 Bookmarks</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">{bookmarks.length} saved links</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary text-sm py-2 px-4 flex items-center gap-1.5">
          {showAdd ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showAdd ? 'Cancel' : 'Add'}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addBookmark} className="card mb-6 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title"
              className="input-base text-sm"
              autoFocus
            />
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="URL"
              className="input-base text-sm"
            />
            <div className="flex gap-2">
              <select
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                className="input-base text-sm flex-1"
              >
                {DEFAULT_FOLDERS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <button type="submit" className="btn-primary text-sm">Save</button>
            </div>
          </div>
        </form>
      )}

      {/* Search + folders */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bookmarks..."
            className="input-base w-full pl-9 py-2.5 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {folders.map((folder) => (
          <button
            key={folder}
            onClick={() => setActiveFolder(folder)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeFolder === folder ? 'bg-accent text-white' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-surface-2'
            }`}
          >
            {folder !== 'All' && <Folder className="w-3 h-3" />}
            {folder}
          </button>
        ))}
      </div>

      {/* Bookmarks grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((bm) => (
          <div key={bm.id} className="card-compact flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center flex-shrink-0">
              {bm.favicon ? (
                <img src={bm.favicon} alt="" className="w-4 h-4 rounded" />
              ) : (
                <Globe className="w-4 h-4 text-gray-400 dark:text-zinc-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <a
                href={bm.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 dark:text-white hover:text-accent transition-colors truncate block"
              >
                {bm.title}
              </a>
              <p className="text-[11px] text-gray-400 dark:text-zinc-500 truncate">{new URL(bm.url).hostname}</p>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <a href={bm.url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1">
                <ExternalLink className="w-3 h-3" />
              </a>
              <button onClick={() => deleteBookmark(bm.id)} className="btn-ghost p-1 text-red-400 hover:text-red-500">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
          {search ? 'No matching bookmarks' : 'No bookmarks yet. Add some!'}
        </p>
      )}
    </div>
  );
}
