import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
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

  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }

  try {
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Update the user's hasOnboarded field to true
    const updateRes = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        fields: {
          'hasOnboarded': true
        }
      })
    });

    if (!updateRes || !updateRes.id) {
      return res.status(500).json({ message: 'Failed to update onboarding status' });
    }

    // Return the updated profile
    const f = updateRes.fields || {};
    const profile = normalizeProfileFields(f);
    return res.status(200).json({ ok: true, profile });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('CompleteOnboarding error:', e);
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

function normalizeProfileFields(f) {
  return {
    email: typeof f.Email === 'string' ? f.Email : '',
    githubUsername: typeof f['github username'] === 'string' ? f['github username'] : '',
    firstName: typeof f['First Name'] === 'string' ? f['First Name'] : '',
    lastName: typeof f['Last Name'] === 'string' ? f['Last Name'] : '',
    birthday: typeof f['birthday'] === 'string' ? f['birthday'] : '',
    slackId: typeof f['slack id'] === 'string' ? f['slack id'] : '',
    hasOnboarded: typeof f['hasOnboarded'] === 'boolean' ? f['hasOnboarded'] : true,
    address: {
      street1: typeof f['street address'] === 'string' ? f['street address'] : '',
      street2: typeof f['street address #2'] === 'string' ? f['street address #2'] : '',
      city: typeof f['city'] === 'string' ? f['city'] : '',
      state: typeof f['state'] === 'string' ? f['state'] : '',
      zipcode: typeof f['zipcode'] === 'string' ? f['zipcode'] : '',
      country: typeof f['country'] === 'string' ? f['country'] : '',
    },
  };
}
