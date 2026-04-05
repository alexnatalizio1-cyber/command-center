import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const tasks = google.tasks({ version: 'v1', auth });
    const body = await req.json();
    const { status, title, notes, listId } = body;
    const taskId = params.id;

    // We need the list ID to update a task. Try from body or search all lists.
    let taskListId = listId;
    if (!taskListId) {
      taskListId = await findTaskList(tasks, taskId);
    }
    if (!taskListId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateBody: Record<string, string> = {};
    if (status) updateBody.status = status;
    if (title !== undefined) updateBody.title = title;
    if (notes !== undefined) updateBody.notes = notes;

    // If completing, set completed timestamp
    if (status === 'completed') {
      updateBody.completed = new Date().toISOString();
    }

    const res = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: updateBody,
    });

    return NextResponse.json({
      task: {
        id: res.data.id,
        title: res.data.title,
        status: res.data.status,
        completed: res.data.status === 'completed',
        notes: res.data.notes || '',
      },
    });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const tasks = google.tasks({ version: 'v1', auth });
    const taskId = params.id;

    const url = new URL(req.url);
    let taskListId = url.searchParams.get('listId');
    if (!taskListId) {
      taskListId = await findTaskList(tasks, taskId);
    }
    if (!taskListId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message === 'Not authenticated') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    return apiError(error);
  }
}

async function findTaskList(
  tasks: ReturnType<typeof google.tasks>,
  taskId: string,
): Promise<string | null> {
  const listRes = await tasks.tasklists.list({ maxResults: 100 });
  const lists = listRes.data.items || [];
  for (const list of lists) {
    try {
      await tasks.tasks.get({ tasklist: list.id!, task: taskId });
      return list.id!;
    } catch {
      // Not in this list, continue
    }
  }
  return null;
}
