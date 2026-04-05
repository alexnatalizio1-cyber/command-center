import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setDate(now.getDate() + 7);

    const timeMin = searchParams.get('timeMin') || now.toISOString();
    const timeMax = searchParams.get('timeMax') || defaultEnd.toISOString();

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = (res.data.items || []).map((event) => ({
      id: event.id,
      summary: event.summary || '',
      start: event.start?.dateTime || event.start?.date || '',
      end: event.end?.dateTime || event.end?.date || '',
      location: event.location || null,
      description: event.description || null,
      attendees: (event.attendees || []).map((a) => ({
        email: a.email,
        responseStatus: a.responseStatus,
        self: a.self || false,
      })),
      organizer: event.organizer
        ? { email: event.organizer.email, self: event.organizer.self || false }
        : null,
      htmlLink: event.htmlLink || null,
      allDay: !event.start?.dateTime,
      colorId: event.colorId || null,
    }));

    return NextResponse.json({ events });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const body = await req.json();
    const { summary, start, end, location, description, attendees, allDay } = body;

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'summary, start, and end are required' },
        { status: 400 }
      );
    }

    const eventBody: any = {
      summary,
      location: location || undefined,
      description: description || undefined,
    };

    if (allDay) {
      eventBody.start = { date: start };
      eventBody.end = { date: end };
    } else {
      eventBody.start = { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      eventBody.end = { dateTime: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
    }

    if (attendees && attendees.length > 0) {
      eventBody.attendees = attendees.map((email: string) => ({ email }));
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
      sendUpdates: 'all',
    });

    return NextResponse.json({ event: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}
