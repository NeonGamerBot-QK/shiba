import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_PLAYTESTS_TABLE = process.env.AIRTABLE_PLAYTESTS_TABLE || 'PlaytestTickets';
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
    // Find user by token
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    console.log('Found user:', user.id);

    // Get playtests for this user
    const playtests = await getPlaytestsForUser(user.id);
    
    console.log('Found playtests:', playtests);
    
    return res.status(200).json({ ok: true, playtests });
  } catch (error) {
    console.error('GetMyPlaytests error:', error);
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

async function getAllRecordsWithPagination(tableName, filterFormula = null) {
  let allRecords = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams();
    if (filterFormula) {
      params.set('filterByFormula', filterFormula);
    }
    if (offset) {
      params.set('offset', offset);
    }
    
    const data = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records) {
      allRecords = allRecords.concat(data.records);
    }
    
    offset = data.offset;
    console.log(`Fetched ${data.records?.length || 0} records, total so far: ${allRecords.length}, has more: ${!!offset}`);
  } while (offset);
  
  return allRecords;
}

async function getPlaytestsForUser(userId) {
  const userEscaped = safeEscapeFormulaString(userId);
  console.log('Looking for playtests for user:', userId);
  
  let records = [];
  
  // Method 1: Try direct comparison with the linked record
  try {
    const filterFormula = `{Player} = "${userEscaped}"`;
    console.log('Trying filter formula 1:', filterFormula);
    
    records = await getAllRecordsWithPagination(AIRTABLE_PLAYTESTS_TABLE, filterFormula);
    console.log('Method 1 results:', records.length);
  } catch (error) {
    console.log('Method 1 failed:', error.message);
  }
  
  // If that doesn't work, try method 2
  if (records.length === 0) {
    try {
      const filterFormula = `FIND("${userEscaped}", ARRAYJOIN({Player}))`;
      console.log('Trying filter formula 2:', filterFormula);
      
      records = await getAllRecordsWithPagination(AIRTABLE_PLAYTESTS_TABLE, filterFormula);
      console.log('Method 2 results:', records.length);
    } catch (error) {
      console.log('Method 2 failed:', error.message);
    }
  }
  
  // If still no results, try method 3 - get all and filter client-side
  if (records.length === 0) {
    try {
      console.log('Falling back to client-side filtering...');
      const allRecords = await getAllRecordsWithPagination(AIRTABLE_PLAYTESTS_TABLE);
      console.log('Got all records:', allRecords.length);
      
      records = allRecords.filter(record => {
        const player = record.fields['Player'];
        console.log('Checking record player field:', player, 'against userId:', userId);
        
        // Handle both array and single value cases
        if (Array.isArray(player)) {
          return player.includes(userId);
        } else if (typeof player === 'string') {
          return player === userId;
        }
        return false;
      });
      
      console.log('Method 3 (client-side) results:', records.length);
    } catch (error) {
      console.log('Method 3 failed:', error.message);
    }
  }
  
  if (!records || records.length === 0) {
    console.log('No playtests found for user');
    return [];
  }
  
  // Get game details for each playtest
  const playtestsWithDetails = await Promise.all(
    records.map(async (playtest) => {
      console.log('Playtest fields:', JSON.stringify(playtest.fields, null, 2));
      
      const gameToTestId = Array.isArray(playtest.fields.GameToTest) 
        ? playtest.fields.GameToTest[0] 
        : playtest.fields.GameToTest;
      
      let gameDetails = {
        gameName: '',
        gameThumbnail: '',
        playableURL: ''
      };
      
      // Fetch game details if we have a game ID
      if (gameToTestId) {
        try {
          const gameData = await airtableRequest(`Games/${encodeURIComponent(gameToTestId)}`, {
            method: 'GET',
          });
          
          if (gameData && gameData.fields) {
            gameDetails.gameName = gameData.fields.Name || '';
            gameDetails.playableURL = gameData.fields['Playable URL'] || '';
            
            // Handle thumbnail - it might be an array of attachment objects
            if (gameData.fields.Thumbnail && Array.isArray(gameData.fields.Thumbnail)) {
              gameDetails.gameThumbnail = gameData.fields.Thumbnail[0]?.url || '';
            } else if (typeof gameData.fields.Thumbnail === 'string') {
              gameDetails.gameThumbnail = gameData.fields.Thumbnail;
            }
            
            // Get the game owner's slack ID
            const ownerId = Array.isArray(gameData.fields.Owner) 
              ? gameData.fields.Owner[0] 
              : gameData.fields.Owner;
            
            if (ownerId) {
              try {
                const ownerData = await airtableRequest(`Users/${encodeURIComponent(ownerId)}`, {
                  method: 'GET',
                });
                
                if (ownerData && ownerData.fields) {
                  gameDetails.ownerSlackId = ownerData.fields['slack id'] || '';
                }
              } catch (error) {
                console.log('Error fetching owner details for:', ownerId, error.message);
              }
            }
            
            console.log('Fetched game details:', gameDetails);
          }
        } catch (error) {
          console.log('Error fetching game details for:', gameToTestId, error.message);
        }
      }
      
      return {
        id: playtest.id,
        playtestId: playtest.fields.PlaytestId || playtest.fields.PlaytestID || '',
        gameToTest: gameToTestId || '',
        status: playtest.fields.status || 'Pending',
        createdAt: playtest.fields['Created At'] || playtest.createdTime,
        instructions: playtest.fields.Instructions || '',
        gameName: gameDetails.gameName || playtest.fields.GameName || playtest.fields['Game Name'] || '',
        gameLink: gameDetails.playableURL || playtest.fields.GameLink || playtest.fields['Game Link'] || '',
        gameThumbnail: gameDetails.gameThumbnail || '',
        ownerSlackId: gameDetails.ownerSlackId || '',
        HoursSpent: playtest.fields?.HoursSpent || 0,
        // Rating data for completed playtests
        funScore: playtest.fields['Fun Score'] || 0,
        artScore: playtest.fields['Art Score'] || 0,
        creativityScore: playtest.fields['Creativity Score'] || 0,
        audioScore: playtest.fields['Audio Score'] || 0,
        moodScore: playtest.fields['Mood Score'] || 0,
        feedback: playtest.fields['Feedback'] || 0,
        playtimeSeconds: playtest.fields['Playtime Seconds'] || 0,
      };
    })
  );
  
  console.log('Returning formatted playtests:', playtestsWithDetails.length);
  return playtestsWithDetails;
}
