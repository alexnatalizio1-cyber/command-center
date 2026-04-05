'use client';

import { useState, useRef, useCallback, DragEvent, ReactNode } from 'react';
import { Upload } from 'lucide-react';

interface UploadZoneProps {
  folderId: string;
  onUploadComplete: () => void;
  children: ReactNode;
}

export default function UploadZone({ folderId, onUploadComplete, children }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const uploadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setIsUploading(true);
      setProgress(0);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folderId', folderId);

        try {
          await fetch('/api/drive', {
            method: 'POST',
            body: formData,
          });
        } catch (err) {
          console.error('Upload failed:', err);
        }
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      setIsUploading(false);
      setProgress(0);
      onUploadComplete();
    },
    [folderId, onUploadComplete]
  );

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = () => {
    if (fileInputRef.current?.files) {
      uploadFiles(fileInputRef.current.files);
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className="relative flex-1 min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        id="drive-upload-input"
      />

      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent/5 border-2 border-dashed border-accent rounded-xl backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-accent" />
            <p className="text-sm font-medium text-accent">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute bottom-4 left-4 right-4 z-30">
          <div className="bg-surface-1 border border-border rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">Uploading...</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">{progress}%</p>
            </div>
            <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export the trigger function for external use
export function triggerUpload() {
  const input = document.getElementById('drive-upload-input') as HTMLInputElement;
  input?.click();
}
