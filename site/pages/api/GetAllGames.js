import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const limitParam = Number.parseInt(String(req.query?.limit || '100'), 10);
    const hardLimit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 1000) : 100;

    // Fetch all games that have a ShibaLink field, sorted by Last Updated (newest first)
    const allGames = await fetchAllGamesWithShibaLink({
      sort: [{ field: 'Last Updated', direction: 'desc' }],
      limit: hardLimit,
    });

    // Transform to only include the requested fields
    const games = allGames.map((rec) => {
      const fields = rec.fields || {};
      
      return {
        id: rec.id,
        Name: fields.Name || '',
        Description: fields.Description || '',
        Thumbnail: Array.isArray(fields.Thumbnail) && fields.Thumbnail[0]?.url ? fields.Thumbnail[0].url : '',
        'slack id': fields['slack id'] || '',
        'Last Updated': fields['Last Updated'] || '',
        ShibaLink: fields.ShibaLink || '',
      };
    });

    // Only return up to limit (safety)
    return res.status(200).json(games.slice(0, hardLimit));
  } catch (error) {
    console.error('GetAllGames error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

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

async function fetchAllGamesWithShibaLink({ sort, limit } = {}) {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    
    // Filter to only include games that have a ShibaLink field
    params.set('filterByFormula', 'NOT({ShibaLink} = "")');
    
    if (Array.isArray(sort) && sort.length > 0) {
      sort.forEach((s, idx) => {
        if (s && s.field) {
          params.set(`sort[${idx}][field]`, s.field);
          params.set(`sort[${idx}][direction]`, s.direction === 'asc' ? 'asc' : 'desc');
        }
      });
    }
    
    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, { method: 'GET' });
    allRecords = allRecords.concat(page?.records || []);
    
    if (typeof limit === 'number' && limit > 0 && allRecords.length >= limit) {
      return allRecords.slice(0, limit);
    }
    
    offset = page?.offset;
  } while (offset);
  
  return allRecords;
}
