import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuthenticatedClient, apiError } from '@/lib/api-helpers';

export async function GET(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const { searchParams } = new URL(req.url);
    const spreadsheetId = searchParams.get('spreadsheetId') || process.env.PINHIGH_SHEET_ID;
    const range = searchParams.get('range') || 'Sheet1';

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No spreadsheet ID provided. Pass spreadsheetId as a query parameter or set PINHIGH_SHEET_ID env var.' },
        { status: 400 },
      );
    }

    // First get spreadsheet metadata
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties.title',
    });

    // Then get the requested range data
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = res.data.values || [];
    const sheetNames = (metadata.data.sheets || []).map(
      (s) => s.properties?.title || 'Untitled',
    );

    return NextResponse.json({
      spreadsheetTitle: metadata.data.properties?.title || 'Untitled',
      sheetNames,
      range: res.data.range || range,
      rows,
      totalRows: rows.length,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Please sign in to access Google Sheets.' },
        { status: 401 },
      );
    }

    // Handle Google API specific errors
    const googleError = error as { code?: number; errors?: Array<{ message: string }> };
    if (googleError.code === 404) {
      return NextResponse.json(
        { error: 'Spreadsheet not found. Please check the spreadsheet ID.' },
        { status: 404 },
      );
    }
    if (googleError.code === 403) {
      return NextResponse.json(
        { error: 'You do not have permission to access this spreadsheet.' },
        { status: 403 },
      );
    }

    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { auth } = await getAuthenticatedClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const body = await req.json();
    const { spreadsheetId, range, values } = body as {
      spreadsheetId?: string;
      range?: string;
      values?: string[][];
    };

    const resolvedSheetId = spreadsheetId || process.env.PINHIGH_SHEET_ID;

    if (!resolvedSheetId) {
      return NextResponse.json(
        { error: 'No spreadsheet ID provided.' },
        { status: 400 },
      );
    }

    if (!range || !values || !Array.isArray(values)) {
      return NextResponse.json(
        { error: 'Both range and values are required. Values must be a 2D array.' },
        { status: 400 },
      );
    }

    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: resolvedSheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return NextResponse.json({
      updatedRange: res.data.updatedRange,
      updatedRows: res.data.updatedRows,
      updatedColumns: res.data.updatedColumns,
      updatedCells: res.data.updatedCells,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Please sign in to update Google Sheets.' },
        { status: 401 },
      );
    }

    return apiError(error);
  }
}
