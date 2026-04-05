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
  // Google Docs/Sheets/Slides — use the pub embed URLs that work in iframes
  if (file.mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${file.id}/pub?embedded=true`;
  }
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${file.id}/pubhtml?widget=true`;
  }
  if (file.mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${file.id}/embed`;
  }
  if (file.mimeType === 'application/vnd.google-apps.form') {
    return `https://docs.google.com/forms/d/${file.id}/viewform?embedded=true`;
  }
  // PDFs and other files — use Google's viewer
  if (file.mimeType === 'application/pdf' || !file.mimeType.startsWith('application/vnd.google-apps.')) {
    if (file.webViewLink) {
      return `https://drive.google.com/file/d/${file.id}/preview`;
    }
  }
  return null;
}

export function getEditUrl(file: DriveFile): string | null {
  if (file.mimeType === 'application/vnd.google-apps.document') {
    return `https://docs.google.com/document/d/${file.id}/edit`;
  }
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
  }
  if (file.mimeType === 'application/vnd.google-apps.presentation') {
    return `https://docs.google.com/presentation/d/${file.id}/edit`;
  }
  if (file.mimeType === 'application/vnd.google-apps.form') {
    return `https://docs.google.com/forms/d/${file.id}/edit`;
  }
  return file.webViewLink || null;
}

export function isGoogleDoc(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.google-apps.') && mimeType !== 'application/vnd.google-apps.folder';
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
