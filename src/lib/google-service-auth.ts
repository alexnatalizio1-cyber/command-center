import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/**
 * Unattended Google auth for scheduled jobs (cron) and server-side automation.
 *
 * The interactive helpers in api-helpers.ts depend on a logged-in next-auth
 * session, which does not exist when the daily market-research job runs. This
 * builds an OAuth2 client from a long-lived refresh token stored in the
 * environment so the agent can send mail and write Sheets as a dedicated
 * mailbox without a user present.
 *
 * The sending-mailbox credentials are kept SEPARATE from the dashboard's
 * Google login client so you can mint a refresh token against your own Google
 * Cloud OAuth client (e.g. a personal Gmail sender) without disturbing the
 * app's sign-in. Resolution order:
 *   1. MARKET_RESEARCH_GOOGLE_CLIENT_ID / _SECRET   (dedicated, preferred)
 *   2. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET      (shared fallback)
 * GOOGLE_REFRESH_TOKEN must be minted against whichever pair is in effect,
 * with gmail.send + spreadsheets + drive.file scopes consented.
 */
function serviceClientCredentials(): {
  clientId?: string;
  clientSecret?: string;
} {
  return {
    clientId:
      process.env.MARKET_RESEARCH_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID,
    clientSecret:
      process.env.MARKET_RESEARCH_GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_CLIENT_SECRET,
  };
}

export function getServiceAuthClient(): OAuth2Client {
  const { clientId, clientSecret } = serviceClientCredentials();
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret) {
    throw new Error(
      'No Google OAuth client configured for the sender. Set MARKET_RESEARCH_GOOGLE_CLIENT_ID / _SECRET (or GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).',
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
  const { clientId, clientSecret } = serviceClientCredentials();
  return Boolean(clientId && clientSecret && process.env.GOOGLE_REFRESH_TOKEN);
}
