import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_RSVP_TABLE = process.env.AIRTABLE_RSVP_TABLE || 'RSVP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  console.log('=== GetRSVPs API called ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token } = req.body || {};
  console.log('📝 Extracted token:', token ? `${token.substring(0, 10)}...` : 'undefined');
  
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }

  try {
    console.log('🔍 Looking for user by token...');
    // Find user by token
    const userRecord = await findUserByToken(token);
    console.log('👤 User record found:', userRecord ? 'YES' : 'NO');
    if (userRecord) {
      console.log('👤 User ID:', userRecord.id);
      console.log('👤 User fields:', Object.keys(userRecord.fields || {}));
    }
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    console.log('🎫 Looking for RSVPs for user...');
    console.log('🎫 User RSVPs field:', JSON.stringify(userRecord.fields?.RSVPs, null, 2));
    
    // Check if RSVPs are linked directly to user record
    let rsvps = [];
    if (Array.isArray(userRecord.fields?.RSVPs) && userRecord.fields.RSVPs.length > 0) {
      console.log('🎫 Found linked RSVPs in user record');
      // Fetch the full RSVP records using the linked IDs
      rsvps = await fetchRSVPRecords(userRecord.fields.RSVPs);
    } else {
      console.log('🎫 No linked RSVPs, trying separate table...');
      // Get all RSVPs for this user from separate table
      rsvps = await getUserRSVPs(userRecord.id);
    }
    
    console.log('🎫 RSVPs found:', rsvps.length);
    console.log('🎫 RSVPs data:', JSON.stringify(rsvps, null, 2));

    return res.status(200).json({ ok: true, rsvps });
  } catch (error) {
    console.error('❌ GetRSVPs error:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
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

async function fetchRSVPRecords(rsvpIds) {
  console.log('🎫 fetchRSVPRecords called with IDs:', rsvpIds);
  
  try {
    // Fetch each RSVP record individually
    const rsvpPromises = rsvpIds.map(async (rsvpId) => {
      const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_RSVP_TABLE)}/${encodeURIComponent(rsvpId)}`, {
        method: 'GET',
      });
      console.log('🎫 RSVP record data for', rsvpId, ':', JSON.stringify(data, null, 2));
      return {
        rsvpId: data.fields?.RSVPId || '',
        event: data.fields?.Event || '',
        recordId: data.id
      };
    });
    
    const rsvps = await Promise.all(rsvpPromises);
    console.log('🎫 Fetched RSVP records:', JSON.stringify(rsvps, null, 2));
    return rsvps;
  } catch (error) {
    console.log('❌ Error in fetchRSVPRecords:', error.message);
    return [];
  }
}

async function getUserRSVPs(userId) {
  console.log('🎫 getUserRSVPs called with userId:', userId);
  // SECURITY FIX: Escape the userId to prevent formula injection
  const userIdEscaped = safeEscapeFormulaString(userId);
  const formula = `{User} = "${userIdEscaped}"`;
  console.log('🎫 Airtable formula:', formula);
  const params = new URLSearchParams({
    filterByFormula: formula,
  });
  console.log('🎫 Airtable URL params:', params.toString());

  try {
    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_RSVP_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    console.log('🎫 Airtable response records count:', data.records ? data.records.length : 0);
    console.log('🎫 Airtable response data:', JSON.stringify(data, null, 2));
    
    const rsvps = data.records ? data.records.map(record => ({
      rsvpId: record.fields?.RSVPId || '',
      event: record.fields?.Event || '',
      recordId: record.id
    })) : [];
    console.log('🎫 Processed RSVPs:', JSON.stringify(rsvps, null, 2));
    
    return rsvps;
  } catch (error) {
    console.log('❌ Error in getUserRSVPs:', error.message);
    return [];
  }
}
