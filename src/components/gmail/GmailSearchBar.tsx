'use client';

import { useState, FormEvent } from 'react';
import { Search, X } from 'lucide-react';

interface GmailSearchBarProps {
  value: string;
  onSearchChange: (query: string) => void;
}

export default function GmailSearchBar({ value, onSearchChange }: GmailSearchBarProps) {
  const [input, setInput] = useState(value);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchChange(input);
  };

  const handleClear = () => {
    setInput('');
    onSearchChange('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Search mail..."
        className="input-base w-full pl-9 pr-8 py-2 text-sm"
      />
      {input && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </form>
  );
}
