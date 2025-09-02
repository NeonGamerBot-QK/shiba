// Shomato API endpoint disabled - event is over
/*
import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, PostID } = req.body || {};
  if (!token || !PostID) {
    return res.status(400).json({ message: 'Missing required fields: token, PostID' });
  }

  try {
    // Find user by token
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check ShomatoBalance - user must have balance > 0 to send shomato
    const shomatoBalance = user.fields?.ShomatoBalance || 0;
    if (shomatoBalance <= 0) {
      return res.status(403).json({ 
        message: 'Insufficient shomato balance. You need at least 1 shomato to send.',
        currentBalance: shomatoBalance
      });
    }

    // Find post by PostID (iterate through all posts 100 at a time)
    const postRecord = await findPostByPostID(PostID);
    if (!postRecord) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the post belongs to the user (prevent self-shomatoing)
    const gameIds = normalizeLinkedIds(postRecord.fields?.Game);
    if (gameIds.length > 0) {
      // Get the first game (posts typically have one game)
      const gameId = gameIds[0];
      const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
      const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
      
      if (ownerIds.includes(user.id)) {
        return res.status(403).json({ message: 'You cannot send shomato to your own post' });
      }
    }

    // Get current SendShomatoToPost field value
    const currentShomatos = user.fields?.SendShomatoToPost || [];
    const currentShomatoIds = Array.isArray(currentShomatos) 
      ? currentShomatos.map(item => typeof item === 'string' ? item : item.id)
      : [];

    // Check if post is already in the list
    if (currentShomatoIds.includes(postRecord.id)) {
      return res.status(400).json({ message: 'Post has already been shomatoed by you' });
    }

    // Add the post record ID to the SendShomatoToPost field
    const updatedShomatos = [...currentShomatoIds, postRecord.id];
    
    const updatePayload = {
      fields: {
        SendShomatoToPost: updatedShomatos
      }
    };

    await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });

    console.log(`Added shomato to post ${PostID} (record: ${postRecord.id}) for user ${user.id}`);
    
    return res.status(200).json({ 
      ok: true, 
      message: 'Shomato sent successfully',
      postId: postRecord.id,
      postID: PostID
    });

  } catch (error) {
    console.error('sendShomatoToPost error:', error);
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
*/

// Placeholder function to prevent errors
export default async function handler(req, res) {
  return res.status(410).json({ message: 'Shomato event is over. This endpoint has been disabled.' });
}
