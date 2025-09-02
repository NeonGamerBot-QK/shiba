import { safeEscapeFormulaString, generateSecureRandomString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_PLAYS_TABLE = process.env.AIRTABLE_PLAYS_TABLE || 'Plays';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameName } = req.body || {};
  
  if (!token || !gameName) {
    return res.status(400).json({ message: 'Missing required fields: token, gameName' });
  }

  try {
    // Find user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find game by name
    const gameRecord = await findGameByName(gameName);
    if (!gameRecord) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Generate random 16-character PlayID
    const playId = generatePlayId();

    const payload = {
      records: [
        {
          fields: {
            PlayID: playId,
            Game: [gameRecord.id],
            Player: [userRecord.id],
          },
        },
      ],
    };

    const created = await airtableRequest(encodeURIComponent(AIRTABLE_PLAYS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const rec = created?.records?.[0];
    const result = rec
      ? { 
          playId: rec.fields?.PlayID || '', 
          gameId: rec.fields?.Game?.[0] || '', 
          playerId: rec.fields?.Player?.[0] || '',
          recordId: rec.id
        }
      : null;

    return res.status(200).json({ ok: true, play: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('CreatePlay error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

function generatePlayId() {
  return generateSecureRandomString(16);
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
      const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
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
