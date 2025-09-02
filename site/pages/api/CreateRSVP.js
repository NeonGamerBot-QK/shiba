import { safeEscapeFormulaString, generateSecureRandomString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_RSVP_TABLE = process.env.AIRTABLE_RSVP_TABLE || 'RSVP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, event } = req.body || {};
  if (!token || !event) {
    return res.status(400).json({ message: 'Missing required fields: token, event' });
  }

  try {
    // Find user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Check if user already RSVPed for this event
    console.log('🔍 Checking for existing RSVP for user:', userRecord.id, 'event:', event);
    const existingRSVP = await findExistingRSVP(userRecord.id, event);
    console.log('🔍 Existing RSVP found:', existingRSVP ? 'YES' : 'NO');
    if (existingRSVP) {
      console.log('❌ User already RSVPed for this event, returning 409');
      return res.status(409).json({ message: 'Already RSVPed for this event' });
    }

    // Generate random RSVPId
    const rsvpId = generateRSVPId();

    const payload = {
      records: [
        {
          fields: {
            RSVPId: rsvpId,
            User: [userRecord.id],
            Event: event,
          },
        },
      ],
    };

    const created = await airtableRequest(encodeURIComponent(AIRTABLE_RSVP_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const rec = created?.records?.[0];
    const result = rec
      ? { 
          rsvpId: rec.fields?.RSVPId || '', 
          userId: rec.fields?.User?.[0] || '', 
          event: rec.fields?.Event || '',
          recordId: rec.id
        }
      : null;

    return res.status(200).json({ ok: true, rsvp: result });
  } catch (error) {
    console.error('CreateRSVP error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

function generateRSVPId() {
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

async function findExistingRSVP(userId, event) {
  // SECURITY FIX: Escape both userId and event to prevent formula injection
  const userIdEscaped = safeEscapeFormulaString(userId);
  const eventEscaped = safeEscapeFormulaString(event);
  const formula = `AND({User} = "${userIdEscaped}", {Event} = "${eventEscaped}")`;
  console.log('🔍 Airtable formula for existing RSVP:', formula);
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  try {
    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_RSVP_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    console.log('🔍 Airtable response for existing RSVP:', data.records ? data.records.length : 0, 'records');
    
    return data.records && data.records.length > 0 ? data.records[0] : null;
  } catch (error) {
    console.log('❌ Error checking for existing RSVP:', error.message);
    return null;
  }
}
