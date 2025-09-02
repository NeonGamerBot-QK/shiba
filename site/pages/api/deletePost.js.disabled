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

  const { token, postId } = req.body || {};
  if (!token || !postId) {
    return res.status(400).json({ message: 'Missing required fields: token, postId' });
  }

  try {
    // Find user by token to verify ownership
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Fetch the post to get the associated game
    const post = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(postId)}`, {
      method: 'GET',
    });
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get the game ID from the post
    const gameIds = normalizeLinkedIds(post?.fields?.Game);
    if (!gameIds || gameIds.length === 0) {
      return res.status(400).json({ message: 'Post is not associated with any game' });
    }

    const gameId = gameIds[0];

    // Fetch the game to verify ownership
    const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
      method: 'GET',
    });
    
    if (!game) {
      return res.status(404).json({ message: 'Associated game not found' });
    }

    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: not the owner of this game' });
    }

    // Delete the post record
    await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('deletePost error:', error);
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
  
  // Try different field names like in newLogin.js
  const candidateFields = ['token', 'Token', 'User Token'];
  
  for (const fieldName of candidateFields) {
    const formula = `{${fieldName}} = "${tokenEscaped}"`;
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: '1',
    });

    try {
      const data = await airtableRequest(`${encodeURIComponent('Users')}?${params.toString()}`, {
        method: 'GET',
      });
      
      if (data.records && data.records.length > 0) {
        return data.records[0];
      }
    } catch (error) {
      // Continue to next field name
    }
  }
  
  return null;
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
