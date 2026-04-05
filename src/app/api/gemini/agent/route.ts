import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentModel } from '@/lib/gemini';
import type { Content, FunctionCall, Part } from '@google/generative-ai';

interface AgentRequestBody {
  message: string;
  history?: Content[];
  tasks?: Array<{ id: string; title: string; completed: boolean; priority?: string }>;
  notes?: Array<{ id: string; title: string; content: string }>;
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
}> {
  const headers = { Cookie: cookies };

  const [emailsRes, eventsRes] = await Promise.allSettled([
    fetch(`${baseUrl}/api/gmail?maxResults=5`, { headers }),
    fetch(`${baseUrl}/api/calendar`, { headers }),
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

  return { emails, events };
}

function buildContextPrompt(
  userName: string,
  userEmail: string,
  emails: string,
  events: string,
  tasks: AgentRequestBody['tasks'],
  notes: AgentRequestBody['notes'],
): string {
  const tasksSummary = tasks && tasks.length > 0
    ? tasks.map((t) => `- [${t.completed ? 'DONE' : 'OPEN'}] ${t.title}${t.priority ? ` (${t.priority})` : ''}`).join('\n')
    : 'No tasks tracked.';

  const notesSummary = notes && notes.length > 0
    ? notes.map((n) => `- ${n.title}: ${n.content.slice(0, 100)}${n.content.length > 100 ? '...' : ''}`).join('\n')
    : 'No recent notes.';

  return `
--- LIVE CONTEXT ---
User: ${userName} (${userEmail})
Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Recent Emails:
${emails}

Upcoming Events:
${events}

Open Tasks:
${tasksSummary}

Recent Notes:
${notesSummary}
--- END CONTEXT ---

Use this context to give informed, relevant responses. Reference specific emails, events, or tasks when appropriate.`;
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
        // First fetch the original message to get headers for threading
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
        // Use Drive API via the existing route - PATCH to update file
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
        return {
          result: {
            clientAction: 'add_task',
            task: {
              id: `task_${Date.now()}`,
              title: typedArgs.title,
              priority: typedArgs.priority || 'medium',
              dueDate: typedArgs.dueDate || null,
              completed: false,
            },
          },
          uiTargets: ['tasks'],
        };
      }

      case 'complete_task': {
        return {
          result: {
            clientAction: 'complete_task',
            taskId: typedArgs.taskId,
          },
          uiTargets: ['tasks'],
        };
      }

      case 'add_note': {
        return {
          result: {
            clientAction: 'add_note',
            note: {
              id: `note_${Date.now()}`,
              title: typedArgs.title,
              content: typedArgs.content,
              createdAt: new Date().toISOString(),
            },
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
    const { message, history, tasks, notes } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'A message is required.' }, { status: 400 });
    }

    // Build base URL for internal API calls
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;
    const cookies = req.headers.get('cookie') || '';

    // Fetch live context in parallel
    const liveContext = await fetchLiveContext(baseUrl, cookies);

    const contextPrompt = buildContextPrompt(
      session.user.name || 'Alex',
      session.user.email || '',
      liveContext.emails,
      liveContext.events,
      tasks,
      notes,
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

    return NextResponse.json(
      { error: 'The AI agent encountered an issue. Please try again.' },
      { status: 500 },
    );
  }
}
