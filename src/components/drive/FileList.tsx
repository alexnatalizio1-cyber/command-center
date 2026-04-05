'use client';

import { useState } from 'react';
import { MoreVertical, ExternalLink, Pencil, Share2, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DriveFile, getFileEmoji, formatFileSize } from './driveUtils';

interface FileListProps {
  files: DriveFile[];
  onFileClick: (file: DriveFile) => void;
  onFolderOpen: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onDelete: (file: DriveFile) => void;
}

type SortKey = 'name' | 'modifiedTime' | 'size';
type SortDir = 'asc' | 'desc';

export default function FileList({
  files,
  onFileClick,
  onFolderOpen,
  onRename,
  onShare,
  onDelete,
}: FileListProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const folders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
  const nonFolders = files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

  const sortFiles = (list: DriveFile[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'modifiedTime') {
        cmp = new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
      } else if (sortKey === 'size') {
        cmp = parseInt(a.size || '0', 10) - parseInt(b.size || '0', 10);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  };

  const sorted = [...sortFiles(folders), ...sortFiles(nonFolders)];

  const handleClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      onFolderOpen(file);
    } else {
      onFileClick(file);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ArrowDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th
              className="pb-2 px-3 font-medium text-gray-500 dark:text-zinc-400 cursor-pointer select-none"
              onClick={() => handleSort('name')}
            >
              Name <SortIcon column="name" />
            </th>
            <th className="pb-2 px-3 font-medium text-gray-500 dark:text-zinc-400 hidden sm:table-cell">
              Owner
            </th>
            <th
              className="pb-2 px-3 font-medium text-gray-500 dark:text-zinc-400 cursor-pointer select-none hidden md:table-cell"
              onClick={() => handleSort('modifiedTime')}
            >
              Modified <SortIcon column="modifiedTime" />
            </th>
            <th
              className="pb-2 px-3 font-medium text-gray-500 dark:text-zinc-400 cursor-pointer select-none hidden lg:table-cell"
              onClick={() => handleSort('size')}
            >
              Size <SortIcon column="size" />
            </th>
            <th className="pb-2 px-3 w-10" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((file) => (
            <tr
              key={file.id}
              onClick={() => handleClick(file)}
              className="group border-b border-border/50 hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base flex-shrink-0">{getFileEmoji(file.mimeType)}</span>
                  <span className="truncate text-gray-800 dark:text-zinc-200">{file.name}</span>
                </div>
              </td>
              <td className="py-2.5 px-3 text-gray-500 dark:text-zinc-400 hidden sm:table-cell">
                {file.owners?.[0]?.displayName || '--'}
              </td>
              <td className="py-2.5 px-3 text-gray-500 dark:text-zinc-400 hidden md:table-cell whitespace-nowrap">
                {file.modifiedTime
                  ? formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })
                  : '--'}
              </td>
              <td className="py-2.5 px-3 text-gray-500 dark:text-zinc-400 hidden lg:table-cell whitespace-nowrap">
                {formatFileSize(file.size)}
              </td>
              <td className="py-2.5 px-3 relative">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="absolute right-3 top-10 z-20 w-44 bg-surface-1 border border-border rounded-xl shadow-lg py-1">
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
              </td>
            </tr>
          ))}
          {files.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-16 text-gray-400 dark:text-zinc-500">
                This folder is empty
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
