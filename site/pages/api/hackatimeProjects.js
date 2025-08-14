export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const slackId = String(req.query.slackId || '').trim();
  if (!slackId) {
    return res.status(400).json({ message: 'Missing slackId' });
  }

  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json(json || { message: 'Upstream error' });
    }
    const projects = Array.isArray(json?.data?.projects) ? json.data.projects : [];
    const names = projects.map((p) => p?.name).filter(Boolean);
    // Return minimal payload for client
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ projects: names });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('hackatimeProjects proxy error:', e);
    return res.status(500).json({ message: 'Failed to fetch projects' });
  }
}


