import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

const TYPE_TO_MIME: Record<string, string> = {
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
};

export async function POST(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const body = await req.json();

    const { name, type, folderId } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'name and type are required' },
        { status: 400 }
      );
    }

    const mimeType = TYPE_TO_MIME[type];
    if (!mimeType) {
      return NextResponse.json(
        { error: `Invalid type: ${type}. Must be document, spreadsheet, or presentation` },
        { status: 400 }
      );
    }

    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType,
        parents: folderId ? [folderId] : undefined,
      },
      fields: 'id, name, mimeType, modifiedTime, webViewLink, iconLink, parents',
    });

    return NextResponse.json({ file: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}
