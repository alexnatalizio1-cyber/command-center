import {
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type GenerativeModel,
} from '@google/generative-ai';

const PINHIGH_SYSTEM_INSTRUCTION = `You are the AI agent for PinHigh Command Center. PinHigh is an AI-powered golf app. The user (Alex) is the solo founder building PinHigh.

You help Alex manage his day-to-day work: emails, calendar, tasks, notes, Drive files, and Google Sheets data. You can take actions on his behalf using the available tools.

Be concise, friendly, and action-oriented. When you take an action, confirm what you did. When you can't do something, explain why and suggest alternatives.`;

const agentFunctionDeclarations: FunctionDeclaration[] = [
  {
    name: 'add_task',
    description: 'Add a new task to the task list',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'The task title',
        },
        priority: {
          type: SchemaType.STRING,
          description: 'Priority level: high, medium, or low',
        },
        dueDate: {
          type: SchemaType.STRING,
          description: 'Optional due date in ISO format',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark a task as completed by its title or ID',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        taskId: {
          type: SchemaType.STRING,
          description: 'The task ID or title to complete',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'add_note',
    description: 'Create a new note',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: {
          type: SchemaType.STRING,
          description: 'The note title',
        },
        content: {
          type: SchemaType.STRING,
          description: 'The note content/body',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'add_calendar_event',
    description: 'Create a new Google Calendar event',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        summary: {
          type: SchemaType.STRING,
          description: 'Event title/summary',
        },
        start: {
          type: SchemaType.STRING,
          description: 'Start time in ISO 8601 format',
        },
        end: {
          type: SchemaType.STRING,
          description: 'End time in ISO 8601 format',
        },
        location: {
          type: SchemaType.STRING,
          description: 'Optional event location',
        },
        description: {
          type: SchemaType.STRING,
          description: 'Optional event description',
        },
        attendees: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'Optional list of attendee email addresses',
        },
      },
      required: ['summary', 'start', 'end'],
    },
  },
  {
    name: 'send_email',
    description: 'Send a new email via Gmail',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        to: {
          type: SchemaType.STRING,
          description: 'Recipient email address',
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Email subject line',
        },
        body: {
          type: SchemaType.STRING,
          description: 'Email body content (HTML supported)',
        },
        cc: {
          type: SchemaType.STRING,
          description: 'Optional CC recipients',
        },
        bcc: {
          type: SchemaType.STRING,
          description: 'Optional BCC recipients',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'reply_to_email',
    description: 'Reply to an existing email thread',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        messageId: {
          type: SchemaType.STRING,
          description: 'The ID of the message to reply to',
        },
        threadId: {
          type: SchemaType.STRING,
          description: 'The thread ID to reply within',
        },
        body: {
          type: SchemaType.STRING,
          description: 'Reply body content',
        },
      },
      required: ['messageId', 'threadId', 'body'],
    },
  },
  {
    name: 'read_email',
    description: 'Read the full content of an email by its ID',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        messageId: {
          type: SchemaType.STRING,
          description: 'The Gmail message ID to read',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'read_drive_file',
    description: 'Read metadata and content of a Google Drive file',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fileId: {
          type: SchemaType.STRING,
          description: 'The Google Drive file ID',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'append_to_drive_file',
    description: 'Append content to an existing Google Drive document',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fileId: {
          type: SchemaType.STRING,
          description: 'The Google Drive file ID',
        },
        content: {
          type: SchemaType.STRING,
          description: 'Content to append',
        },
      },
      required: ['fileId', 'content'],
    },
  },
  {
    name: 'generate_content',
    description: 'Generate text content (blog post, social media, marketing copy, etc.)',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        type: {
          type: SchemaType.STRING,
          description: 'Content type: blog_post, tweet, linkedin, email_template, marketing_copy',
        },
        topic: {
          type: SchemaType.STRING,
          description: 'The topic or subject to write about',
        },
        tone: {
          type: SchemaType.STRING,
          description: 'Desired tone: professional, casual, enthusiastic, technical',
        },
        length: {
          type: SchemaType.STRING,
          description: 'Desired length: short, medium, long',
        },
      },
      required: ['type', 'topic'],
    },
  },
  {
    name: 'update_sheet',
    description: 'Update a cell or range in a Google Sheet',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        spreadsheetId: {
          type: SchemaType.STRING,
          description: 'The Google Sheets spreadsheet ID',
        },
        range: {
          type: SchemaType.STRING,
          description: 'The A1 notation range to update (e.g., Sheet1!A1:B2)',
        },
        values: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
          },
          description: 'The 2D array of values to write',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
  },
];

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

export function getAgentModel(): GenerativeModel {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: PINHIGH_SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: agentFunctionDeclarations }],
  });
}

export function getDigestModel(): GenerativeModel {
  const genAI = getGenAI();
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: `You are a strategic advisor for PinHigh, an AI-powered golf app. Analyze metrics and provide actionable recommendations for the solo founder (Alex). Be specific, data-driven, and prioritize high-impact actions.`,
  });
}

export { PINHIGH_SYSTEM_INSTRUCTION, agentFunctionDeclarations };
