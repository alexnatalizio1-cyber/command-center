import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/**
 * Unattended Google auth for scheduled jobs (cron) and server-side automation.
 *
 * The interactive helpers in api-helpers.ts depend on a logged-in next-auth
 * session, which does not exist when the daily market-research job runs from
 * GitHub Actions. This builds an OAuth2 client from a long-lived refresh token
 * stored in the environment so the agent can send mail and write Sheets as a
 * dedicated mailbox without a user present.
 *
 * Set GOOGLE_REFRESH_TOKEN to a refresh token minted for that mailbox against
 * the same GOOGLE_CLIENT_ID/SECRET, with gmail.send + spreadsheets + drive.file
 * scopes consented.
 */
export function getServiceAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set; cannot build service auth client.',
    );
  }
  if (!refreshToken) {
    throw new Error(
      'GOOGLE_REFRESH_TOKEN is not set. The market-research agent needs a refresh token ' +
        'for the sending mailbox to send email and write the history Sheet unattended.',
    );
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export function hasServiceAuth(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN,
  );
}
