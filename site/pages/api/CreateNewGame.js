import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
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

  const { token, name, description } = req.body || {};
  if (!token || !name) {
    return res.status(400).json({ message: 'Missing required fields: token, name' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const payload = {
      records: [
        {
          fields: {
            Owner: [userRecord.id],
            Name: String(name).substring(0, 100), // Limit name length
            Description: typeof description === 'string' ? description.substring(0, 1000) : '',
          },
        },
      ],
    };

    const created = await airtableRequest(encodeURIComponent(AIRTABLE_GAMES_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const rec = created?.records?.[0];
    const result = rec
      ? { id: rec.id, name: rec.fields?.Name || '', description: rec.fields?.Description || '' }
      : null;

    return res.status(200).json({ ok: true, game: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('CreateNewGame error:', error);
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


