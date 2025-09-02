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
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const { token } = req.body || {};
    if (!token) return res.status(200).json([]);

    const userRecord = await findUserByToken(token);
    if (!userRecord) return res.status(200).json([]);

    const gameRecords = await fetchAllGamesForOwner(userRecord.id);
    const games = await Promise.all(
      gameRecords.map(async (rec) => {
        const gameId = rec.id;
        // eslint-disable-next-line no-console
        console.log('[GetMyGames] Fetching posts for gameId:', gameId);
        const posts = await fetchPostsForGame(gameId);
        return {
          id: gameId,
          name: rec.fields?.Name || '',
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
      })
    );

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

async function fetchAllGamesForOwner(ownerRecordId) {
  let allRecords = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);

    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    const pageRecords = (page?.records || []).filter((rec) => {
      const ownerIds = normalizeLinkedIds(rec.fields?.Owner);
      return ownerIds.includes(ownerRecordId);
    });
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
  } while (offset);
  return allRecords;
}

async function fetchPostsForGame(gameId) {
  // eslint-disable-next-line no-console
  console.log('[GetMyGames] fetchPostsForGame gameId:', gameId);
  // First, try filtering server-side for performance and correctness
  const tryServerFilter = async () => {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    params.set('filterByFormula', `ARRAYJOIN({Game}) = "${safeEscapeFormulaString(gameId)}"`);
    params.set('sort[0][field]', 'Created At');
    params.set('sort[0][direction]', 'desc');
    const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
    const page = await airtableRequest(url, { method: 'GET' });
    const records = Array.isArray(page?.records) ? page.records : [];
    // eslint-disable-next-line no-console
    console.log(`[GetMyGames] server filter posts count for ${gameId}:`, records.length);
    return records;
  };

  let records = await tryServerFilter();
  if (!records || records.length === 0) {
    // Fallback: fetch pages and filter in code
    let allRecords = [];
    let offset;
    do {
      const params = new URLSearchParams();
      params.set('pageSize', '100');
      if (offset) params.set('offset', offset);
      const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
      const page = await airtableRequest(url, { method: 'GET' });
      const pageRecords = (page?.records || []).filter((rec) => Array.isArray(rec.fields?.Game) && rec.fields.Game.includes(gameId));
      allRecords = allRecords.concat(pageRecords);
      offset = page?.offset;
    } while (offset);
    // eslint-disable-next-line no-console
    console.log(`[GetMyGames] fallback client-filter posts count for ${gameId}:`, allRecords.length);
    records = allRecords;
  }

  // Sort newest first using "Created At" (fallback to createdTime)
  records.sort((a, b) => {
    const ad = new Date(a?.fields?.['Created At'] || a?.createdTime || 0).getTime();
    const bd = new Date(b?.fields?.['Created At'] || b?.createdTime || 0).getTime();
    return bd - ad;
  });

  return records.map((rec) => ({
    id: rec.id,
    postId: rec.fields?.PostID || '',
    content: rec.fields?.Content || '',
    createdAt: rec.fields?.['Created At'] || rec.createdTime || '',
    PlayLink: typeof rec.fields?.PlayLink === 'string' ? rec.fields.PlayLink : '',
    attachments: (() => {
      const airtableAttachments = Array.isArray(rec.fields?.Attachements)
        ? rec.fields.Attachements.map((a) => ({
            url: a?.url,
            type: a?.type,
            filename: a?.filename,
            id: a?.id,
            size: a?.size,
          })).filter((a) => a.url)
        : [];
      
      // Add S3 attachment links
      const attachmentLinks = rec.fields?.AttachementLinks || '';
      const s3Attachments = attachmentLinks
        ? attachmentLinks.split(',').map(link => link.trim()).filter(link => link).map(url => {
            const filename = url.split('/').pop() || 'attachment';
            let ext = '';
            
            // Try to get extension from filename first
            if (filename.includes('.')) {
              ext = filename.split('.').pop().toLowerCase();
            } 
            // If no extension in filename, try to get it from the URL path
            else {
              const urlPath = new URL(url).pathname;
              const pathParts = urlPath.split('.');
              if (pathParts.length > 1) {
                ext = pathParts[pathParts.length - 1].toLowerCase();
              }
            }
            
            // Determine content type from file extension
            let contentType = 'application/octet-stream';
            if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
              contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            } else if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'mpg', 'mpeg'].includes(ext)) {
              contentType = `video/${ext}`;
            } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
              contentType = `audio/${ext}`;
            }
            
            return {
              url: url,
              type: contentType,
              filename: filename.includes('.') ? filename : `attachment.${ext}`,
              id: `s3-${Date.now()}`,
              size: 0
            };
          })
        : [];
      
      return [...airtableAttachments, ...s3Attachments];
    })(),
    badges: Array.isArray(rec.fields?.Badges) ? rec.fields.Badges : [],
    postType: rec.fields?.PostType || 'devlog',
    timelapseVideoId: rec.fields?.Timelapse || '',
    githubImageLink: rec.fields?.['Link to Github Asset'] || '',
    timeScreenshotId: rec.fields?.TimeScreenshotFile || '',
    hoursSpent: rec.fields?.HoursSpent || 0,
    minutesSpent: 0,
  }));
}


