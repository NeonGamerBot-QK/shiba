require('dotenv').config();

// Test the main sync logic for daysActive
async function testMainSyncLogic() {
  console.log('🧪 Testing main sync daysActive logic...');
  
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
  const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

  // Helper function to make Airtable requests
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

  // Helper function to fetch all records from a table
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

  try {
    // Test the optimized approach
    console.log('Fetching all users and games...');
    const [allUsers, allGames] = await Promise.all([
      fetchAllAirtableRecords(AIRTABLE_USERS_TABLE),
      fetchAllAirtableRecords(AIRTABLE_GAMES_TABLE)
    ]);
    
    console.log(`Fetched ${allUsers.length} users and ${allGames.length} games`);
    
    // Group games by user (slack id) for efficient lookup
    const gamesByUser = {};
    allGames.forEach(game => {
      const slackId = game.fields?.['slack id'];
      if (slackId) {
        if (!gamesByUser[slackId]) {
          gamesByUser[slackId] = [];
        }
        gamesByUser[slackId].push(game);
      }
    });
    
    console.log(`Grouped games for ${Object.keys(gamesByUser).length} users`);
    
    // Test with Thomas's Slack ID
    const thomasSlackId = 'U08SF8MVC82';
    const thomasGames = gamesByUser[thomasSlackId] || [];
    
    console.log(`Thomas's games: ${thomasGames.length}`);
    thomasGames.forEach(game => {
      console.log(`  - ${game.fields?.Name}: ${game.fields?.['Hackatime Projects']}`);
    });
    
    // Test the old approach for comparison
    console.log('\nTesting old approach...');
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    params.set('filterByFormula', `{slack id} = '${thomasSlackId}'`);
    
    const oldApproachGames = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, { method: 'GET' });
    const oldGames = oldApproachGames?.records || [];
    
    console.log(`Old approach found ${oldGames.length} games for Thomas`);
    oldGames.forEach(game => {
      console.log(`  - ${game.fields?.Name}: ${game.fields?.['Hackatime Projects']}`);
    });
    
    // Compare results
    if (thomasGames.length === oldGames.length) {
      console.log('✅ Both approaches return the same number of games');
    } else {
      console.log('❌ Different number of games found!');
      console.log(`Optimized: ${thomasGames.length}, Old: ${oldGames.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing main sync logic:', error.message);
  }
}

testMainSyncLogic().catch(console.error);
