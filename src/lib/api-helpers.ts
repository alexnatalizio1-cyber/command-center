import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';

export async function getAuthenticatedClient() {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return { auth, session };
}

export function apiError(error: any, status = 500) {
  const message = error?.message || 'Unknown error';
  return NextResponse.json({ error: message }, { status: status === 401 ? 401 : 500 });
}
