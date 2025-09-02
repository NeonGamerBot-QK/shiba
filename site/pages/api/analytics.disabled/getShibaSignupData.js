const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    // Get all users from the Users table
    const allUsers = await fetchAllAirtableRecords(AIRTABLE_USERS_TABLE);
    
    // Count users by referral source
    let hackClubCommunity = 0;
    let referrals = 0;
    
    allUsers.forEach(user => {
      const referredBy = user.fields?.ReferredBy;
      
      if (!referredBy || referredBy === '' || referredBy === null || referredBy === undefined) {
        hackClubCommunity++;
      } else {
        referrals++;
      }
    });

    const totalSignups = allUsers.length;

    const signupData = {
      totalSignups,
      hackClubCommunity,
      referrals
    };

    res.status(200).json(signupData);
  } catch (error) {
    console.error('getShibaSignupData error:', error);
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

async function fetchAllAirtableRecords(tableName) {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    
    const page = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, { method: 'GET' });
    allRecords = allRecords.concat(page?.records || []);
    offset = page?.offset;
  } while (offset);
  
  return allRecords;
}
