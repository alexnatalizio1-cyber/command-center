import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentModel } from '@/lib/gemini';
import type { Content, FunctionCall, Part } from '@google/generative-ai';

interface AgentRequestBody {
  message: string;
  history?: Content[];
}

interface FunctionCallResult {
  name: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
}

type UIRefreshTarget = 'gmail' | 'calendar' | 'drive' | 'tasks' | 'notes' | 'sheets';

async function fetchLiveContext(baseUrl: string, cookies: string): Promise<{
  emails: string;
  events: string;
  tasks: string;
  notes: string;
}> {
  const headers = { Cookie: cookies };

  const [emailsRes, eventsRes, tasksRes, notesRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/gmail?maxResults=5`, { headers }),
    fetch(`${baseUrl}/api/calendar`, { headers }),
    fetch(`${baseUrl}/api/tasks`, { headers }),
    fetch(`${baseUrl}/api/notes`, { headers }),
  ]);

  let emails = 'No recent emails available.';
  if (emailsRes.status === 'fulfilled' && emailsRes.value.ok) {
    const data = await emailsRes.value.json();
    const msgs = (data.messages || []).slice(0, 5);
    if (msgs.length > 0) {
      emails = msgs
        .map((m: { id: string; from: string; subject: string; snippet: string; date: string }) =>
          `- [ID: ${m.id}] From: ${m.from} | Subject: ${m.subject} | ${m.snippet} (${m.date})`
        )
        .join('\n');
    }
  }

  let events = 'No upcoming events.';
  if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
    const data = await eventsRes.value.json();
    const evts = (data.events || []).slice(0, 5);
    if (evts.length > 0) {
      events = evts
        .map((e: { id: string; summary: string; start: string; end: string; location: string | null }) =>
          `- [ID: ${e.id}] ${e.summary} | ${e.start} - ${e.end}${e.location ? ` @ ${e.location}` : ''}`
        )
        .join('\n');
    }
  }

  let tasks = 'No tasks tracked.';
  if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
    const data = await tasksRes.value.json();
    const taskItems = (data.tasks || []).slice(0, 20);
    if (taskItems.length > 0) {
      tasks = taskItems
        .map((t: { id: string; title: string; completed: boolean; priority: string; listName: string; listId: string }) =>
          `- [ID: ${t.id}] [List: ${t.listName} (${t.listId})] [${t.completed ? 'DONE' : 'OPEN'}] ${t.title}${t.priority ? ` (${t.priority})` : ''}`
        )
        .join('\n');
    }
  }

  let notes = 'No recent notes.';
  if (notesRes.status === 'fulfilled' && notesRes.value.ok) {
    const data = await notesRes.value.json();
    const noteItems = (data.notes || []).slice(0, 10);
    if (noteItems.length > 0) {
      notes = noteItems
        .map((n: { id: string; title: string; preview: string }) =>
          `- [ID: ${n.id}] ${n.title}: ${n.preview || '(empty)'}`)
        .join('\n');
    }
  }

  return { emails, events, tasks, notes };
}

function buildContextPrompt(
  userName: string,
  userEmail: string,
  context: { emails: string; events: string; tasks: string; notes: string },
): string {
  return `
--- LIVE CONTEXT ---
User: ${userName} (${userEmail})
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Recent Emails:
${context.emails}

Upcoming Events:
${context.events}

Open Tasks (synced with Google Tasks):
${context.tasks}

Recent Notes (synced with Google Drive):
${context.notes}
--- END CONTEXT ---

Use this context to give informed, relevant responses. Reference specific emails, events, or tasks when appropriate.
When creating tasks, they will be synced to Google Tasks.
When creating notes, they will be saved as Google Docs.
For completing tasks, use the task ID from the context above along with the listId.`;
}

async function executeFunctionCall(
  fnCall: FunctionCall,
  baseUrl: string,
  cookies: string,
): Promise<{ result: Record<string, unknown>; uiTargets: UIRefreshTarget[] }> {
  const headers: Record<string, string> = {
    Cookie: cookies,
    'Content-Type': 'application/json',
  };
  const { name, args } = fnCall;
  const typedArgs = args as Record<string, unknown>;

  try {
    switch (name) {
      case 'send_email': {
        const res = await fetch(`${baseUrl}/api/gmail/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: typedArgs.to,
            subject: typedArgs.subject,
            body: typedArgs.body,
            cc: typedArgs.cc,
            bcc: typedArgs.bcc,
          }),
        });
        const data = await res.json();
        return { result: { success: res.ok, ...data }, uiTargets: ['gmail'] };
      }

      case 'reply_to_email': {
        const origRes = await fetch(`${baseUrl}/api/gmail/${typedArgs.messageId}`, { headers });
        const origData = await origRes.json();

        const res = await fetch(`${baseUrl}/api/gmail/send`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            to: origData.from,
            subject: `Re: ${origData.subject}`,
            body: typedArgs.body,
            threadId: typedArgs.threadId,
            inReplyTo: typedArgs.messageId,
            references: typedArgs.messageId,
          }),
        });
        const data = await res.json();
        return { result: { success: res.ok, ...data }, uiTargets: ['gmail'] };
      }

      case 'read_email': {
        const res = await fetch(`${baseUrl}/api/gmail/${typedArgs.messageId}`, { headers });
        const data = await res.json();
        return {
          result: {
            from: data.from,
            to: data.to,
            subject: data.subject,
            date: data.date,
            body: data.snippet || data.body?.slice(0, 1000),
          },
          uiTargets: [],
        };
      }

      case 'add_calendar_event': {
        const res = await fetch(`${baseUrl}/api/calendar`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            summary: typedArgs.summary,
            start: typedArgs.start,
            end: typedArgs.end,
            location: typedArgs.location,
            description: typedArgs.description,
            attendees: typedArgs.attendees,
          }),
        });
        const data = await res.json();
        return { result: { success: res.ok, ...data }, uiTargets: ['calendar'] };
      }

      case 'read_drive_file': {
        const res = await fetch(`${baseUrl}/api/drive/${typedArgs.fileId}`, { headers });
        const data = await res.json();
        return { result: data, uiTargets: [] };
      }

      case 'append_to_drive_file': {
        return {
          result: {
            success: false,
            message: 'Appending to Drive files requires the Docs API. Please open the file in Google Docs to edit.',
            fileId: typedArgs.fileId,
          },
          uiTargets: ['drive'],
        };
      }

      case 'update_sheet': {
        const res = await fetch(`${baseUrl}/api/sheets`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            spreadsheetId: typedArgs.spreadsheetId,
            range: typedArgs.range,
            values: typedArgs.values,
          }),
        });
        const data = await res.json();
        return { result: { success: res.ok, ...data }, uiTargets: ['sheets'] };
      }

      case 'add_task': {
        const res = await fetch(`${baseUrl}/api/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: typedArgs.title,
            priority: typedArgs.priority || 'medium',
            due: typedArgs.dueDate || typedArgs.due || null,
            taskListId: typedArgs.taskListId || null,
          }),
        });
        const data = await res.json();
        return {
          result: {
            success: res.ok,
            task: data.task,
            message: res.ok ? `Task "${typedArgs.title}" created in Google Tasks` : 'Failed to create task',
          },
          uiTargets: ['tasks'],
        };
      }

      case 'complete_task': {
        const taskId = typedArgs.taskId as string;
        const listId = typedArgs.listId as string | undefined;
        const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            status: 'completed',
            listId: listId || null,
          }),
        });
        const data = await res.json();
        return {
          result: {
            success: res.ok,
            task: data.task,
            message: res.ok ? 'Task marked as completed' : 'Failed to complete task',
          },
          uiTargets: ['tasks'],
        };
      }

      case 'add_note': {
        const res = await fetch(`${baseUrl}/api/notes`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: typedArgs.title,
            content: typedArgs.content || '',
          }),
        });
        const data = await res.json();
        return {
          result: {
            success: res.ok,
            note: data.note,
            message: res.ok ? `Note "${typedArgs.title}" saved to Google Drive` : 'Failed to create note',
          },
          uiTargets: ['notes'],
        };
      }

      case 'generate_content': {
        return {
          result: {
            clientAction: 'generated_content',
            contentType: typedArgs.type,
            topic: typedArgs.topic,
            tone: typedArgs.tone || 'professional',
            length: typedArgs.length || 'medium',
          },
          uiTargets: [],
        };
      }

      default:
        return {
          result: { error: `Unknown function: ${name}` },
          uiTargets: [],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Function execution failed';
    return {
      result: { error: message },
      uiTargets: [],
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Please sign in to use the AI agent.' }, { status: 401 });
    }

    const body = (await req.json()) as AgentRequestBody;
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'A message is required.' }, { status: 400 });
    }

    // Build base URL for internal API calls
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;
    const cookies = req.headers.get('cookie') || '';

    // Fetch live context in parallel (now includes tasks and notes from Google APIs)
    const liveContext = await fetchLiveContext(baseUrl, cookies);

    const contextPrompt = buildContextPrompt(
      session.user.name || 'Alex',
      session.user.email || '',
      liveContext,
    );

    // Build conversation history
    const conversationHistory: Content[] = [
      { role: 'user', parts: [{ text: contextPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I have your current context loaded. How can I help?' }] },
      ...(history || []),
      { role: 'user', parts: [{ text: message }] },
    ];

    const model = getAgentModel();
    const chat = model.startChat({ history: conversationHistory.slice(0, -1) });

    // Send the user message
    let result = await chat.sendMessage(message);
    let response = result.response;

    const allFunctionCalls: FunctionCallResult[] = [];
    const allUITargets = new Set<UIRefreshTarget>();

    // Handle function calling loop (max 5 iterations to prevent infinite loops)
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      const fnCalls = response.functionCalls();
      if (!fnCalls || fnCalls.length === 0) break;

      iterations++;

      // Execute all function calls
      const functionResults: Part[] = [];
      for (const fnCall of fnCalls) {
        const { result: fnResult, uiTargets } = await executeFunctionCall(fnCall, baseUrl, cookies);
        allFunctionCalls.push({
          name: fnCall.name,
          args: fnCall.args as Record<string, unknown>,
          result: fnResult,
        });
        uiTargets.forEach((t) => allUITargets.add(t));
        functionResults.push({
          functionResponse: {
            name: fnCall.name,
            response: fnResult,
          },
        });
      }

      // Send function results back to Gemini
      result = await chat.sendMessage(functionResults);
      response = result.response;
    }

    const textResponse = response.text();

    return NextResponse.json({
      response: textResponse,
      functionCalls: allFunctionCalls,
      uiRefresh: Array.from(allUITargets),
    });
  } catch (error) {
    console.error('Gemini agent error:', error);
    const message = error instanceof Error ? error.message : 'Something went wrong with the AI agent.';

    if (message === 'Not authenticated') {
      return NextResponse.json({ error: 'Please sign in to use the AI agent.' }, { status: 401 });
    }

    // Handle Gemini API rate limits and specific errors
    if (message.includes('429') || message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('quota')) {
      return NextResponse.json(
        { error: 'AI rate limit reached. Please wait a moment and try again.' },
        { status: 429 },
      );
    }

    if (message.includes('API key') || message.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service is not configured. Please check the Gemini API key.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: 'The AI agent encountered an issue. Please try again.' },
      { status: 500 },
    );
  }
}
