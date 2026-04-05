'use client';

import { useState } from 'react';
import { StickyNote, Plus, Trash2, Search, Pin, PinOff, ArrowRight } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  'border-l-gray-400 dark:border-l-zinc-600',
  'border-l-red-500',
  'border-l-orange-500',
  'border-l-yellow-500',
  'border-l-green-500',
  'border-l-blue-500',
  'border-l-purple-500',
];

export default function NotesPanel({ compact = false }: { compact?: boolean }) {
  const [notes, setNotes] = useLocalStorage<Note[]>('cc-notes', []);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const createNote = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const note: Note = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '',
      pinned: false,
      color: NOTE_COLORS[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [note, ...prev]);
    setActiveNote(note.id);
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n))
    );
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote === id) setActiveNote(null);
  };

  const togglePin = (id: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
  };

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const filtered = search
    ? sorted.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : sorted;

  if (compact) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Notes</h3>
            <span className="badge bg-surface-2 text-gray-500 dark:text-zinc-400">{notes.length}</span>
          </div>
          <button onClick={createNote} className="btn-ghost p-1.5">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-1">
          {sorted.slice(0, 4).map((note) => (
            <div key={note.id} className="p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-gray-900 dark:text-white truncate">{note.title}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{note.content || 'Empty note'}</p>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-2">No notes yet</p>
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

  const currentNote = notes.find((n) => n.id === activeNote);

  return (
    <div className="animate-fade-in flex gap-6 h-[calc(100vh-180px)]">
      {/* Note list */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">📝</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Notes</h2>
            <span className="badge bg-surface-2 text-gray-500 dark:text-zinc-400">{notes.length}</span>
          </div>
          <button onClick={() => createNote()} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="input-base w-full pl-9 py-2 text-sm"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map((note) => (
            <div
              key={note.id}
              onClick={() => setActiveNote(note.id)}
              className={`p-3 rounded-xl cursor-pointer border-l-2 ${note.color} transition-all ${
                activeNote === note.id ? 'bg-surface-3 border-border' : 'hover:bg-surface-2'
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                  {note.pinned && <Pin className="w-3 h-3 inline mr-1 text-accent" />}
                  {note.title}
                </p>
              </div>
              <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">{note.content || 'Empty note'}</p>
              <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-1">{format(new Date(note.updatedAt), 'MMM d, h:mm a')}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
              {search ? 'No matching notes' : 'No notes yet. Create one!'}
            </p>
          )}
        </div>
      </div>

      {/* Note editor */}
      <div className="flex-1 card flex flex-col">
        {currentNote ? (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
              <input
                type="text"
                value={currentNote.title}
                onChange={(e) => updateNote(currentNote.id, { title: e.target.value })}
                className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none flex-1"
                placeholder="Note title..."
              />
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-0.5 mr-2">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateNote(currentNote.id, { color })}
                      className={`w-4 h-4 rounded-full border-2 ${color.replace('border-l-', 'bg-').replace(' dark:border-l-zinc-600', '')} ${
                        currentNote.color === color ? 'ring-2 ring-accent/30' : ''
                      }`}
                    />
                  ))}
                </div>
                <button onClick={() => togglePin(currentNote.id)} className="btn-ghost p-1.5">
                  {currentNote.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteNote(currentNote.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={currentNote.content}
              onChange={(e) => updateNote(currentNote.id, { content: e.target.value })}
              className="flex-1 bg-transparent text-sm text-gray-700 dark:text-zinc-300 placeholder-gray-300 dark:placeholder-zinc-600 resize-none outline-none leading-relaxed"
              placeholder="Start writing..."
            />
            <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-2 pt-2 border-t border-border">
              Last edited {format(new Date(currentNote.updatedAt), 'MMM d, yyyy h:mm a')}
            </p>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-zinc-500">
            <div className="text-center">
              <span className="text-4xl block mb-3">📝</span>
              <p className="text-sm">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
