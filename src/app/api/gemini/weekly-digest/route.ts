import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAuthenticatedClient } from '@/lib/api-helpers';
import { getDigestModel } from '@/lib/gemini';
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

interface Recommendation {
  type: 'content' | 'metric' | 'build';
  title: string;
  description: string;
  action: string;
}

interface SheetMetrics {
  waitlistCount: string | null;
  activeUsers: string | null;
  mrr: string | null;
  roundsLogged: string | null;
}

async function fetchSheetMetrics(auth: OAuth2Client): Promise<SheetMetrics | null> {
  const sheetId = process.env.PINHIGH_SHEET_ID;
  if (!sheetId) return null;

  try {
    const sheets = google.sheets({ version: 'v4', auth });

    // Try to read a "Metrics" or first sheet with known layout
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Metrics!A:B',
    });

    const rows = res.data.values || [];
    const metrics: SheetMetrics = {
      waitlistCount: null,
      activeUsers: null,
      mrr: null,
      roundsLogged: null,
    };

    for (const row of rows) {
      const label = (row[0] || '').toString().toLowerCase();
      const value = (row[1] || '').toString();

      if (label.includes('waitlist')) metrics.waitlistCount = value;
      else if (label.includes('active user')) metrics.activeUsers = value;
      else if (label.includes('mrr') || label.includes('revenue')) metrics.mrr = value;
      else if (label.includes('rounds') || label.includes('logged')) metrics.roundsLogged = value;
    }

    return metrics;
  } catch (error) {
    console.error('Failed to fetch sheet metrics:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Please sign in to generate a weekly digest.' },
        { status: 401 },
      );
    }

    let metrics: SheetMetrics | null = null;

    // Fetch metrics from Google Sheets if configured
    if (process.env.PINHIGH_SHEET_ID) {
      try {
        const { auth } = await getAuthenticatedClient();
        metrics = await fetchSheetMetrics(auth);
      } catch {
        // If auth fails for sheets, continue without metrics
        console.warn('Could not fetch sheet metrics, proceeding without them.');
      }
    }

    const metricsContext = metrics
      ? `
Current PinHigh Metrics:
- Waitlist Count: ${metrics.waitlistCount || 'Not available'}
- Active Users: ${metrics.activeUsers || 'Not available'}
- MRR: ${metrics.mrr || 'Not available'}
- Rounds Logged: ${metrics.roundsLogged || 'Not available'}
`
      : `
No Google Sheets metrics configured. Using general PinHigh context:
- PinHigh is an AI-powered golf app in early stages
- Alex is the solo founder
- Key focus areas: user acquisition, product development, content marketing
`;

    const prompt = `Based on this week's PinHigh metrics and context, generate exactly 3 specific recommendations: one for content, one for metrics to improve, one for product/build priorities.

${metricsContext}

Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Respond ONLY with valid JSON in this exact format (no markdown, no code blocks):
{
  "recommendations": [
    {
      "type": "content",
      "title": "Short title",
      "description": "2-3 sentence explanation",
      "action": "Specific next step Alex should take"
    },
    {
      "type": "metric",
      "title": "Short title",
      "description": "2-3 sentence explanation",
      "action": "Specific next step Alex should take"
    },
    {
      "type": "build",
      "title": "Short title",
      "description": "2-3 sentence explanation",
      "action": "Specific next step Alex should take"
    }
  ]
}`;

    const model = getDigestModel();
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse the JSON response, handling potential markdown wrapping
    let parsed: { recommendations: Recommendation[] };
    try {
      const cleanedText = responseText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      parsed = JSON.parse(cleanedText);
    } catch {
      console.error('Failed to parse Gemini response:', responseText);
      return NextResponse.json(
        { error: 'Failed to parse AI recommendations. Please try again.' },
        { status: 502 },
      );
    }

    // Validate the response shape
    if (!parsed.recommendations || !Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
      return NextResponse.json(
        { error: 'AI returned an unexpected response format. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      recommendations: parsed.recommendations,
      generatedAt: new Date().toISOString(),
      metricsAvailable: metrics !== null,
    });
  } catch (error) {
    console.error('Weekly digest error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Please sign in to generate a weekly digest.' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate weekly digest. Please try again.' },
      { status: 500 },
    );
  }
}
