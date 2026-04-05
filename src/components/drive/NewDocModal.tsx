'use client';

import { useState, FormEvent } from 'react';
import { X, FileText, Table, Presentation, Loader2 } from 'lucide-react';

interface NewDocModalProps {
  folderId: string;
  onClose: () => void;
  onCreated: () => void;
}

type DocType = 'document' | 'spreadsheet' | 'presentation';

const DOC_TYPES: { type: DocType; label: string; emoji: string; icon: typeof FileText }[] = [
  { type: 'document', label: 'Document', emoji: '\uD83D\uDCC4', icon: FileText },
  { type: 'spreadsheet', label: 'Spreadsheet', emoji: '\uD83D\uDCCA', icon: Table },
  { type: 'presentation', label: 'Presentation', emoji: '\uD83D\uDCFD\uFE0F', icon: Presentation },
];

export default function NewDocModal({ folderId, onClose, onCreated }: NewDocModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DocType>('document');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/drive/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          folderId: folderId === 'root' ? undefined : folderId,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Open the created doc in a new tab
      if (data.file?.webViewLink) {
        window.open(data.file.webViewLink, '_blank');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface-1 rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200">
            Create New
          </h2>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled"
              className="input-base w-full px-3 py-2 text-sm"
              autoFocus
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map((dt) => (
                <button
                  key={dt.type}
                  type="button"
                  onClick={() => setType(dt.type)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    type === dt.type
                      ? 'border-accent bg-accent/5 text-accent'
                      : 'border-border hover:border-gray-300 dark:hover:border-zinc-600 text-gray-600 dark:text-zinc-400'
                  }`}
                >
                  <span className="text-xl">{dt.emoji}</span>
                  <span className="text-xs font-medium">{dt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
