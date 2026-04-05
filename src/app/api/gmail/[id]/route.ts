import { NextRequest, NextResponse } from 'next/server';
import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

function getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';
}

function extractBody(payload: gmail_v1.Schema$MessagePart): { html: string; text: string } {
  let html = '';
  let text = '';

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    html = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  } else if (payload.mimeType === 'text/plain' && payload.body?.data) {
    text = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested.html) html = nested.html;
      if (nested.text && !text) text = nested.text;
    }
  }

  return { html, text };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const { id } = params;

    const res = await gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });

    const headers = res.data.payload?.headers || [];
    const { html, text } = extractBody(res.data.payload!);
    const body = html || `<pre style="white-space:pre-wrap;font-family:inherit">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;

    return NextResponse.json({
      id: res.data.id,
      threadId: res.data.threadId,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      cc: getHeader(headers, 'Cc'),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date'),
      body,
      snippet: res.data.snippet || '',
      unread: res.data.labelIds?.includes('UNREAD') || false,
      labelIds: res.data.labelIds || [],
    });
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
    const gmail = google.gmail({ version: 'v1', auth });
    const { id } = params;
    const body = await req.json();

    const res = await gmail.users.messages.modify({
      userId: 'me',
      id,
      requestBody: {
        addLabelIds: body.addLabelIds || [],
        removeLabelIds: body.removeLabelIds || [],
      },
    });

    return NextResponse.json({ id: res.data.id, labelIds: res.data.labelIds });
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
    const gmail = google.gmail({ version: 'v1', auth });
    const { id } = params;

    await gmail.users.messages.trash({ userId: 'me', id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return apiError(error);
  }
}
