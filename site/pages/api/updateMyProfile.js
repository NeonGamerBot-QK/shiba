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

  const { token, profile } = req.body || {};
  if (!token || typeof profile !== 'object' || profile === null) {
    return res.status(400).json({ message: 'Missing required fields: token, profile' });
  }

  try {
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    const updates = buildAirtableFieldsFromProfile(profile);
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ ok: true, profile: normalizeProfileFields(user.fields || {}) });
    }

    const payload = { fields: updates };
    await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(user.id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    // Read back
    const refreshed = await getUserById(user.id);
    const normalized = normalizeProfileFields((refreshed && refreshed.fields) || {});
    return res.status(200).json({ ok: true, profile: normalized });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('updateMyProfile error:', e);
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

async function getUserById(id) {
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  return data || null;
}

function buildAirtableFieldsFromProfile(p) {
  const out = {};
  if (typeof p.githubUsername === 'string') {
    const c = p.githubUsername.trim();
    if (c.length > 0 && c.length <= 39 && /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(c)) {
      out['github username'] = c;
    }
  }
  
  if (typeof p.firstName === 'string') {
    const c = p.firstName.trim().replace(/[<>&"']/g, '').substring(0, 50);
    if (c.length > 0) out['First Name'] = c;
  }
  if (typeof p.lastName === 'string') {
    const c = p.lastName.trim().replace(/[<>&"']/g, '').substring(0, 50);
    if (c.length > 0) out['Last Name'] = c;
  }
  
  if (p.birthday) {
    out['birthday'] = String(p.birthday);
  }
  
  if (typeof p.phoneNumber === 'string') {
    const c = p.phoneNumber.trim();
    if (c.length > 0 && c.length <= 20) {
      out['phone number'] = c;
    }
  }
  
  if (typeof p.slackId === 'string') {
    const c = p.slackId.trim();
    if (/^[A-Za-z0-9_-]{1,50}$/.test(c)) {
      out['slack id'] = c;
    }
  }
  
  if (p.address && typeof p.address === 'object') {
    if (typeof p.address.street1 === 'string') {
      const c = p.address.street1.trim().substring(0, 100);
      if (c.length > 0) out['street address'] = c;
    }
    if (typeof p.address.street2 === 'string') {
      const c = p.address.street2.trim().substring(0, 100);
      if (c.length > 0) out['street address #2'] = c;
    }
    if (typeof p.address.city === 'string') {
      const c = p.address.city.trim().replace(/[<>&"']/g, '').substring(0, 50);
      if (c.length > 0) out['city'] = c;
    }
    if (typeof p.address.state === 'string') {
      const c = p.address.state.trim().replace(/[<>&"']/g, '').substring(0, 50);
      if (c.length > 0) out['state'] = c;
    }
    if (typeof p.address.zipcode === 'string') {
      const c = p.address.zipcode.trim().replace(/[^A-Za-z0-9\s-]/g, '').substring(0, 20);
      if (c.length > 0) out['zipcode'] = c;
    }
    if (typeof p.address.country === 'string') {
      const c = p.address.country.trim().replace(/[<>&"']/g, '').substring(0, 50);
      if (c.length > 0) out['country'] = c;
    }
  }
  return out;
}

function normalizeProfileFields(f) {
  return {
    email: typeof f.Email === 'string' ? f.Email : '',
    githubUsername: typeof f['github username'] === 'string' ? f['github username'] : '',
    firstName: typeof f['First Name'] === 'string' ? f['First Name'] : '',
    lastName: typeof f['Last Name'] === 'string' ? f['Last Name'] : '',
    birthday: f['birthday'] || '',
    phoneNumber: typeof f['phone number'] === 'string' ? f['phone number'] : '',
    slackId: typeof f['slack id'] === 'string' ? f['slack id'] : '',
    referralCode: typeof f['ReferralCode'] === 'string' ? f['ReferralCode'] : '',
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


