'use client';

import { useState } from 'react';
import {
  X,
  ExternalLink,
  Share2,
  Pencil,
  Trash2,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DriveFile, getFileEmoji, getPreviewUrl, isGoogleDoc, formatFileSize } from './driveUtils';

interface FilePreviewProps {
  file: DriveFile;
  onClose: () => void;
  onDelete: (file: DriveFile) => void;
  onShare: (file: DriveFile) => void;
  onRename: (file: DriveFile) => void;
}

export default function FilePreview({
  file,
  onClose,
  onDelete,
  onShare,
  onRename,
}: FilePreviewProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(isGoogleDoc(file.mimeType));

  const previewUrl = getPreviewUrl(file);
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';
  const isEditable = isGoogleDoc(file.mimeType);

  const renderPreviewContent = () => {
    if (previewUrl) {
      return (
        <div className="relative flex-1 min-h-0">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 dark:text-zinc-500 text-sm">
                <div className="animate-pulse">Loading {isEditable ? 'editor' : 'preview'}...</div>
              </div>
            </div>
          )}
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            style={{ borderRadius: fullscreen ? 0 : 8 }}
            onLoad={() => setIframeLoaded(true)}
            title={file.name}
            allow="clipboard-read; clipboard-write"
          />
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <img
            src={`/api/drive/${file.id}?download=true`}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      );
    }

    if (isPdf && file.webViewLink) {
      return (
        <div className="relative flex-1 min-h-0">
          <iframe
            src={file.webViewLink}
            className="w-full h-full border-0 rounded-lg"
            title={file.name}
          />
        </div>
      );
    }

    // Fallback: show metadata + open in Google Drive
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 p-8">
        <span className="text-6xl">{getFileEmoji(file.mimeType)}</span>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-zinc-200 text-center">
          {file.name}
        </h3>
        <div className="space-y-2 text-sm text-gray-500 dark:text-zinc-400 text-center">
          <p>Type: {file.mimeType}</p>
          {file.size && <p>Size: {formatFileSize(file.size)}</p>}
          {file.modifiedTime && (
            <p>Modified: {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}</p>
          )}
          {file.owners?.[0] && <p>Owner: {file.owners[0].displayName}</p>}
        </div>
        <div className="flex gap-2 mt-4">
          {file.webViewLink && (
            <a
              href={file.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Google Drive
            </a>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={`bg-surface-1 border border-border shadow-2xl flex flex-col transition-all duration-300 ${
          fullscreen
            ? 'fixed inset-0 rounded-none'
            : 'rounded-2xl w-full max-w-5xl h-[85vh] mx-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg">{getFileEmoji(file.mimeType)}</span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 truncate">
              {file.name}
            </h2>
            {isEditable && (
              <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-2 py-0.5 rounded-full">
                Editing
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost p-2"
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={() => onShare(file)} className="btn-ghost p-2" title="Share">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onRename(file)} className="btn-ghost p-2" title="Rename">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(file)} className="btn-ghost p-2 text-red-500 hover:text-red-600" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => setFullscreen(!fullscreen)} className="btn-ghost p-2" title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose} className="btn-ghost p-2" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {renderPreviewContent()}
      </div>
    </div>
  );
}
