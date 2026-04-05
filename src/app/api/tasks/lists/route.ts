import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET() {
  try {
    const { auth } = await getAuthenticatedClient();
    const tasks = google.tasks({ version: 'v1', auth });
    const res = await tasks.tasklists.list({ maxResults: 100 });
    const lists = (res.data.items || []).map((l) => ({
      id: l.id,
      title: l.title,
    }));
    return NextResponse.json({ lists });
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
    const tasks = google.tasks({ version: 'v1', auth });
    const body = await req.json();
    const { title } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const res = await tasks.tasklists.insert({
      requestBody: { title },
    });

    return NextResponse.json({
      list: { id: res.data.id, title: res.data.title },
    });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}
