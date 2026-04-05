import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';
import { Readable } from 'stream';

export async function GET(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId') || 'root';
    const q = searchParams.get('q') || '';
    const pageToken = searchParams.get('pageToken') || undefined;

    const queryParts: string[] = ['trashed = false'];
    if (q) {
      queryParts.push(`name contains '${q.replace(/'/g, "\\'")}'`);
    } else {
      queryParts.push(`'${folderId}' in parents`);
    }

    const res = await drive.files.list({
      pageSize: 50,
      orderBy: 'folder,modifiedTime desc',
      fields:
        'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, iconLink, size, parents, owners)',
      q: queryParts.join(' and '),
      pageToken,
    });

    const files = (res.data.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      iconLink: file.iconLink,
      size: file.size || null,
      parents: file.parents || [],
      owners: (file.owners || []).map((o) => ({
        displayName: o.displayName,
        emailAddress: o.emailAddress,
        photoLink: o.photoLink,
      })),
    }));

    return NextResponse.json({
      files,
      nextPageToken: res.data.nextPageToken || null,
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folderId = (formData.get('folderId') as string) || 'root';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const res = await drive.files.create({
      requestBody: {
        name: file.name,
        parents: [folderId],
      },
      media: {
        mimeType: file.type || 'application/octet-stream',
        body: Readable.from(buffer),
      },
      fields: 'id, name, mimeType, modifiedTime, webViewLink, iconLink, size, parents',
    });

    return NextResponse.json({ file: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}
