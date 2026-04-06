import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const results: any = {
    appStatus: null,
    lastCommit: null,
    lastDeployment: null,
    waitlistCount: null,
  };

  // 1. Check app status
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://pin-high.vercel.app', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    results.appStatus = {
      online: res.ok,
      statusCode: res.status,
    };
  } catch {
    results.appStatus = { online: false, statusCode: 0 };
  }

  // 2. Last GitHub commit
  const githubToken = process.env.GITHUB_TOKEN;
  if (githubToken) {
    try {
      const res = await fetch(
        'https://api.github.com/repos/alexnatalizio1-cyber/pin-high/commits?per_page=1',
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );
      if (res.ok) {
        const commits = await res.json();
        if (commits.length > 0) {
          const c = commits[0];
          results.lastCommit = {
            message: c.commit.message,
            author: c.commit.author.name,
            date: c.commit.author.date,
            sha: c.sha.slice(0, 7),
            url: c.html_url,
          };
        }
      }
    } catch {}
  }

  // 3. Last Vercel deployment (use commit info as proxy if no VERCEL_PROJECT_TOKEN)
  const vercelToken = process.env.VERCEL_PROJECT_TOKEN;
  if (vercelToken) {
    try {
      const res = await fetch(
        'https://api.vercel.com/v6/deployments?projectId=pin-high&limit=1&target=production',
        {
          headers: {
            Authorization: `Bearer ${vercelToken}`,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.deployments?.length > 0) {
          const d = data.deployments[0];
          results.lastDeployment = {
            state: d.state || d.readyState,
            createdAt: d.createdAt || d.created,
            url: d.url ? `https://${d.url}` : null,
            inspectorUrl: d.inspectorUrl || null,
          };
        }
      }
    } catch {}
  } else if (results.lastCommit) {
    // Use commit as proxy for deploy
    results.lastDeployment = {
      state: 'READY',
      createdAt: new Date(results.lastCommit.date).getTime(),
      url: 'https://pin-high.vercel.app',
      inspectorUrl: null,
    };
  }

  // 4. Waitlist count from Supabase
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://klaspxohbxwdkwliefpi.supabase.co';
  if (supabaseKey) {
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/waitlist?select=count`,
        {
          method: 'GET',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: 'count=exact',
          },
        }
      );
      if (res.ok) {
        const countHeader = res.headers.get('content-range');
        // content-range header format: "0-X/TOTAL" or "*/TOTAL"
        if (countHeader) {
          const total = countHeader.split('/').pop();
          results.waitlistCount = total ? parseInt(total, 10) : 0;
        } else {
          // fallback: try parsing body
          const data = await res.json();
          results.waitlistCount = Array.isArray(data) ? data.length : 0;
        }
      }
    } catch {}
  }

  return NextResponse.json(results);
}
