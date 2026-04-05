import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

function buildRawMessage(options: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  from?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines: string[] = [];
  lines.push(`To: ${options.to}`);
  if (options.cc) lines.push(`Cc: ${options.cc}`);
  if (options.bcc) lines.push(`Bcc: ${options.bcc}`);
  if (options.from) lines.push(`From: ${options.from}`);
  lines.push(`Subject: ${options.subject}`);
  if (options.inReplyTo) lines.push(`In-Reply-To: ${options.inReplyTo}`);
  if (options.references) lines.push(`References: ${options.references}`);
  lines.push('MIME-Version: 1.0');
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('');
  lines.push(options.body);

  return lines.join('\r\n');
}

export async function POST(req: NextRequest) {
  try {
    const { auth, session } = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const body = await req.json();

    const { to, cc, bcc, subject, body: messageBody, inReplyTo, references, threadId } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'To and Subject are required' }, { status: 400 });
    }

    const raw = buildRawMessage({
      to,
      cc,
      bcc,
      subject,
      body: messageBody,
      from: (session as any)?.user?.email || '',
      inReplyTo,
      references,
    });

    const encodedMessage = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
        threadId: threadId || undefined,
      },
    });

    return NextResponse.json({ id: res.data.id, threadId: res.data.threadId });
  } catch (error: any) {
    return apiError(error);
  }
}
