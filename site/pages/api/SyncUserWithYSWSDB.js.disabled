import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_YSWS_RECORD_HISTORY_TABLE = 'YSWS Record History';
const AIRTABLE_YSWS_ACTIVE_TABLE = 'Active YSWS Record';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameId, githubUrl, playLink } = req.body || {};
  if (!token) {
    return res.status(400).json({ message: 'Missing required field: token' });
  }
  if (!githubUrl || githubUrl.trim() === '') {
    return res.status(400).json({ message: 'Missing required field: githubUrl' });
  }
  if (!gameId) {
    return res.status(400).json({ message: 'Missing required field: gameId' });
  }

  try {
    // Find the user by token
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find the game record
    const gameRecord = await findGameById(gameId);
    if (!gameRecord) {
      return res.status(404).json({ message: 'Game not found' });
    }

    // Verify ownership of the game
    const ownerIds = normalizeLinkedIds(gameRecord?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: not the owner of this game' });
    }

    // Prepare the fields for both tables
    const fields = {
      'Code URL': githubUrl.trim(),
      'Game': [gameId],
      'User': [userRecord.id]
    };

    // Add Playable URL if provided, ensuring it ends with /
    if (playLink && playLink.trim() !== '') {
      const normalizedPlayLink = playLink.trim().endsWith('/') ? playLink.trim() : `${playLink.trim()}/`;
      fields['Playable URL'] = normalizedPlayLink;
    }

    // Add user fields
    const userFields = userRecord.fields || {};
    if (userFields['First Name']) fields['First Name'] = userFields['First Name'];
    if (userFields['Last Name']) fields['Last Name'] = userFields['Last Name'];
    if (userFields['Email']) fields['Email'] = userFields['Email'];
    if (userFields['github username']) fields['GitHub Username'] = userFields['github username'];
    if (userFields['street address']) fields['Address (Line 1)'] = userFields['street address'];
    if (userFields['street address #2']) fields['Address (Line 2)'] = userFields['street address #2'];
    if (userFields['city']) fields['City'] = userFields['city'];
    if (userFields['state']) fields['State / Province'] = userFields['state'];
    if (userFields['country']) fields['Country'] = userFields['country'];
    if (userFields['zipcode']) fields['ZIP / Postal Code'] = userFields['zipcode'];
    if (userFields['birthday']) fields['Birthday'] = userFields['birthday'];

    // Add game fields
    const gameFields = gameRecord.fields || {};
    if (Array.isArray(gameFields.Thumbnail) && gameFields.Thumbnail[0]?.url) {
      fields['Screenshot'] = [{ url: gameFields.Thumbnail[0].url }];
    }
    if (gameFields.Description) fields['Description'] = gameFields.Description;

    // Create fields for history (without Last Updated)
    const historyFields = { ...fields };

    // Create fields for active record (with Last Updated)
    const activeFields = { 
      ...fields,
      'Last Updated': new Date().toISOString() // UTC timestamp in ISO format
    };

    // Always create a new record in the "YSWS Record History" table
    const historyPayload = { records: [{ fields: historyFields }] };
    const historyCreated = await airtableRequest(encodeURIComponent(AIRTABLE_YSWS_RECORD_HISTORY_TABLE), {
      method: 'POST',
      body: JSON.stringify(historyPayload),
    });

    // Check if there's already a record for this game in the "Active YSWS Record" table
    console.log(`Looking for existing active record for game: ${gameId}`);
    const existingActiveRecord = await findActiveRecordByGameId(gameId);
    
    let activeResult;
    if (existingActiveRecord) {
      console.log(`Updating existing active record: ${existingActiveRecord.id}`);
      // Update existing record
      const updatePayload = { fields: activeFields };
      activeResult = await airtableRequest(`${encodeURIComponent(AIRTABLE_YSWS_ACTIVE_TABLE)}/${encodeURIComponent(existingActiveRecord.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(updatePayload),
      });
      console.log(`Update result:`, activeResult);
    } else {
      console.log(`Creating new active record for game: ${gameId}`);
      // Create new record
      const createPayload = { records: [{ fields: activeFields }] };
      activeResult = await airtableRequest(encodeURIComponent(AIRTABLE_YSWS_ACTIVE_TABLE), {
        method: 'POST',
        body: JSON.stringify(createPayload),
      });
      console.log(`Create result:`, activeResult);
    }

    if (historyCreated?.records?.[0] && activeResult) {
      return res.status(200).json({ 
        ok: true, 
        message: existingActiveRecord ? 'Successfully updated YSWS active record' : 'Successfully created YSWS active record',
        historyRecordId: historyCreated.records[0].id,
        activeRecordId: existingActiveRecord ? existingActiveRecord.id : activeResult.records?.[0]?.id
      });
    } else {
      return res.status(500).json({ message: 'Failed to sync YSWS records' });
    }
  } catch (error) {
    console.error('SyncUserWithYSWSDB error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred during sync.' });
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

async function findGameById(gameId) {
  try {
    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
      method: 'GET',
    });
    return data || null;
  } catch (error) {
    console.error('Error finding game by ID:', error);
    return null;
  }
}

async function findActiveRecordByGameId(gameId) {
  try {
    console.log(`Searching for active record with game ID: ${gameId}`);
    
    // Get all records from the Active YSWS Record table using pagination
    let allRecords = [];
    let offset = null;
    
    do {
      let params = new URLSearchParams({
        pageSize: '100', // Airtable max page size
      });
      
      if (offset) {
        params.set('offset', offset);
      }

      let data = await airtableRequest(`${encodeURIComponent(AIRTABLE_YSWS_ACTIVE_TABLE)}?${params.toString()}`, {
        method: 'GET',
      });
      
      if (data.records) {
        allRecords = allRecords.concat(data.records);
      }
      
      offset = data.offset; // Get next page offset
    } while (offset);
    
    console.log(`Found ${allRecords.length} total active records`);
    
    // Check if we found a record
    if (allRecords.length > 0) {
      // Find the exact match by checking each record's Game field
      const exactMatch = allRecords.find(record => {
        const gameField = record.fields?.Game;
        console.log(`Checking record ${record.id}, Game field:`, gameField);
        
        if (Array.isArray(gameField)) {
          // Game field is an array of linked record IDs
          return gameField.includes(gameId);
        } else if (typeof gameField === 'string') {
          // Game field might be a single string
          return gameField === gameId;
        }
        return false;
      });
      
      if (exactMatch) {
        console.log(`Found existing active record for game ${gameId}: ${exactMatch.id}`);
        return exactMatch;
      }
    }

    console.log(`No existing active record found for game ${gameId}, will create new one`);
    return null;
  } catch (error) {
    console.error('Error finding active record by game ID:', error);
    return null;
  }
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
