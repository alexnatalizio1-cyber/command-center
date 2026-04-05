import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

const FOLDER_NAME = 'Command Center Notes';

async function getOrCreateFolder(drive: ReturnType<typeof google.drive>): Promise<string> {
  // Search for existing folder
  const res = await drive.files.list({
    q: `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  return folder.data.id!;
}

interface NoteMetadata {
  pinned: boolean;
  color: string;
}

function parseDescription(desc: string | null | undefined): NoteMetadata {
  try {
    if (desc) {
      const parsed = JSON.parse(desc);
      return {
        pinned: parsed.pinned === true,
        color: parsed.color || 'border-l-gray-400 dark:border-l-zinc-600',
      };
    }
  } catch {
    // not JSON
  }
  return { pinned: false, color: 'border-l-gray-400 dark:border-l-zinc-600' };
}

export async function GET() {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    const folderId = await getOrCreateFolder(drive);

    // List all Google Docs in the folder
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and trashed=false`,
      fields: 'files(id,name,description,modifiedTime,createdTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 100,
    });

    const files = res.data.files || [];

    // Fetch preview snippet for each doc (first 100 chars)
    const notes = await Promise.all(
      files.map(async (file) => {
        let preview = '';
        try {
          const doc = await docs.documents.get({ documentId: file.id! });
          const content = doc.data.body?.content || [];
          const textParts: string[] = [];
          for (const element of content) {
            if (element.paragraph) {
              for (const el of element.paragraph.elements || []) {
                if (el.textRun?.content) {
                  textParts.push(el.textRun.content);
                }
              }
            }
            if (textParts.join('').length >= 100) break;
          }
          preview = textParts.join('').trim().slice(0, 100);
        } catch {
          preview = '';
        }

        const meta = parseDescription(file.description);

        return {
          id: file.id,
          title: file.name || 'Untitled Note',
          preview,
          pinned: meta.pinned,
          color: meta.color,
          createdAt: file.createdTime || '',
          updatedAt: file.modifiedTime || '',
        };
      }),
    );

    return NextResponse.json({ notes, folderId });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    const body = await req.json();
    const { title, content, pinned, color } = body;

    const folderId = await getOrCreateFolder(drive);

    const metadata: NoteMetadata = {
      pinned: pinned === true,
      color: color || 'border-l-gray-400 dark:border-l-zinc-600',
    };

    // Create a Google Doc in the folder
    const file = await drive.files.create({
      requestBody: {
        name: title || 'Untitled Note',
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId],
        description: JSON.stringify(metadata),
      },
      fields: 'id,name,createdTime,modifiedTime',
    });

    // Insert content if provided
    if (content) {
      await docs.documents.batchUpdate({
        documentId: file.data.id!,
        requestBody: {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: content,
              },
            },
          ],
        },
      });
    }

    return NextResponse.json({
      note: {
        id: file.data.id,
        title: file.data.name,
        preview: (content || '').slice(0, 100),
        pinned: metadata.pinned,
        color: metadata.color,
        createdAt: file.data.createdTime,
        updatedAt: file.data.modifiedTime,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}
