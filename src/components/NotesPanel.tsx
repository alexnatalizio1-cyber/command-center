'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Search, Pin, PinOff, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Note {
  id: string;
  title: string;
  content: string;
  preview: string;
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

function NoteListSkeleton() {
  return (
    <div className="space-y-1">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="p-3 rounded-xl animate-pulse">
          <div className="h-3.5 bg-surface-3 rounded-lg w-3/4 mb-2" />
          <div className="h-2.5 bg-surface-3 rounded-lg w-full mb-1.5" />
          <div className="h-2 bg-surface-3 rounded-lg w-1/4" />
        </div>
      ))}
    </div>
  );
}

export default function NotesPanel({ compact = false }: { compact?: boolean }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [activeNoteContent, setActiveNoteContent] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchNotes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/notes');
      if (res.status === 401) {
        setError('auth');
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(
        (data.notes || []).map((n: any) => ({
          ...n,
          content: n.content || '',
          preview: n.preview || '',
        })),
      );
    } catch {
      setError('Could not load notes. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Load full note content when selecting a note
  const loadNoteContent = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`);
      if (!res.ok) return;
      const data = await res.json();
      setActiveNoteContent(data.note.content || '');
      // Update local note data with full info
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId
            ? { ...n, content: data.note.content || '', pinned: data.note.pinned, color: data.note.color }
            : n,
        ),
      );
    } catch {
      // silent
    }
  }, []);

  const selectNote = useCallback(
    (noteId: string) => {
      setActiveNote(noteId);
      loadNoteContent(noteId);
    },
    [loadNoteContent],
  );

  const createNote = async (e?: React.MouseEvent) => {
    e?.stopPropagation();

    // Optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimisticNote: Note = {
      id: tempId,
      title: 'Untitled Note',
      content: '',
      preview: '',
      pinned: false,
      color: NOTE_COLORS[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes((prev) => [optimisticNote, ...prev]);
    setActiveNote(tempId);
    setActiveNoteContent('');

    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Note', content: '' }),
      });
      if (!res.ok) throw new Error('Failed to create note');
      const data = await res.json();
      setNotes((prev) =>
        prev.map((n) => (n.id === tempId ? { ...optimisticNote, id: data.note.id } : n)),
      );
      setActiveNote(data.note.id);
    } catch {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      setActiveNote(null);
    }
  };

  const saveNote = useCallback(
    (noteId: string, updates: Partial<Note>) => {
      if (noteId.startsWith('temp_')) return;
      setSaving(true);

      // Debounce saves
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const patchBody: Record<string, unknown> = {};
          if (updates.title !== undefined) patchBody.title = updates.title;
          if (updates.content !== undefined) patchBody.content = updates.content;
          if (updates.pinned !== undefined) patchBody.pinned = updates.pinned;
          if (updates.color !== undefined) patchBody.color = updates.color;

          await fetch(`/api/notes/${noteId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchBody),
          });
        } catch {
          // silent - data persists on next save
        } finally {
          setSaving(false);
        }
      }, 800);
    },
    [],
  );

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n)),
    );
    if (updates.content !== undefined) {
      setActiveNoteContent(updates.content);
    }
    saveNote(id, updates);
  };

  const deleteNote = async (id: string) => {
    const noteToDelete = notes.find((n) => n.id === id);
    // Optimistic delete
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNote === id) {
      setActiveNote(null);
      setActiveNoteContent('');
    }

    if (id.startsWith('temp_')) return;

    try {
      const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    } catch {
      if (noteToDelete) setNotes((prev) => [...prev, noteToDelete]);
    }
  };

  const togglePin = (id: string) => {
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    updateNote(id, { pinned: !note.pinned });
  };

  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const filtered = search
    ? sorted.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          (n.preview || '').toLowerCase().includes(search.toLowerCase()),
      )
    : sorted;

  if (error === 'auth') {
    if (compact) {
      return (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📝</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Notes</h3>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500 py-4">
            <AlertCircle className="w-4 h-4" />
            <span>Sign in with Google to sync notes</span>
          </div>
        </div>
      );
    }
    return (
      <div className="animate-fade-in">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">📝 Notes</h2>
        <div className="card flex flex-col items-center justify-center py-12 gap-3">
          <AlertCircle className="w-8 h-8 text-gray-300 dark:text-zinc-600" />
          <p className="text-sm text-gray-500 dark:text-zinc-400">Sign in with Google to sync notes</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Your notes will be stored as Google Docs and sync across devices</p>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <h3 className="font-semibold text-gray-900 dark:text-white">Notes</h3>
            <span className="badge bg-surface-2 text-gray-500 dark:text-zinc-400">{notes.length}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); fetchNotes(true); }}
              className="btn-ghost p-1.5"
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={createNote} className="btn-ghost p-1.5">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        {loading ? (
          <NoteListSkeleton />
        ) : (
          <div className="space-y-1">
            {sorted.slice(0, 4).map((note) => (
              <div key={note.id} className="p-2.5 rounded-xl hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px]" onClick={(e) => e.stopPropagation()}>
                <p className="text-sm text-gray-900 dark:text-white truncate">{note.title}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{note.preview || 'Empty note'}</p>
              </div>
            ))}
            {sorted.length === 0 && !loading && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 text-center py-2">No notes yet</p>
            )}
          </div>
        )}
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchNotes(true)}
              className="btn-ghost p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center"
              disabled={refreshing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => createNote()} className="btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5 min-h-[44px]">
              <Plus className="w-3.5 h-3.5" /> New
            </button>
          </div>
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
          {loading ? (
            <NoteListSkeleton />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={() => fetchNotes()} className="btn-ghost text-sm mt-2 min-h-[44px]">
                Try again
              </button>
            </div>
          ) : (
            <>
              {filtered.map((note) => (
                <div
                  key={note.id}
                  onClick={() => selectNote(note.id)}
                  className={`p-3 rounded-xl cursor-pointer border-l-2 ${note.color} transition-all min-h-[44px] ${
                    activeNote === note.id ? 'bg-surface-3 border-border' : 'hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                      {note.pinned && <Pin className="w-3 h-3 inline mr-1 text-accent" />}
                      {note.title}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">{note.preview || 'Empty note'}</p>
                  {note.updatedAt && (
                    <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-1">
                      {format(new Date(note.updatedAt), 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">
                  {search ? 'No matching notes' : 'No notes yet. Create one!'}
                </p>
              )}
            </>
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
                {saving && (
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 mr-2">Saving...</span>
                )}
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
                <button onClick={() => togglePin(currentNote.id)} className="btn-ghost p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {currentNote.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteNote(currentNote.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <textarea
              value={activeNoteContent}
              onChange={(e) => updateNote(currentNote.id, { content: e.target.value })}
              className="flex-1 bg-transparent text-sm text-gray-700 dark:text-zinc-300 placeholder-gray-300 dark:placeholder-zinc-600 resize-none outline-none leading-relaxed"
              placeholder="Start writing..."
            />
            {currentNote.updatedAt && (
              <p className="text-[10px] text-gray-300 dark:text-zinc-600 mt-2 pt-2 border-t border-border">
                Last edited {format(new Date(currentNote.updatedAt), 'MMM d, yyyy h:mm a')}
              </p>
            )}
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
