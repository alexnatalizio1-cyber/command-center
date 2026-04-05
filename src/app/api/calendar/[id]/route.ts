import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth, session } = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const res = await calendar.events.get({
      calendarId: 'primary',
      eventId: params.id,
    });

    const event = res.data;
    return NextResponse.json({
      event: {
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
      },
    });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const res = await calendar.events.update({
      calendarId: 'primary',
      eventId: params.id,
      requestBody: eventBody,
      sendUpdates: 'all',
    });

    return NextResponse.json({ event: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth, session } = await getAuthenticatedClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const body = await req.json();
    const { responseStatus } = body;

    if (!responseStatus || !['accepted', 'declined', 'tentative'].includes(responseStatus)) {
      return NextResponse.json(
        { error: 'responseStatus must be accepted, declined, or tentative' },
        { status: 400 }
      );
    }

    // Get the current event to find self in attendees
    const current = await calendar.events.get({
      calendarId: 'primary',
      eventId: params.id,
    });

    const userEmail = (session as any)?.user?.email;
    const attendees = (current.data.attendees || []).map((a) => {
      if (a.self || a.email === userEmail) {
        return { ...a, responseStatus };
      }
      return a;
    });

    const res = await calendar.events.patch({
      calendarId: 'primary',
      eventId: params.id,
      requestBody: { attendees },
      sendUpdates: 'all',
    });

    return NextResponse.json({ event: res.data });
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
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: params.id,
      sendUpdates: 'all',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return apiError(error);
  }
}
