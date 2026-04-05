import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET() {
  try {
    const { auth } = await getAuthenticatedClient();
    const tasks = google.tasks({ version: 'v1', auth });

    // Fetch all task lists
    const listRes = await tasks.tasklists.list({ maxResults: 100 });
    const taskLists = listRes.data.items || [];

    // Fetch tasks from each list in parallel
    const allTasks = await Promise.all(
      taskLists.map(async (list) => {
        const tasksRes = await tasks.tasks.list({
          tasklist: list.id!,
          maxResults: 100,
          showCompleted: true,
          showHidden: true,
        });
        const items = (tasksRes.data.items || []).map((t) => ({
          id: t.id,
          title: t.title || '',
          notes: t.notes || '',
          status: t.status, // 'needsAction' | 'completed'
          completed: t.status === 'completed',
          due: t.due || null,
          updated: t.updated || '',
          listId: list.id,
          listName: list.title || 'Tasks',
          // Map priority from notes field: [priority:high] etc.
          priority: extractPriority(t.notes || ''),
        }));
        return items;
      }),
    );

    return NextResponse.json({
      tasks: allTasks.flat(),
      lists: taskLists.map((l) => ({ id: l.id, title: l.title })),
    });
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
    const { title, notes, taskListId, due, priority } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Find the target list — default to first list
    let listId = taskListId;
    if (!listId) {
      const listRes = await tasks.tasklists.list({ maxResults: 10 });
      const lists = listRes.data.items || [];
      listId = lists[0]?.id || '@default';
    }

    // Embed priority in notes field
    const fullNotes = priority && priority !== 'medium'
      ? `[priority:${priority}]${notes ? '\n' + notes : ''}`
      : notes || '';

    const res = await tasks.tasks.insert({
      tasklist: listId,
      requestBody: {
        title,
        notes: fullNotes || undefined,
        due: due ? new Date(due).toISOString() : undefined,
      },
    });

    return NextResponse.json({
      task: {
        id: res.data.id,
        title: res.data.title,
        notes: res.data.notes || '',
        status: res.data.status,
        completed: res.data.status === 'completed',
        due: res.data.due || null,
        listId,
        priority: priority || 'medium',
      },
    });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

function extractPriority(notes: string): 'low' | 'medium' | 'high' {
  const match = notes.match(/\[priority:(low|medium|high)\]/);
  return (match?.[1] as 'low' | 'medium' | 'high') || 'medium';
}
