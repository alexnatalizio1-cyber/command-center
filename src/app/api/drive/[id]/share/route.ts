import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const { id } = params;

    const res = await drive.permissions.list({
      fileId: id,
      fields: 'permissions(id, emailAddress, role, type, displayName)',
    });

    const permissions = (res.data.permissions || []).map((p) => ({
      id: p.id,
      emailAddress: p.emailAddress || '',
      displayName: p.displayName || '',
      role: p.role,
      type: p.type,
    }));

    return NextResponse.json({ permissions });
  } catch (error: any) {
    return apiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { auth } = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth });
    const { id } = params;
    const body = await req.json();

    if (!body.email || !body.role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    const res = await drive.permissions.create({
      fileId: id,
      requestBody: {
        type: 'user',
        role: body.role,
        emailAddress: body.email,
      },
      fields: 'id, emailAddress, role, type',
    });

    return NextResponse.json({ permission: res.data });
  } catch (error: any) {
    return apiError(error);
  }
}
