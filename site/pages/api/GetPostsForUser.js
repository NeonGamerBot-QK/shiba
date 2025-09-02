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

    // Find user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) return res.status(200).json([]);

    // Get all games owned by this user
    const userGames = await fetchAllGamesForOwner(userRecord.id);
    const userGameIds = userGames.map(game => game.id);

    if (userGameIds.length === 0) return res.status(200).json([]);

    // Fetch posts for these games
    const allPosts = await fetchPostsForGames(userGameIds);

    // Build response rows with requested fields (same format as GetAllPosts)
    const rows = allPosts.map((rec) => {
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

      // Get game info
      const linkedGameIds = normalizeLinkedIds(fields.Game);
      const gameId = linkedGameIds[0] || '';
      const gameRec = userGames.find(g => g.id === gameId);
      const gameName = (gameRec && (gameRec.fields?.Name || '')) || '';
      const slackId = userRecord.fields?.['slack id'] || '';

      // Determine thumbnail: prefer post's GameThumbnail, then game's Thumbnail
      let gameThumbnail = '';
      if (typeof fields.GameThumbnail === 'string') {
        gameThumbnail = fields.GameThumbnail;
      } else if (Array.isArray(fields.GameThumbnail) && fields.GameThumbnail[0]?.url) {
        gameThumbnail = fields.GameThumbnail[0].url;
      } else if (Array.isArray(gameRec?.fields?.Thumbnail) && gameRec.fields.Thumbnail[0]?.url) {
        gameThumbnail = gameRec.fields.Thumbnail[0].url;
      }

      return {
        'Created At': createdAt,
        PlayLink: playLink,
        Attachements: attachments,
        'slack id': slackId,
        'Game Name': gameName,
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

    // Sort by creation date, newest first
    rows.sort((a, b) => new Date(b['Created At']) - new Date(a['Created At']));

    return res.status(200).json(rows);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GetPostsForUser error:', error);
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

async function fetchPostsForGames(gameIds) {
  if (!Array.isArray(gameIds) || gameIds.length === 0) return [];
  
  let allRecords = [];
  let offset;
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);

    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    const pageRecords = (page?.records || []).filter((rec) => {
      const linkedGameIds = normalizeLinkedIds(rec.fields?.Game);
      return linkedGameIds.some(id => gameIds.includes(id));
    });
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
  } while (offset);
  return allRecords;
}
