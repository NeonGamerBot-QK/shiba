import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
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
    const { gameName, ownerSlackId } = req.body || {};
    if (!gameName) {
      return res.status(400).json({ message: 'Missing gameName parameter' });
    }
    if (!ownerSlackId) {
      return res.status(400).json({ message: 'Missing ownerSlackId parameter' });
    }

    // Find the game record by name first
    const gameRecord = await findGameByName(gameName);
    if (!gameRecord) {
      console.log(`[GetPostsForGame] Game not found by name: ${gameName}`);
      return res.status(200).json([]);
    }

    console.log(`[GetPostsForGame] Found game record: ${gameRecord.id} for name: ${gameName}`);

    // Verify that the game's owner's slack ID matches the expected ownerSlackId
    const ownerId = normalizeLinkedIds(gameRecord.fields?.Owner)[0];
    if (!ownerId) {
      console.log(`[GetPostsForGame] Game has no owner: ${gameName}`);
      return res.status(200).json([]);
    }

    const ownerRecord = await findUserById(ownerId);
    if (!ownerRecord) {
      console.log(`[GetPostsForGame] Owner record not found for game: ${gameName}`);
      return res.status(200).json([]);
    }

    const gameOwnerSlackId = ownerRecord.fields?.['slack id'] || '';
    if (gameOwnerSlackId !== ownerSlackId) {
      console.log(`[GetPostsForGame] Slack ID mismatch. Expected: ${ownerSlackId}, Found: ${gameOwnerSlackId} for game: ${gameName}`);
      return res.status(200).json([]);
    }

    console.log(`[GetPostsForGame] Verified owner match for game: ${gameName}, owner: ${ownerSlackId}`);

    // Fetch posts for the specific game
    const posts = await fetchPostsForGame(gameRecord.id);
    
    return res.status(200).json(posts);
  } catch (error) {
    console.error('GetPostsForGame error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

async function fetchPostsForGame(gameId) {
  console.log('[GetPostsForGame] fetchPostsForGame gameId:', gameId);
  
  // Fetch all posts and filter by game ID
  const allPosts = await fetchAllAirtableRecords(AIRTABLE_POSTS_TABLE, {
    sort: [{ field: 'Created At', direction: 'desc' }],
  });

  // Filter posts that are linked to the specific game
  const postsForGame = allPosts.filter((rec) => {
    const linkedGameIds = normalizeLinkedIds(rec?.fields?.Game);
    return linkedGameIds.includes(gameId);
  });

  console.log(`[GetPostsForGame] found ${postsForGame.length} posts for game ${gameId}`);

  // Get game and user information for the posts
  const gameRecord = await findGameById(gameId);
  const ownerId = gameRecord ? normalizeLinkedIds(gameRecord.fields?.Owner)[0] : null;
  const ownerRecord = ownerId ? await findUserById(ownerId) : null;
  const slackId = ownerRecord ? (ownerRecord.fields?.['slack id'] || '') : '';

  return postsForGame.map((rec) => {
    const fields = rec.fields || {};
    const createdAt = fields['Created At'] || rec.createdTime || '';
    const playLink = typeof fields.PlayLink === 'string' ? fields.PlayLink : '';
    const attachments = (() => {
      const airtableAttachments = Array.isArray(fields.Attachements)
        ? fields.Attachements
            .map((a) => ({ url: a?.url, type: a?.type, filename: a?.filename, id: a?.id, size: a?.size }))
            .filter((a) => a.url)
        : [];
      
      // Add S3 attachment links
      const attachmentLinks = fields.AttachementLinks || '';
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
    })();

    // Determine thumbnail: prefer post's GameThumbnail, then game's Thumbnail
    let gameThumbnail = '';
    if (typeof fields.GameThumbnail === 'string') {
      gameThumbnail = fields.GameThumbnail;
    } else if (Array.isArray(fields.GameThumbnail) && fields.GameThumbnail[0]?.url) {
      gameThumbnail = fields.GameThumbnail[0].url;
    } else if (Array.isArray(gameRecord?.fields?.Thumbnail) && gameRecord.fields.Thumbnail[0]?.url) {
      gameThumbnail = gameRecord.fields.Thumbnail[0].url;
    }

    return {
      'Created At': createdAt,
      PlayLink: playLink,
      Attachements: attachments,
      'slack id': slackId,
      'Game Name': gameRecord?.fields?.Name || '',
      Content: fields.Content || '',
      PostID: fields.PostID || '',
      GameThumbnail: gameThumbnail,
      Badges: Array.isArray(fields.Badges) ? fields.Badges : [],
      postType: fields.PostType || 'devlog',
      timelapseVideoId: fields.Timelapse || '',
      githubImageLink: fields['Link to Github Asset'] || '',
      timeScreenshotId: fields.TimeScreenshotFile || '',
      hoursSpent: fields.HoursSpent || 0,
      minutesSpent: 0,
    };
  });
}

async function findGameById(gameId) {
  try {
    const record = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
    return record;
  } catch (error) {
    console.error('Error finding game by ID:', error);
    return null;
  }
}

async function findUserById(userId) {
  try {
    const record = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, { method: 'GET' });
    return record;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
}

async function findGameByName(gameName) {
  const gameNameEscaped = safeEscapeFormulaString(gameName);
  const formula = `{Name} = "${gameNameEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
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

async function fetchAllAirtableRecords(tableName, { sort, limit } = {}) {
  let allRecords = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    if (Array.isArray(sort) && sort.length > 0) {
      sort.forEach((s, idx) => {
        if (s && s.field) {
          params.set(`sort[${idx}][field]`, s.field);
          params.set(`sort[${idx}][direction]`, s.direction === 'asc' ? 'asc' : 'desc');
        }
      });
    }
    const page = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, { method: 'GET' });
    allRecords = allRecords.concat(page?.records || []);
    if (typeof limit === 'number' && limit > 0 && allRecords.length >= limit) {
      return allRecords.slice(0, limit);
    }
    offset = page?.offset;
  } while (offset);
  return allRecords;
}
