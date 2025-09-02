import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
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

    // Find post by PostID (iterate through all posts 100 at a time)
    const postRecord = await findPostByPostID(PostID);
    if (!postRecord) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Get current SendShomatoToPost field value
    const currentShomatos = user.fields?.SendShomatoToPost || [];
    const currentShomatoIds = Array.isArray(currentShomatos) 
      ? currentShomatos.map(item => typeof item === 'string' ? item : item.id)
      : [];

    // Check if post is in the list
    if (!currentShomatoIds.includes(postRecord.id)) {
      return res.status(400).json({ message: 'Post does not have a shomato from this user' });
    }

    // Remove the post record ID from the SendShomatoToPost field
    const updatedShomatos = currentShomatoIds.filter(id => id !== postRecord.id);
    
    const updatePayload = {
      fields: {
        SendShomatoToPost: updatedShomatos
      }
    };

    await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });

    console.log(`Removed shomato from post ${PostID} (record: ${postRecord.id}) for user ${user.id}`);
    
    return res.status(200).json({ 
      ok: true, 
      message: 'Shomato removed successfully',
      postId: postRecord.id,
      postID: PostID
    });

  } catch (error) {
    console.error('unsendShomatoToPost error:', error);
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
