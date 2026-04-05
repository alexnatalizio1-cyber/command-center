import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const gmail = google.gmail({ version: 'v1', auth });

    const res = await gmail.users.labels.list({ userId: 'me' });
    const labels = res.data.labels || [];

    const detailed = await Promise.all(
      labels.map(async (label) => {
        try {
          const detail = await gmail.users.labels.get({
            userId: 'me',
            id: label.id!,
          });
          return {
            id: detail.data.id,
            name: detail.data.name,
            type: detail.data.type,
            unreadCount: detail.data.messagesUnread || 0,
            totalCount: detail.data.messagesTotal || 0,
          };
        } catch {
          return {
            id: label.id,
            name: label.name,
            type: label.type,
            unreadCount: 0,
            totalCount: 0,
          };
        }
      })
    );

    return NextResponse.json({ labels: detailed });
  } catch (error: any) {
    return apiError(error);
  }
}
