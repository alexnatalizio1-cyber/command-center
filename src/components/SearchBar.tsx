'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ArrowRight } from 'lucide-react';

interface SearchBarProps {
  onNavigate: (view: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'Google', prefix: 'g:', emoji: '🔍', action: (q: string) => window.open(`https://google.com/search?q=${encodeURIComponent(q)}`, '_blank') },
  { label: 'Claude', prefix: 'c:', emoji: '🟠', action: () => window.open('https://claude.ai', '_blank') },
  { label: 'ChatGPT', prefix: 'gpt:', emoji: '🟢', action: () => window.open('https://chat.openai.com', '_blank') },
  { label: 'Drive', prefix: 'd:', emoji: '📂', action: (q: string) => window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(q)}`, '_blank') },
  { label: 'Gmail', prefix: 'm:', emoji: '📧', action: (q: string) => window.open(`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(q)}`, '_blank') },
];

export default function SearchBar({ onNavigate }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    for (const action of QUICK_ACTIONS) {
      if (query.startsWith(action.prefix)) {
        action.action(query.slice(action.prefix.length).trim());
        setQuery('');
        return;
      }
    }

    window.open(`https://google.com/search?q=${encodeURIComponent(query)}`, '_blank');
    setQuery('');
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div className={`relative flex items-center transition-all duration-300 ${focused ? 'scale-[1.005]' : ''}`}>
          <Search className="absolute left-4 w-4 h-4 text-gray-300 dark:text-zinc-600" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            placeholder="Search anything... ⌘K"
            className="input-base w-full pl-11 pr-16 py-3 text-sm"
          />
          {query && (
            <button type="submit" className="absolute right-3 text-accent hover:text-accent-dim transition-colors p-1">
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {focused && !query && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface-1 border border-border rounded-xl p-1.5 z-50 animate-fade-in" style={{ boxShadow: 'var(--shadow-card-hover)' }}>
          <p className="text-[10px] text-gray-400 dark:text-zinc-600 px-3 py-1.5 font-medium uppercase tracking-wider">Quick actions</p>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.prefix}
              className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-surface-2 transition-all text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(action.prefix);
                inputRef.current?.focus();
              }}
            >
              <span className="text-sm">{action.emoji}</span>
              <span className="text-[13px] text-gray-600 dark:text-zinc-300 font-medium">{action.label}</span>
              <code className="text-[10px] text-gray-400 dark:text-zinc-600 ml-auto bg-surface-2 dark:bg-surface-3 px-1.5 py-0.5 rounded font-mono">{action.prefix}</code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
