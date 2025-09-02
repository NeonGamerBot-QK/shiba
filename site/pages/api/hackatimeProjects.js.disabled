
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE;
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  return response.json();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const slackId = String(req.query.slackId || '').trim();
  const gameId = req.query.gameId ? String(req.query.gameId).trim() : null;
  if (!slackId) {
    return res.status(400).json({ message: 'Missing slackId' });
  }
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(slackId)) {
    return res.status(400).json({ message: 'That is a funny looking slack id' });
  }

  let assignedProjectsMap = {};
  let allowedForGame = [];
  try {
    let allRecords = [];
    let offset;
    do {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (offset) params.set('offset', offset);
      const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, { method: 'GET' });
      const pageRecords = Array.isArray(page?.records) ? page.records : [];
      allRecords = allRecords.concat(pageRecords);
      offset = page?.offset;
    } while (offset);
    for (const rec of allRecords) {
      const val = rec.fields?.['Hackatime Projects'];
      if (typeof val === 'string') {
        val.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
          assignedProjectsMap[name] = rec.id;
        });
      } else if (Array.isArray(val)) {
        val.map(s => String(s).trim()).filter(Boolean).forEach(name => {
          assignedProjectsMap[name] = rec.id;
        });
      }
      if (gameId && rec.id === gameId) {
        if (typeof val === 'string') {
          allowedForGame = val.split(',').map(s => s.trim()).filter(Boolean);
        } else if (Array.isArray(val)) {
          allowedForGame = val.map(s => String(s).trim()).filter(Boolean);
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch assigned Hackatime projects from Airtable:', e);
    assignedProjectsMap = {};
    allowedForGame = [];
  }

  const startDate = '2025-08-18';
  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects&start_date=${startDate}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json(json || { message: 'Upstream error' });
    }
    const projects = Array.isArray(json?.data?.projects) ? json.data.projects : [];
    const filtered = projects.filter((p) => {
      if (!p?.name) return false;
      if (!assignedProjectsMap[p.name]) return true;
      if (gameId && allowedForGame.includes(p.name)) return true;
      return false;
    });
    const names = filtered.map((p) => p?.name).filter(Boolean);
    const projectsWithTime = filtered.map((p) => ({
      name: p?.name,
      time: Math.round((p?.total_seconds || 0) / 60)
    })).filter((p) => p.name);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ projects: names, projectsWithTime });
  } catch (e) {
    console.error('hackatimeProjects proxy error:', e);
    return res.status(500).json({ message: 'Failed to fetch projects' });
  }
}


