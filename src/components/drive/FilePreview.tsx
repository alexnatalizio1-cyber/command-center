'use client';

import { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Share2,
  Pencil,
  Trash2,
  Maximize2,
  Minimize2,
  Edit3,
  ArrowLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { DriveFile, getFileEmoji, getEditUrl, isGoogleDoc, formatFileSize } from './driveUtils';

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
  const [iframeError, setIframeError] = useState(false);
  const [fullscreen, setFullscreen] = useState(true);

  const isImage = file.mimeType.startsWith('image/');
  const isEditable = isGoogleDoc(file.mimeType);
  const editUrl = getEditUrl(file);

  // For Google Docs, use the webViewLink which Google provides specifically for embedding
  // For images, use thumbnail API
  // For everything else, use Drive's file viewer
  const getIframeUrl = (): string | null => {
    if (isEditable && file.webViewLink) {
      // webViewLink is the most reliable — Google generates it specifically for this file
      return file.webViewLink;
    }
    if (isImage) {
      return null; // render as <img> instead
    }
    if (file.webViewLink) {
      return file.webViewLink;
    }
    return `https://drive.google.com/file/d/${file.id}/view`;
  };

  const iframeUrl = getIframeUrl();

  // Detect iframe load failures
  useEffect(() => {
    if (!iframeUrl) return;
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setIframeError(true);
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [iframeUrl, iframeLoaded]);

  const renderContent = () => {
    // Images — render directly
    if (isImage) {
      return (
        <div className="flex-1 min-h-0 flex items-center justify-center p-6 bg-black/5 dark:bg-black/20">
          <img
            src={`https://lh3.googleusercontent.com/d/${file.id}=w1600`}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
            onError={(e) => {
              // Fallback to Drive thumbnail
              (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1200`;
            }}
          />
        </div>
      );
    }

    // Google Docs/Sheets/Slides/etc — iframe with fallback
    if (iframeUrl) {
      return (
        <div className="relative flex-1 min-h-0">
          {!iframeLoaded && !iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 z-10">
              <div className="text-center">
                <div className="animate-pulse text-gray-400 dark:text-zinc-500 text-sm mb-2">
                  Loading document...
                </div>
              </div>
            </div>
          )}
          {iframeError && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-1 z-10">
              <div className="text-center space-y-4">
                <span className="text-5xl block">{getFileEmoji(file.mimeType)}</span>
                <h3 className="text-base font-semibold text-gray-800 dark:text-zinc-200">
                  Unable to embed this document
                </h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md">
                  Google restricts embedding some documents. You can open it directly:
                </p>
                <div className="flex gap-2 justify-center">
                  {editUrl && (
                    <a
                      href={editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary px-4 py-2.5 text-sm flex items-center gap-2"
                    >
                      <Edit3 className="w-4 h-4" />
                      Open & Edit
                    </a>
                  )}
                  {file.webViewLink && editUrl !== file.webViewLink && (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost px-4 py-2.5 text-sm flex items-center gap-2 border border-border"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View in Drive
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoaded(true)}
            title={file.name}
            allow="clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-popups-to-escape-sandbox allow-top-navigation"
          />
        </div>
      );
    }

    // Fallback — metadata display
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
        </div>
        <div className="flex gap-2 mt-4">
          {editUrl && (
            <a href={editUrl} target="_blank" rel="noopener noreferrer" className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              <Edit3 className="w-4 h-4" /> Open & Edit
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
            : 'rounded-2xl w-full max-w-6xl h-[90vh] mx-4'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button onClick={onClose} className="btn-ghost p-1.5" title="Back">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-lg">{getFileEmoji(file.mimeType)}</span>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 truncate">
              {file.name}
            </h2>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Edit in new tab button for Google Docs */}
            {isEditable && editUrl && (
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent-dim transition-all mr-2"
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </a>
            )}

            {file.webViewLink && (
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" className="btn-ghost p-2" title="Open in new tab">
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
            <button onClick={() => setFullscreen(!fullscreen)} className="btn-ghost p-2">
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onClose} className="btn-ghost p-2" title="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {renderContent()}
      </div>
    </div>
  );
}
