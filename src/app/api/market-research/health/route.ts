import { NextResponse } from 'next/server';
import { hasServiceAuth } from '@/lib/google-service-auth';

export const dynamic = 'force-dynamic';

/**
 * Unauthenticated diagnostic. Reports ONLY presence booleans (never values)
 * plus the deployed commit, so configuration can be verified instantly in a
 * browser without running the pipeline, waiting for email, or reading CI logs.
 */
export async function GET() {
  const tavily = Boolean(process.env.TAVILY_API_KEY);
  const gemini = Boolean(process.env.GEMINI_API_KEY);
  const apollo = Boolean(process.env.APOLLO_API_KEY);
  const recipients = Boolean(process.env.MARKET_RESEARCH_RECIPIENTS);
  const serviceAuth = hasServiceAuth();
  const mode = apollo ? 'apollo' : 'web';
  const ready =
    serviceAuth && recipients && gemini && (apollo || tavily);

  return NextResponse.json({
    ready,
    mode,
    env: {
      TAVILY_API_KEY: tavily,
      GEMINI_API_KEY: gemini,
      APOLLO_API_KEY: apollo,
      MARKET_RESEARCH_RECIPIENTS: recipients,
      googleServiceAuth: serviceAuth,
    },
    deployedCommit: (process.env.VERCEL_GIT_COMMIT_SHA || 'unknown').slice(
      0,
      7,
    ),
    time: new Date().toISOString(),
  });
}
