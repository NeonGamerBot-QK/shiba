import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
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

    // 1) Fetch posts (paginated) up to limit, newest first by "Created At"
    const allPosts = await fetchAllAirtableRecords(AIRTABLE_POSTS_TABLE, {
      sort: [{ field: 'Created At', direction: 'desc' }],
      limit: hardLimit,
    });

    // 2) Filter out posts that have no game tied to them
    const postsWithGames = allPosts.filter((rec) => {
      const linkedGameIds = normalizeLinkedIds(rec?.fields?.Game);
      return linkedGameIds.length > 0 && linkedGameIds[0];
    });

    // 3) Collect linked Game IDs
    const gameIdsSet = new Set();
    for (const rec of postsWithGames) {
      const linkedGameIds = normalizeLinkedIds(rec?.fields?.Game);
      if (linkedGameIds[0]) gameIdsSet.add(linkedGameIds[0]);
    }
    const gameIds = Array.from(gameIdsSet);

    // 3) Fetch all referenced games in chunks and build a map
    const gameRecords = await fetchRecordsByIds(AIRTABLE_GAMES_TABLE, gameIds);
    const gameIdToRecord = new Map(gameRecords.map((gr) => [gr.id, gr]));

    // 4) Collect owner (Users) from games and fetch slack ids
    const ownerIdsSet = new Set();
    for (const gameRec of gameRecords) {
      const ownerIds = normalizeLinkedIds(gameRec?.fields?.Owner);
      if (ownerIds[0]) ownerIdsSet.add(ownerIds[0]);
    }
    const ownerIds = Array.from(ownerIdsSet);
    const ownerRecords = await fetchRecordsByIds(AIRTABLE_USERS_TABLE, ownerIds);
    const userIdToSlackId = new Map(
      ownerRecords.map((ur) => [ur.id, typeof ur.fields?.['slack id'] === 'string' ? ur.fields['slack id'] : ''])
    );

    // 5) Build response rows with requested fields
    const rows = postsWithGames.map((rec) => {
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

      const linkedGameIds = normalizeLinkedIds(fields.Game);
      const gameId = linkedGameIds[0] || '';
      const gameRec = gameId ? gameIdToRecord.get(gameId) : null;
      const gameName = (gameRec && (gameRec.fields?.Name || '')) || '';
      const ownerId = (gameRec && normalizeLinkedIds(gameRec.fields?.Owner)[0]) || '';
      const slackId = (ownerId && userIdToSlackId.get(ownerId)) || '';

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
        postType: (fields.Timelapse && fields['Link to Github Asset'] && fields.TimeSpentOnAsset) ? 'artlog' : 'devlog',
        timelapseVideoId: fields.Timelapse || '',
        githubImageLink: fields['Link to Github Asset'] || '',
        timeScreenshotId: fields.TimeScreenshotFile || '',
        hoursSpent: fields.HoursSpent || 0,
        minutesSpent: 0,
        timeSpentOnAsset: fields.TimeSpentOnAsset || 0,
        posterShomatoSeeds: fields.PosterShomatoSeeds || 0,
      };
    });

    // Only return up to limit (safety)
    return res.status(200).json(rows.slice(0, hardLimit));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GetAllPostsPreload error:', error);
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

async function fetchRecordsByIds(tableName, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const chunkSize = 10; // keep formulas reasonably short
  const chunks = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

  const results = [];
  for (const chunk of chunks) {
    const formula = `OR(${chunk.map((id) => `RECORD_ID() = "${id}"`).join(',')})`;
    const params = new URLSearchParams({ filterByFormula: formula, pageSize: '100' });
    const page = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, { method: 'GET' });
    results.push(...(page?.records || []));
  }
  return results;
}
