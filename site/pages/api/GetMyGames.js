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
  console.log('[GetMyGames] Table names:', {
    USERS: AIRTABLE_USERS_TABLE,
    GAMES: AIRTABLE_GAMES_TABLE,
    POSTS: AIRTABLE_POSTS_TABLE
  });

  try {
    const { token } = req.body || {};
    if (!token) return res.status(200).json([]);

    console.log(`[GetMyGames] Fetching games for token: ${token}`);
    const gameRecords = await fetchAllGamesForOwner(token);
    console.log(`[GetMyGames] Raw game records:`, gameRecords);
    console.log(`[GetMyGames] Number of games found: ${gameRecords?.length || 0}`);
    
    if (!gameRecords || gameRecords.length === 0) {
      console.log(`[GetMyGames] No games found, returning empty array`);
      return res.status(200).json([]);
    }

    
    const games = await Promise.all(gameRecords.map(async (rec) => {
      const gameId = rec.id;
      const gameName = rec.fields?.Name || '';
      
      // Fetch posts for this specific game directly
      const posts = await fetchPostsForGame(gameId);
      
      console.log(`[GetMyGames] Game "${gameName}" has ${posts.length} posts`);
      
      // Transform posts to match the structure that MyGamesComponent expects
      const transformedPosts = posts.map(rec => {
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
        } else if (Array.isArray(rec.fields?.Thumbnail) && rec.fields.Thumbnail[0]?.url) {
          gameThumbnail = rec.fields.Thumbnail[0].url;
        }

        // Convert HoursSpent (decimal hours) to hours and minutes
        const totalHours = fields.HoursSpent || 0;
        const hoursSpent = Math.floor(totalHours);
        const minutesSpent = Math.round((totalHours - hoursSpent) * 60);
        
        // Calculate HoursSpent in decimal format for PostAttachmentRenderer (e.g., 0.72 for 43 minutes)
        const calculatedHoursSpent = hoursSpent + (minutesSpent / 60);
        
        return {
          id: rec.id,
          createdTime: rec.createdTime,
          createdAt: createdAt,
          'Created At': createdAt,
          PlayLink: playLink,
          attachments: attachments,
          'slack id': fields['slack id'] || '',
          'Game Name': fields['Game Name'] || '',
          content: fields.Content || '',
          PostID: fields.PostID || '',
          GameThumbnail: gameThumbnail,
          badges: Array.isArray(fields.Badges) ? fields.Badges : [],
          postType: (fields.Timelapse && fields['Link to Github Asset'] && fields.TimeSpentOnAsset) ? 'artlog' : 'devlog',
          timelapseVideoId: fields.Timelapse || '',
          githubImageLink: fields['Link to Github Asset'] || '',
          timeScreenshotId: fields.TimeScreenshotFile || '',
          HoursSpent: calculatedHoursSpent, // Provide decimal hours for PostAttachmentRenderer (e.g., 0.72 for 43 minutes)
          hoursSpent: hoursSpent,
          minutesSpent: minutesSpent,
          timeSpentOnAsset: fields.TimeSpentOnAsset || 0,
          posterShomatoSeeds: fields.PosterShomatoSeeds || 0,
        };
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
        posts: transformedPosts,
      };
    }));

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

async function fetchPostsForGame(gameId) {
  console.log('[GetMyGames] fetchPostsForGame gameId:', gameId);
  
  // Try the same approach as the working GetPostsForGame.js with pagination
  try {
    let allPosts = [];
    let offset = null;
    
    do {
      const params = new URLSearchParams({
        filterByFormula: `SEARCH("${safeEscapeFormulaString(gameId)}", ARRAYJOIN({Game}))`,
        sort: '[{"field":"Created At","direction":"desc"}]',
        pageSize: '100',
      });
      
      if (offset) {
        params.set('offset', offset);
      }
      
      const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
      const page = await airtableRequest(url, { method: 'GET' });
      const records = Array.isArray(page?.records) ? page.records : [];
      
      allPosts = allPosts.concat(records);
      offset = page.offset;
      
      console.log(`[GetMyGames] Fetched ${records.length} posts in this batch, total so far: ${allPosts.length}`);
      
    } while (offset);
    
    console.log(`[GetMyGames] Server filter found ${allPosts.length} total posts for game ${gameId}`);
    return allPosts;
  } catch (error) {
    console.log(`[GetMyGames] Server filter failed, trying fallback approach:`, error.message);
    
    // Fallback: fetch all posts and filter client-side
    try {
      let allPosts = [];
      let offset = null;
      
      do {
        const params = new URLSearchParams({
          pageSize: '100',
        });
        
        if (offset) {
          params.set('offset', offset);
        }
        
        const url = `${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`;
        const page = await airtableRequest(url, { method: 'GET' });
        const records = Array.isArray(page?.records) ? page.records : [];
        
        // Filter posts that contain this gameId in their Game field
        const filteredRecords = records.filter(rec => {
          const gameField = rec.fields?.Game;
          if (Array.isArray(gameField)) {
            return gameField.includes(gameId);
          }
          return false;
        });
        
        allPosts = allPosts.concat(filteredRecords);
        offset = page.offset;
        
      } while (offset);
      
      console.log(`[GetMyGames] Fallback found ${allPosts.length} posts for game ${gameId}`);
      return allPosts;
    } catch (fallbackError) {
      console.error(`[GetMyGames] Both approaches failed:`, fallbackError);
      return [];
    }
  }
}




