'use client';

import { useState, useEffect, FormEvent } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';

interface Permission {
  id: string;
  emailAddress: string;
  displayName: string;
  role: string;
  type: string;
}

interface ShareModalProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  organizer: 'Organizer',
  fileOrganizer: 'File organizer',
  writer: 'Editor',
  commenter: 'Commenter',
  reader: 'Viewer',
};

export default function ShareModal({ fileId, fileName, onClose }: ShareModalProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'reader' | 'writer' | 'commenter'>('reader');
  const [error, setError] = useState('');

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/${fileId}/share`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPermissions(data.permissions || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [fileId]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setAdding(true);
    setError('');
    try {
      const res = await fetch(`/api/drive/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmail('');
      fetchPermissions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface-1 rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 truncate">
            Share &quot;{fileName}&quot;
          </h2>
          <button onClick={onClose} className="btn-ghost p-2 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Add people form */}
        <form onSubmit={handleAdd} className="p-4 border-b border-border">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add people by email..."
              className="input-base flex-1 px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'reader' | 'writer' | 'commenter')}
              className="input-base px-2 py-2 text-sm w-28"
            >
              <option value="reader">Viewer</option>
              <option value="commenter">Commenter</option>
              <option value="writer">Editor</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={adding || !email.trim()}
            className="btn-primary mt-3 w-full py-2 text-sm flex items-center justify-center gap-2"
          >
            {adding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {adding ? 'Adding...' : 'Add'}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-500 px-4 pt-3">{error}</p>
        )}

        {/* Current permissions */}
        <div className="p-4 max-h-64 overflow-y-auto">
          <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            People with access
          </p>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400 dark:text-zinc-500" />
            </div>
          ) : permissions.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-4">
              No permissions found
            </p>
          ) : (
            <div className="space-y-2">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 dark:text-zinc-200 truncate">
                      {perm.displayName || perm.emailAddress || perm.type}
                    </p>
                    {perm.emailAddress && (
                      <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">
                        {perm.emailAddress}
                      </p>
                    )}
                  </div>
                  <span className="badge text-xs flex-shrink-0 ml-2">
                    {ROLE_LABELS[perm.role] || perm.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
