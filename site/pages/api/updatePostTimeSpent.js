import { safeEscapeFormulaString } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';

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
    const { token, postId, timeSpentOnAsset } = req.body || {};
    
    // Input validation
    if (!token || !postId || typeof timeSpentOnAsset !== 'number') {
      return res.status(400).json({ message: 'Missing required fields: token, postId, timeSpentOnAsset' });
    }

    // Validate timeSpentOnAsset range (reasonable limits)
    if (timeSpentOnAsset < 0 || timeSpentOnAsset > 1000) {
      return res.status(400).json({ message: 'Time spent must be between 0 and 1000 hours' });
    }

    // Validate postId format (should be alphanumeric)
    if (!/^[A-Za-z0-9_-]+$/.test(postId)) {
      return res.status(400).json({ message: 'Invalid post ID format' });
    }

    // Rate limiting by user token (after we validate the token)
    // We'll add this after token validation

    // Find user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Rate limiting by user ID (after token validation)
    const rateLimitKey = `updateTime:${userRecord.id}`;
    if (!checkRateLimit(rateLimitKey, 20, 60000)) { // 20 updates per minute per user
      return res.status(429).json({ message: 'Too many update requests. Please wait before trying again.' });
    }

    // Find post by PostID
    const postRecord = await findPostByPostID(postId);
    if (!postRecord) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Verify ownership of the post
    const gameIds = normalizeLinkedIds(postRecord.fields?.Game);
    if (gameIds.length === 0) {
      return res.status(400).json({ message: 'Post is not linked to any game' });
    }

    // Get the first game (posts typically have one game)
    const gameId = gameIds[0];
    const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
    
    if (!game) {
      return res.status(404).json({ message: 'Associated game not found' });
    }

    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    if (!ownerIds.includes(userRecord.id)) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    // Update the TimeSpentOnAsset field
    const updatePayload = {
      fields: {
        TimeSpentOnAsset: timeSpentOnAsset
      }
    };

    await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(postRecord.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });

    console.log(`Updated time spent on asset for post ${postId} (record: ${postRecord.id}) to ${timeSpentOnAsset} hours`);
    
    return res.status(200).json({ 
      ok: true, 
      message: 'Time spent on asset updated successfully',
      postId: postRecord.id,
      postID: postId,
      timeSpentOnAsset: timeSpentOnAsset
    });

  } catch (error) {
    console.error('updatePostTimeSpent error:', error);
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
  const params = new URLSearchParams({
    filterByFormula: `{token} = "${tokenEscaped}"`,
    pageSize: '1',
  });
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  return (data.records && data.records[0]) || null;
}

async function findPostByPostID(PostID) {
  const postIDEscaped = safeEscapeFormulaString(PostID);
  let offset = null;
  
  do {
    const params = new URLSearchParams({
      filterByFormula: `{PostID} = "${postIDEscaped}"`,
      pageSize: '100',
    });
    
    if (offset) {
      params.set('offset', offset);
    }

    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records && data.records.length > 0) {
      // Find the post with matching PostID
      const matchingPost = data.records.find(record => 
        record.fields?.PostID === PostID
      );
      
      if (matchingPost) {
        return matchingPost;
      }
    }
    
    offset = data.offset; // Get next page offset
  } while (offset);
  
  return null; // Post not found
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
