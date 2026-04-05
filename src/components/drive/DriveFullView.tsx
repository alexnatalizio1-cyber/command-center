'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  LayoutGrid,
  List,
  Plus,
  Upload,
  FileText,
  Table,
  Presentation,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import Breadcrumbs, { BreadcrumbItem } from './Breadcrumbs';
import FileGrid from './FileGrid';
import FileList from './FileList';
import UploadZone, { triggerUpload } from './UploadZone';
import FilePreview from './FilePreview';
import ShareModal from './ShareModal';
import NewDocModal from './NewDocModal';
import { DriveFile } from './driveUtils';

export default function DriveFullView() {
  // Navigation state
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Files state
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // View
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals / overlays
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [shareFile, setShareFile] = useState<DriveFile | null>(null);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [showNewMenu, setShowNewMenu] = useState(false);

  // Rename
  const [renameFile, setRenameFile] = useState<DriveFile | null>(null);
  const [renameName, setRenameName] = useState('');

  const fetchFiles = useCallback(
    async (pageToken?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('folderId', currentFolderId);
        if (searchQuery) params.set('q', searchQuery);
        if (pageToken) params.set('pageToken', pageToken);

        const res = await fetch(`/api/drive?${params.toString()}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        if (pageToken) {
          setFiles((prev) => [...prev, ...(data.files || [])]);
        } else {
          setFiles(data.files || []);
        }
        setNextPageToken(data.nextPageToken || null);
      } catch (err: any) {
        console.error('Failed to fetch files:', err);
      } finally {
        setLoading(false);
      }
    },
    [currentFolderId, searchQuery]
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Navigation
  const handleFolderOpen = (file: DriveFile) => {
    setCurrentFolderId(file.id);
    setBreadcrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
    setSearchQuery('');
    setSearchInput('');
  };

  const handleBreadcrumbNavigate = (folderId: string, index: number) => {
    setCurrentFolderId(folderId);
    if (index < 0) {
      setBreadcrumbs([]);
    } else {
      setBreadcrumbs((prev) => prev.slice(0, index + 1));
    }
    setSearchQuery('');
    setSearchInput('');
  };

  // Search
  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  // File actions
  const handleDelete = async (file: DriveFile) => {
    if (!confirm(`Move "${file.name}" to trash?`)) return;
    try {
      await fetch(`/api/drive/${file.id}`, { method: 'DELETE' });
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      if (previewFile?.id === file.id) setPreviewFile(null);
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleRenameSubmit = async () => {
    if (!renameFile || !renameName.trim()) return;
    try {
      await fetch(`/api/drive/${renameFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      setFiles((prev) =>
        prev.map((f) => (f.id === renameFile.id ? { ...f, name: renameName.trim() } : f))
      );
      setRenameFile(null);
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const startRename = (file: DriveFile) => {
    setRenameFile(file);
    setRenameName(file.name);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <Breadcrumbs breadcrumbs={breadcrumbs} onNavigate={handleBreadcrumbNavigate} />

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Refresh */}
            <button
              onClick={() => fetchFiles()}
              className="btn-ghost p-2 rounded-lg"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            {/* View toggle */}
            <div className="flex items-center bg-surface-2 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-surface-1 shadow-sm text-gray-800 dark:text-zinc-200'
                    : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-surface-1 shadow-sm text-gray-800 dark:text-zinc-200'
                    : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* New button */}
            <div className="relative">
              <button
                onClick={() => setShowNewMenu(!showNewMenu)}
                className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New
                <ChevronDown className="w-3 h-3" />
              </button>
              {showNewMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNewMenu(false)} />
                  <div className="absolute right-0 top-10 z-20 w-52 bg-surface-1 border border-border rounded-xl shadow-lg py-1">
                    <button
                      onClick={() => {
                        setShowNewMenu(false);
                        triggerUpload();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                    >
                      <Upload className="w-4 h-4" /> Upload File
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setShowNewMenu(false);
                        setShowNewDoc(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                    >
                      <FileText className="w-4 h-4" /> New Document
                    </button>
                    <button
                      onClick={() => {
                        setShowNewMenu(false);
                        setShowNewDoc(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                    >
                      <Table className="w-4 h-4" /> New Spreadsheet
                    </button>
                    <button
                      onClick={() => {
                        setShowNewMenu(false);
                        setShowNewDoc(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                    >
                      <Presentation className="w-4 h-4" /> New Presentation
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            placeholder="Search in Drive..."
            className="input-base w-full pl-9 pr-8 py-2 text-sm"
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && files.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-zinc-500" />
        </div>
      )}

      {/* File area */}
      {(!loading || files.length > 0) && (
        <UploadZone folderId={currentFolderId} onUploadComplete={() => fetchFiles()}>
          <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            {viewMode === 'grid' ? (
              <FileGrid
                files={files}
                onFileClick={setPreviewFile}
                onFolderOpen={handleFolderOpen}
                onRename={startRename}
                onShare={setShareFile}
                onDelete={handleDelete}
              />
            ) : (
              <FileList
                files={files}
                onFileClick={setPreviewFile}
                onFolderOpen={handleFolderOpen}
                onRename={startRename}
                onShare={setShareFile}
                onDelete={handleDelete}
              />
            )}

            {/* Load more */}
            {nextPageToken && (
              <div className="flex justify-center py-4">
                <button
                  onClick={() => fetchFiles(nextPageToken)}
                  disabled={loading}
                  className="btn-ghost px-4 py-2 text-sm text-gray-600 dark:text-zinc-400"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        </UploadZone>
      )}

      {/* Modals */}
      {previewFile && (
        <FilePreview
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDelete={handleDelete}
          onShare={(f) => {
            setPreviewFile(null);
            setShareFile(f);
          }}
          onRename={(f) => {
            setPreviewFile(null);
            startRename(f);
          }}
        />
      )}

      {shareFile && (
        <ShareModal
          fileId={shareFile.id}
          fileName={shareFile.name}
          onClose={() => setShareFile(null)}
        />
      )}

      {showNewDoc && (
        <NewDocModal
          folderId={currentFolderId}
          onClose={() => setShowNewDoc(false)}
          onCreated={() => fetchFiles()}
        />
      )}

      {/* Rename dialog */}
      {renameFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-1 rounded-2xl border border-border shadow-2xl w-full max-w-sm mx-4 p-4">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-3">Rename</h3>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSubmit();
                if (e.key === 'Escape') setRenameFile(null);
              }}
              className="input-base w-full px-3 py-2 text-sm mb-3"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameFile(null)}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="btn-primary px-3 py-1.5 text-sm"
                disabled={!renameName.trim()}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
