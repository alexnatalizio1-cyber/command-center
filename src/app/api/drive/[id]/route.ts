import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const { id } = params;

    const res = await drive.files.get({
      fileId: id,
      fields:
        'id, name, mimeType, modifiedTime, webViewLink, iconLink, size, parents, owners, thumbnailLink, webContentLink',
    });

    return NextResponse.json({ file: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const { id } = params;
    const body = await req.json();

    const res = await drive.files.update({
      fileId: id,
      requestBody: {
        name: body.name,
      },
      addParents: body.addParents,
      removeParents: body.removeParents,
      fields: 'id, name, mimeType, modifiedTime, webViewLink, parents',
    });

    return NextResponse.json({ file: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const { id } = params;

    await drive.files.update({
      fileId: id,
      requestBody: { trashed: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return apiError(error);
  }
}
