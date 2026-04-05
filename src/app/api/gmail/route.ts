import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const { searchParams } = new URL(req.url);
    const label = searchParams.get('label') || 'INBOX';
    const q = searchParams.get('q') || '';
    const maxResults = parseInt(searchParams.get('maxResults') || '20', 10);
    const pageToken = searchParams.get('pageToken') || undefined;

    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults,
      labelIds: [label],
      q: q || undefined,
      pageToken,
    });

    const messages = await Promise.all(
      (res.data.messages || []).map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });
        const headers = detail.data.payload?.headers || [];
        return {
          id: msg.id,
          threadId: detail.data.threadId,
          from: headers.find((h) => h.name === 'From')?.value || '',
          subject: headers.find((h) => h.name === 'Subject')?.value || '',
          date: headers.find((h) => h.name === 'Date')?.value || '',
          snippet: detail.data.snippet || '',
          unread: detail.data.labelIds?.includes('UNREAD') || false,
          labelIds: detail.data.labelIds || [],
        };
      })
    );

    return NextResponse.json({
      messages,
      nextPageToken: res.data.nextPageToken || null,
      resultSizeEstimate: res.data.resultSizeEstimate || 0,
    });
  } catch (error: any) {
    return apiError(error);
  }
}
