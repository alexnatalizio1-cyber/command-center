export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
  iconLink?: string;
  size?: string | null;
  parents?: string[];
  owners?: { displayName: string; emailAddress: string; photoLink?: string }[];
}

const MIME_EMOJI: Record<string, string> = {
  'application/vnd.google-apps.folder': '\uD83D\uDCC1',
  'application/vnd.google-apps.document': '\uD83D\uDCC4',
  'application/vnd.google-apps.spreadsheet': '\uD83D\uDCCA',
  'application/vnd.google-apps.presentation': '\uD83D\uDCFD\uFE0F',
  'application/vnd.google-apps.form': '\uD83D\uDCCB',
  'application/pdf': '\uD83D\uDCD5',
};

const MIME_PREFIX_EMOJI: Record<string, string> = {
  'image/': '\uD83D\uDDBC\uFE0F',
  'video/': '\uD83C\uDFAC',
  'audio/': '\uD83C\uDFB5',
};

export function getFileEmoji(mimeType: string): string {
  if (MIME_EMOJI[mimeType]) return MIME_EMOJI[mimeType];
  for (const [prefix, emoji] of Object.entries(MIME_PREFIX_EMOJI)) {
    if (mimeType.startsWith(prefix)) return emoji;
  }
  return '\uD83D\uDCC4';
}

export function getPreviewUrl(file: DriveFile): string | null {
  if (file.mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${file.id}/preview`;
  }
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${file.id}/preview`;
  }
  if (file.mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${file.id}/preview`;
  }
  return null;
}

export function formatFileSize(bytes: string | null | undefined): string {
  if (!bytes) return '--';
  const size = parseInt(bytes, 10);
  if (isNaN(size) || size === 0) return '--';
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = size;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
