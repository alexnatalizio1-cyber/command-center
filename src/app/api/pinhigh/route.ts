import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const results: any = {
    appStatus: null,
    lastCommit: null,
    lastDeployment: null,
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

  // 3. Last Vercel deployment
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
  }

  return NextResponse.json(results);
}
