import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    const docId = params.id;

    // Get file metadata (for description/metadata)
    const fileMeta = await drive.files.get({
      fileId: docId,
      fields: 'id,name,description,modifiedTime,createdTime',
    });

    // Get document content
    const doc = await docs.documents.get({ documentId: docId });
    const content = extractDocText(doc.data);

    let meta = { pinned: false, color: 'border-l-gray-400 dark:border-l-zinc-600' };
    try {
      if (fileMeta.data.description) {
        const parsed = JSON.parse(fileMeta.data.description);
        meta = { pinned: parsed.pinned === true, color: parsed.color || meta.color };
      }
    } catch {
      // not JSON
    }

    return NextResponse.json({
      note: {
        id: fileMeta.data.id,
        title: fileMeta.data.name,
        content,
        pinned: meta.pinned,
        color: meta.color,
        createdAt: fileMeta.data.createdTime,
        updatedAt: fileMeta.data.modifiedTime,
      },
    });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    const docId = params.id;
    const body = await req.json();
    const { title, content, pinned, color } = body;

    // Update file name and/or description metadata
    if (title !== undefined || pinned !== undefined || color !== undefined) {
      // Get current description to merge
      const currentFile = await drive.files.get({
        fileId: docId,
        fields: 'description,name',
      });

      let meta = { pinned: false, color: 'border-l-gray-400 dark:border-l-zinc-600' };
      try {
        if (currentFile.data.description) {
          const parsed = JSON.parse(currentFile.data.description);
          meta = { pinned: parsed.pinned === true, color: parsed.color || meta.color };
        }
      } catch {
        // not JSON
      }

      if (pinned !== undefined) meta.pinned = pinned;
      if (color !== undefined) meta.color = color;

      const updateBody: Record<string, string> = {
        description: JSON.stringify(meta),
      };
      if (title !== undefined) updateBody.name = title;

      await drive.files.update({
        fileId: docId,
        requestBody: updateBody,
      });
    }

    // Update content by replacing all text
    if (content !== undefined) {
      // First get the current doc to find the end index
      const doc = await docs.documents.get({ documentId: docId });
      const bodyContent = doc.data.body?.content || [];
      let endIndex = 1;
      for (const element of bodyContent) {
        if (element.endIndex && element.endIndex > endIndex) {
          endIndex = element.endIndex;
        }
      }

      const requests: any[] = [];

      // Delete existing content (if any beyond the initial newline)
      if (endIndex > 2) {
        requests.push({
          deleteContentRange: {
            range: { startIndex: 1, endIndex: endIndex - 1 },
          },
        });
      }

      // Insert new content
      if (content) {
        requests.push({
          insertText: {
            location: { index: 1 },
            text: content,
          },
        });
      }

      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });

    await drive.files.update({
      fileId: params.id,
      requestBody: { trashed: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

function extractDocText(doc: any): string {
  const content = doc.body?.content || [];
  const parts: string[] = [];
  for (const element of content) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements || []) {
        if (el.textRun?.content) {
          parts.push(el.textRun.content);
        }
      }
    }
  }
  // The doc always ends with a trailing newline; trim it
  const text = parts.join('');
  return text.endsWith('\n') ? text.slice(0, -1) : text;
}
