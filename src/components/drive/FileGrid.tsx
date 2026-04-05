'use client';

import { useState } from 'react';
import { MoreVertical, ExternalLink, Pencil, FolderInput, Share2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DriveFile, getFileEmoji } from './driveUtils';

interface FileGridProps {
  files: DriveFile[];
  onFileClick: (file: DriveFile) => void;
  onFolderOpen: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
}

export default function FileGrid({
  files,
  onFileClick,
  onFolderOpen,
  onRename,
  onShare,
  onDelete,
}: FileGridProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const folders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
  const nonFolders = files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');
  const sorted = [...folders, ...nonFolders];

  const handleClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      onFolderOpen(file);
    } else {
      onFileClick(file);
    }
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {sorted.map((file) => (
        <div
          key={file.id}
          onClick={() => handleClick(file)}
          className="group relative flex flex-col items-center gap-2 p-4 rounded-xl border border-transparent hover:border-border hover:bg-surface-2 cursor-pointer transition-all duration-200"
        >
          <span className="text-3xl">{getFileEmoji(file.mimeType)}</span>
          <div className="w-full text-center">
            <p className="text-[13px] text-gray-800 dark:text-zinc-200 truncate" title={file.name}>
              {file.name}
            </p>
            {file.modifiedTime && (
              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
              </p>
            )}
          </div>

          {/* Three-dot menu */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(menuOpen === file.id ? null : file.id);
              }}
              className="btn-ghost p-1 rounded-lg"
            >
              <MoreVertical className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
            </button>
            {menuOpen === file.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(null);
                  }}
                />
                <div className="absolute right-0 top-8 z-20 w-44 bg-surface-1 border border-border rounded-xl shadow-lg py-1">
                  {file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                    >
                      <ExternalLink className="w-4 h-4" /> Open
                    </a>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(null);
                      onRename(file);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                  >
                    <Pencil className="w-4 h-4" /> Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(null);
                      onShare(file);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-surface-2"
                  >
                    <Share2 className="w-4 h-4" /> Share
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(null);
                      onDelete(file);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-surface-2"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}

      {files.length === 0 && (
        <div className="col-span-full text-center py-16">
          <p className="text-sm text-gray-400 dark:text-zinc-500">This folder is empty</p>
        </div>
      )}
    </div>
  );
}
