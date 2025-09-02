import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    console.error('[GetMyGames] Missing AIRTABLE_API_KEY');
    return res.status(500).json({ message: 'Server configuration error' });
  }
  
  console.log('[GetMyGames] API Key present, proceeding...');

  try {
    const { token } = req.body || {};
    if (!token) return res.status(200).json([]);

    console.log(`[GetMyGames] Fetching games for token: ${token}`);
    const gameRecords = await fetchAllGamesForOwner(token);
    console.log(`[GetMyGames] Raw game records:`, gameRecords);
    // Fetch all posts for this owner in one request - much faster!
    const allPosts = await fetchAllPostsForOwner(token, gameRecords);
    
    const games = gameRecords.map((rec) => {
      const gameId = rec.id;
      const gameName = rec.fields?.Name || '';
      
      // Filter posts for this specific game from the pre-fetched posts
      const posts = allPosts.filter(post => {
        const postGameNames = Array.isArray(post.fields?.Game) ? post.fields.Game : [];
        return postGameNames.includes(gameName);
      });
      
      return {
        id: gameId,
        name: gameName,
        description: rec.fields?.Description || '',
        thumbnailUrl: Array.isArray(rec.fields?.Thumbnail) && rec.fields.Thumbnail[0]?.url ? rec.fields.Thumbnail[0].url : '',
        GitHubURL: rec.fields?.GitHubURL || rec.fields?.GithubURL || '',
        ShowreelLink: rec.fields?.ShowreelLink || '',
        HackatimeProjects: Array.isArray(rec.fields?.['Hackatime Projects'])
          ? rec.fields['Hackatime Projects'].filter(Boolean).join(', ')
          : (typeof rec.fields?.['Hackatime Projects'] === 'string' ? rec.fields['Hackatime Projects'] : ''),
        HoursSpent: rec.fields?.HoursSpent || 0,
        AveragePlaytestSeconds: rec.fields?.AveragePlaytestSeconds || 0,
        AverageFunScore: rec.fields?.AverageFunScore || 0,
        AverageArtScore: rec.fields?.AverageArtScore || 0,
        AverageCreativityScore: rec.fields?.AverageCreativityScore || 0,
        AverageAudioScore: rec.fields?.AverageAudioScore || 0,
        AverageMoodScore: rec.fields?.AverageMoodScore || 0,
        numberComplete: rec.fields?.numberComplete || 0,
        Feedback: rec.fields?.Feedback || '',
        posts,
      };
    });

    return res.status(200).json(games);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GetMyGames error:', error);
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

async function findUserByToken(token) {
  const tokenEscaped = safeEscapeFormulaString(token);
  const formula = `{token} = "${tokenEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}

function normalizeLinkedIds(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === 'string') return value;
    if (typeof value[0] === 'object' && value[0] && typeof value[0].id === 'string') {
      return value.map((v) => v.id);
    }
  }
  return [];
}

async function fetchAllGamesForOwner(ownerToken) {
  // First, let's see what games exist and what the ownerToken field looks like
  console.log(`[GetMyGames] Attempting to find games for token: ${ownerToken}`);
  
  // Try the direct filter first
  const params = new URLSearchParams({
    filterByFormula: `{ownerToken} = "${ownerToken}"`,
    pageSize: '100',
  });

  console.log(`[GetMyGames] Airtable query params:`, params.toString());
  
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  console.log(`[GetMyGames] Airtable response:`, data);
  
  if (data.records && data.records.length > 0) {
    console.log(`[GetMyGames] Found ${data.records.length} games with direct filter`);
    return data.records;
  }
  
  // If no games found with direct filter, the token might not exist in any games
  console.log(`[GetMyGames] No games found with direct filter for token: ${ownerToken}`);
  console.log(`[GetMyGames] This token might not be associated with any games yet`);
  
  return [];
}

async function fetchAllPostsForOwner(ownerToken, gameRecords) {
  // Fetch all posts for this owner in batches of 100 - much more scalable
  console.log(`[GetMyGames] Fetching all posts for owner token: ${ownerToken}`);
  
  try {
    let allPosts = [];
    let offset = null;
    
    do {
      const params = new URLSearchParams({
        filterByFormula: `{ownerToken} = "${ownerToken}"`,
        pageSize: '100',
      });
      
      if (offset) {
        params.set('offset', offset);
      }
      
      console.log(`[GetMyGames] Fetching posts batch, offset: ${offset || 'none'}`);
      
      const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
      const page = await airtableRequest(url, { method: 'GET' });
      const records = Array.isArray(page?.records) ? page.records : [];
      
      allPosts = allPosts.concat(records);
      offset = page.offset; // Get next page offset
      
      console.log(`[GetMyGames] Fetched ${records.length} posts in this batch, total so far: ${allPosts.length}`);
      
    } while (offset); // Continue until no more pages
    
    console.log(`[GetMyGames] Found ${allPosts.length} total posts for owner after pagination`);
    return allPosts;
    
  } catch (error) {
    console.error(`[GetMyGames] Failed to fetch posts for owner:`, error);
    return [];
  }
}


