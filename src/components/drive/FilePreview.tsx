'use client';

import { useState } from 'react';
import {
  X,
  ExternalLink,
  Share2,
  Pencil,
  Trash2,
  Download,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DriveFile, getFileEmoji, getPreviewUrl, formatFileSize } from './driveUtils';

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

  const previewUrl = getPreviewUrl(file);
  const isImage = file.mimeType.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  const renderPreviewContent = () => {
    if (previewUrl) {
      return (
        <div className="relative flex-1 min-h-0">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-pulse text-gray-400 dark:text-zinc-500 text-sm">
                Loading preview...
              </div>
            </div>
          )}
          <iframe
            src={previewUrl}
            className="w-full h-full border-0 rounded-lg"
            onLoad={() => setIframeLoaded(true)}
            title={file.name}
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

    // Fallback: show metadata
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
            <p>
              Modified:{' '}
              {formatDistanceToNow(new Date(file.modifiedTime), { addSuffix: true })}
            </p>
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
      <div className="bg-surface-1 rounded-2xl border border-border shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xl">{getFileEmoji(file.mimeType)}</span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 truncate">
              {file.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost p-2 rounded-lg"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => onShare(file)}
              className="btn-ghost p-2 rounded-lg"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onRename(file)}
              className="btn-ghost p-2 rounded-lg"
              title="Rename"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(file)}
              className="btn-ghost p-2 rounded-lg text-red-500 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="btn-ghost p-2 rounded-lg ml-2"
              title="Close"
            >
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
