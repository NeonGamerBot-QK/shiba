require('dotenv').config();

// Test script for thomas@serenidad.app user only
async function testThomasUser() {
  console.log('🧪 Testing spans and post hours functionality for thomas@serenidad.app');
  
  // First, let's find the Slack ID for thomas@serenidad.app
  const email = 'losdos2341@gmail.com';
  const slackId = await findSlackIdByEmail(email);
  
  if (!slackId) {
    console.log('❌ Could not find Slack ID for thomas@serenidad.app');
    return;
  }
  
  console.log(`✅ Found Slack ID: ${slackId}`);
  
  // Get all games for this user
  const games = await fetchGamesForUser(slackId);
  console.log(`📊 Found ${games.length} games for ${email}`);
  
  if (games.length === 0) {
    console.log('❌ No games found for this user');
    return;
  }
  
  // Get user's email for fallback
  const user = await findUserBySlackId(slackId);
  const userEmail = user?.fields?.Email;
  
  // Fetch Hackatime data for this user
  console.log('🔄 Fetching Hackatime data...');
  const hackatimeData = await fetchHackatimeData(slackId, userEmail);
  console.log(`📈 Found ${hackatimeData.projects.length} projects in Hackatime`);
  
  // Fetch spans data
  console.log('🔄 Fetching spans data...');
  const spansData = await fetchHackatimeSpans(slackId, userEmail);
  console.log(`⏱️ Found spans for ${Object.keys(spansData).length} projects`);
  
  // Process each game
  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const gameName = game.fields?.Name || 'Unknown Game';
    const projects = game.fields?.['Hackatime Projects'];
    
    console.log(`\n🎮 Processing game ${i + 1}/${games.length}: ${gameName}`);
    console.log(`📋 Projects: ${projects}`);
    
    if (!projects) {
      console.log('⚠️ No Hackatime projects found, skipping...');
      continue;
    }
    
    // Calculate total seconds for this game
    const totalSeconds = calculateProjectSeconds(hackatimeData, projects);
    console.log(`⏱️ Total seconds: ${totalSeconds}`);
    
    // Update game's HackatimeSeconds
    try {
      await updateGameHackatimeSeconds(game.id, totalSeconds);
      console.log(`✅ Updated game HackatimeSeconds`);
    } catch (error) {
      console.error(`❌ Failed to update game:`, error.message);
    }
    
    // Process posts for this game
    try {
      await processGamePosts(game, spansData, projects);
      console.log(`✅ Processed posts for game`);
    } catch (error) {
      console.error(`❌ Failed to process posts:`, error.message);
    }
  }
  
  console.log('\n🎉 Test completed!');
  
  // Test the new daysActive functionality
  console.log('\n🧪 Testing daysActive functionality...');
  await testDaysActiveFunctionality(slackId);
}

// Helper functions
async function findSlackIdByEmail(email) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  try {
    const params = new URLSearchParams();
    params.set('filterByFormula', `{Email} = '${email}'`);
    
    const response = await fetch(`${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const records = data.records || [];
    
    if (records.length > 0) {
      return records[0].fields?.['slack id'];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding Slack ID:', error.message);
    return null;
  }
}

async function fetchGamesForUser(slackId) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  try {
    const params = new URLSearchParams();
    params.set('filterByFormula', `{slack id} = '${slackId}'`);
    
    const response = await fetch(`${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error('Error fetching games:', error.message);
    return [];
  }
}

// Helper function to fetch Hackatime data by email
async function fetchHackatimeDataByEmail(email) {
  if (!email) throw new Error('Missing email');
  
  console.log(`Looking up Hackatime user by email: ${email}`);
  const lookupResponse = await fetch(`https://hackatime.hackclub.com/api/v1/users/lookup_email/${encodeURIComponent(email)}`, {
    headers: {
      "Rack-Attack-Bypass": process.env.HACKATIME_RATE_LIMIT_BYPASS || '',
      "Authorization": "Bearer " + (process.env.STATS_API_KEY || ''),
      "Accept": "application/json"
    }
  });
  
  if (!lookupResponse.ok) {
    throw new Error(`Email lookup failed: ${lookupResponse.status}`);
  }
  
  const lookupData = await lookupResponse.json().catch(() => ({}));
  const hackatimeUserId = lookupData.user_id || lookupData.id;
  
  if (!hackatimeUserId) {
    throw new Error('User not found with that email');
  }
  
  console.log(`Found Hackatime user ID: ${hackatimeUserId}`);
  return hackatimeUserId;
}

// Helper function to fetch stats for a given user ID
async function fetchHackatimeStats(userId) {
  const start_date = process.env.HACKATIME_START_DATE || '2025-08-18';
  const end_date = process.env.HACKATIME_END_DATE || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(userId)}/stats?features=projects&start_date=${start_date}&end_date=${end_date}`;
  
  const headers = { Accept: 'application/json' };
  if (process.env.RACK_ATTACK_BYPASS) {
    headers['Rack-Attack-Bypass'] = process.env.RACK_ATTACK_BYPASS;
  }
  
  const response = await fetch(url, { headers });
  
  if (response.status === 429) {
    throw new Error('429: Rate limit exceeded');
  }
  
  if (!response.ok) {
    throw new Error(`Hackatime API error ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  const projects = Array.isArray(data?.data?.projects) ? data.data.projects : [];
  const total_seconds = data?.data?.total_seconds || 0;
  
  return { projects, total_seconds };
}

// Hackatime API integration with email fallback
async function fetchHackatimeData(slackId, email = null) {
  if (!slackId && !email) throw new Error('Missing both slackId and email');
  
  let hackatimeUserId;
  let method = 'slackId';
  let fallbackUsed = false;
  
  // Try slackId first if provided
  if (slackId) {
    try {
      console.log(`Trying slackId method for: ${slackId}`);
      hackatimeUserId = slackId;
      const result = await fetchHackatimeStats(hackatimeUserId);
      
      // If we got projects from slackId, return them
      if (result.projects.length > 0) {
        console.log(`Found ${result.projects.length} projects using slackId method`);
        return { ...result, method, fallbackUsed };
      } else {
        console.log('No projects found with slackId, falling back to email method');
        fallbackUsed = true;
      }
    } catch (error) {
      console.log(`slackId method failed, falling back to email method: ${error.message}`);
      fallbackUsed = true;
    }
  }
  
  // Use email method if:
  // 1. Only email is provided, OR
  // 2. slackId was provided but returned no projects or failed
  if (email && (!slackId || fallbackUsed)) {
    try {
      hackatimeUserId = await fetchHackatimeDataByEmail(email);
      method = 'email';
      const result = await fetchHackatimeStats(hackatimeUserId);
      return { ...result, method, fallbackUsed };
    } catch (error) {
      throw new Error(`Both slackId and email methods failed. SlackId error: ${slackId ? 'no projects or failed' : 'not provided'}, Email error: ${error.message}`);
    }
  }
  
  throw new Error('No valid method available');
}

async function fetchHackatimeSpans(slackId, email = null) {
  if (!slackId && !email) throw new Error('Missing both slackId and email');
  
  const start_date = process.env.HACKATIME_START_DATE || '2025-08-18';
  
  // Get all projects for this user first
  const hackatimeData = await fetchHackatimeData(slackId, email);
  const projects = hackatimeData.projects || [];
  
  const allSpans = {};
  
  // Fetch spans for each project
  for (const project of projects) {
    if (!project.name) continue;
    
    const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/heartbeats/spans?start_date=${start_date}&project=${encodeURIComponent(project.name)}`;
    
    console.log(`  📊 Fetching spans for project "${project.name}"...`);
    const headers = { Accept: 'application/json' };
    if (process.env.RACK_ATTACK_BYPASS) {
      headers['Rack-Attack-Bypass'] = process.env.RACK_ATTACK_BYPASS;
    }
    
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        console.log(`  ⚠️ Rate limited for project "${project.name}", skipping...`);
        continue;
      }
      
      if (!response.ok) {
        console.log(`  ❌ Failed to fetch spans for project "${project.name}": ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const spans = Array.isArray(data?.spans) ? data.spans : [];
      allSpans[project.name] = spans;
      
      console.log(`  ✅ Found ${spans.length} spans for "${project.name}"`);
      
      // Small delay between project requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`  ❌ Error fetching spans for project "${project.name}":`, error.message);
    }
  }
  
  return allSpans;
}

function calculateProjectSeconds(hackatimeData, gameProjectsField) {
  let totalSeconds = 0;
  
  if (!gameProjectsField || !hackatimeData.projects.length) {
    return totalSeconds;
  }
  
  const projectNames = Array.isArray(gameProjectsField) 
    ? gameProjectsField.filter(Boolean)
    : (typeof gameProjectsField === 'string' ? gameProjectsField.split(',').map(p => p.trim()) : []);
  
  for (const projectName of projectNames) {
    if (!projectName) continue;
    
    const projectNameLower = projectName.toLowerCase();
    const matchingProject = hackatimeData.projects.find(p => 
      p.name && p.name.toLowerCase() === projectNameLower
    );
    
    if (matchingProject) {
      totalSeconds += matchingProject.total_seconds || 0;
      console.log(`    📊 Project "${projectName}": ${matchingProject.total_seconds}s`);
    } else {
      console.log(`    ⚠️ Project "${projectName}": NOT FOUND`);
    }
  }
  
  return totalSeconds;
}

async function updateGameHackatimeSeconds(gameId, seconds) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${gameId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        HackatimeSeconds: seconds
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to update game ${gameId}: ${response.status} ${errorText}`);
  }
  
  return true;
}

async function fetchPostsForGame(gameId) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    params.set('sort[0][field]', 'Created At');
    params.set('sort[0][direction]', 'asc');
    if (offset) params.set('offset', offset);
    
    const response = await fetch(`${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const pageRecords = data?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = data?.offset;
    
  } while (offset);
  
  // Filter posts that are linked to this game
  const postsForGame = allRecords.filter((rec) => {
    const linkedGameIds = normalizeLinkedIds(rec?.fields?.Game);
    return linkedGameIds.includes(gameId);
  });
  
  return postsForGame;
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

async function processGamePosts(game, spansData, gameProjects) {
  const gameId = game.id;
  const gameName = game.fields?.Name || 'Unknown Game';
  
  // Get project names for this game
  const projectNames = Array.isArray(gameProjects) 
    ? gameProjects.filter(Boolean)
    : (typeof gameProjects === 'string' ? gameProjects.split(',').map(p => p.trim()) : []);
  
  if (projectNames.length === 0) {
    console.log('    ⚠️ No projects found, skipping post processing');
    return;
  }
  
  // Fetch all posts for this game
  const posts = await fetchPostsForGame(gameId);
  console.log(`    📝 Found ${posts.length} posts for game ${gameName}`);
  
  if (posts.length === 0) {
    return;
  }
  
  // Filter out posts that already have TimeSpentOnAsset field populated
  const postsToProcess = posts.filter(post => {
    const timeSpentOnAsset = post.fields?.['TimeSpentOnAsset'];
    if (timeSpentOnAsset !== null && timeSpentOnAsset !== undefined && timeSpentOnAsset !== '') {
      console.log(`    ⏭️ Skipping post ${post.id} - TimeSpentOnAsset already populated: ${timeSpentOnAsset}`);
      return false;
    }
    return true;
  });
  
  console.log(`    🔄 Processing ${postsToProcess.length} posts (${posts.length - postsToProcess.length} skipped due to existing TimeSpentOnAsset)`);
  
  if (postsToProcess.length === 0) {
    return;
  }
  
  // Sort posts by creation time (oldest first)
  postsToProcess.sort((a, b) => {
    const aTime = new Date(a.fields?.['Created At'] || a.createdTime || 0).getTime() / 1000;
    const bTime = new Date(b.fields?.['Created At'] || b.createdTime || 0).getTime() / 1000;
    return aTime - bTime;
  });
  
  // Calculate hours spent for each post
  for (let i = 0; i < postsToProcess.length; i++) {
    const post = postsToProcess[i];
    const postId = post.id;
    const createdAt = new Date(post.fields?.['Created At'] || post.createdTime || 0).getTime() / 1000;
    
    let hoursSpent = 0;
    
    if (i === 0) {
      // First post: calculate hours from start of tracking to this post
      const startDate = new Date(process.env.HACKATIME_START_DATE || '2025-08-18').getTime() / 1000;
      hoursSpent = calculateHoursFromSpans(spansData, projectNames, startDate, createdAt);
    } else {
      // Subsequent posts: calculate hours between this post and the previous post
      const previousPost = postsToProcess[i - 1];
      const previousCreatedAt = new Date(previousPost.fields?.['Created At'] || previousPost.createdTime || 0).getTime() / 1000;
      hoursSpent = calculateHoursFromSpans(spansData, projectNames, previousCreatedAt, createdAt);
    }
    
    // Update the post with calculated hours
    try {
      await updatePostHoursSpent(postId, hoursSpent);
      console.log(`    ✅ Updated post ${i + 1}/${postsToProcess.length}: ${hoursSpent.toFixed(2)} hours`);
    } catch (error) {
      console.error(`    ❌ Failed to update post ${postId}:`, error.message);
    }
  }
}

function calculateHoursFromSpans(spansData, projectNames, startTime, endTime) {
  let totalSeconds = 0;
  
  for (const projectName of projectNames) {
    const projectSpans = spansData[projectName] || [];
    
    for (const span of projectSpans) {
      const spanStart = span.start_time;
      const spanEnd = span.end_time;
      
      // Check if span overlaps with our time range
      if (spanStart < endTime && spanEnd > startTime) {
        // Calculate overlap
        const overlapStart = Math.max(spanStart, startTime);
        const overlapEnd = Math.min(spanEnd, endTime);
        const overlapDuration = overlapEnd - overlapStart;
        
        if (overlapDuration > 0) {
          totalSeconds += overlapDuration;
        }
      }
    }
  }
  
  return totalSeconds / 3600; // Convert to hours
}

async function updatePostHoursSpent(postId, hoursSpent) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${postId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        HoursSpent: hoursSpent
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to update post ${postId}: ${response.status} ${errorText}`);
  }
  
  return true;
}

// Function to update user's daysActive field
async function updateUserDaysActive(userId, newDaysActiveString) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${userId}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        daysActive: newDaysActiveString
      }
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to update user ${userId}: ${response.status} ${errorText}`);
  }
  
  return true;
}

// Test function for daysActive functionality
async function testDaysActiveFunctionality(slackId) {
  console.log(`Testing daysActive formatting for Slack ID: ${slackId}`);
  
  try {
    // Get user's email for fallback
    const userForEmail = await findUserBySlackId(slackId);
    const userEmail = userForEmail?.fields?.Email;
    
    // Fetch Hackatime data
    const hackatimeData = await fetchHackatimeData(slackId, userEmail);
    console.log(`📊 Found ${hackatimeData.projects.length} projects in Hackatime`);
    
    // Fetch spans data
    const spansData = await fetchHackatimeSpans(slackId, userEmail);
    console.log(`⏱️ Found spans for ${Object.keys(spansData).length} projects`);
    
    // Get user's games to get Shiba project names
    const userGames = await fetchGamesForUser(slackId);
    
    // Format the daysActive string (Shiba projects only)
    const daysActiveString = formatDaysActiveString(hackatimeData, spansData, userGames);
    console.log(`📅 Formatted daysActive string: "${daysActiveString}"`);
    
    // Find the user in Airtable
    const user = await findUserBySlackId(slackId);
    if (user) {
      const currentDaysActive = user.fields?.['daysActive'] || '';
      console.log(`📋 Current daysActive in Airtable: "${currentDaysActive}"`);
      
      if (daysActiveString !== currentDaysActive) {
        console.log(`🔄 daysActive would be updated (different from current value)`);
        
        // Actually update the user to test the functionality
        try {
          await updateUserDaysActive(user.id, daysActiveString);
          console.log(`✅ Successfully updated user daysActive in Airtable`);
        } catch (error) {
          console.error(`❌ Failed to update user daysActive:`, error.message);
        }
      } else {
        console.log(`✅ daysActive unchanged (same as current value)`);
      }
    } else {
      console.log(`❌ User not found in Airtable`);
    }
    
  } catch (error) {
    console.error(`❌ Error testing daysActive functionality:`, error.message);
  }
}

// Helper function to format daysActive string (Shiba projects only)
function formatDaysActiveString(hackatimeData, spansData, userGames) {
  if (!hackatimeData || !hackatimeData.projects || hackatimeData.projects.length === 0) {
    return '';
  }

  // Get all Shiba project names from user's games
  const shibaProjectNames = new Set();
  userGames.forEach(game => {
    const projects = game.fields?.['Hackatime Projects'];
    if (projects) {
      const projectNames = Array.isArray(projects) 
        ? projects.filter(Boolean)
        : (typeof projects === 'string' ? projects.split(',').map(p => p.trim()) : []);
      
      projectNames.forEach(projectName => {
        if (projectName) {
          shibaProjectNames.add(projectName.toLowerCase());
        }
      });
    }
  });

  // If no Shiba projects found, return empty string
  if (shibaProjectNames.size === 0) {
    return '';
  }

  // Group spans by date and sum hours (Shiba projects only)
  const dailyHours = {};
  
  // Process spans only from Shiba projects
  for (const project of hackatimeData.projects) {
    if (!project.name || !spansData[project.name]) continue;
    
    // Only include projects that are linked to Shiba games
    if (!shibaProjectNames.has(project.name.toLowerCase())) {
      continue;
    }
    
    const projectSpans = spansData[project.name];
    
    for (const span of projectSpans) {
      if (!span.start_time || !span.end_time) continue;
      
      // Convert Unix timestamp to date
      const startDate = new Date(span.start_time * 1000);
      const endDate = new Date(span.end_time * 1000);
      
      // Calculate duration in hours
      const durationHours = (span.end_time - span.start_time) / 3600;
      
      // Create date key in M/D/YY format
      const dateKey = `${startDate.getMonth() + 1}/${startDate.getDate()}/${startDate.getFullYear().toString().slice(-2)}`;
      
      if (!dailyHours[dateKey]) {
        dailyHours[dateKey] = 0;
      }
      dailyHours[dateKey] += durationHours;
    }
  }
  
  // Convert to sorted array and format
  const sortedDays = Object.entries(dailyHours)
    .sort(([a], [b]) => {
      const [monthA, dayA, yearA] = a.split('/').map(Number);
      const [monthB, dayB, yearB] = b.split('/').map(Number);
      const dateA = new Date(2000 + yearA, monthA - 1, dayA);
      const dateB = new Date(2000 + yearB, monthB - 1, dayB);
      return dateA - dateB;
    })
    .map(([date, hours]) => `${date}: ${hours.toFixed(1)}`)
    .join(', ');
  
  return sortedDays;
}

// Helper function to find user by Slack ID
async function findUserBySlackId(slackId) {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
  const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
  
  try {
    const params = new URLSearchParams();
    params.set('filterByFormula', `{slack id} = '${slackId}'`);
    
    const response = await fetch(`${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const records = data.records || [];
    
    if (records.length > 0) {
      return records[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by Slack ID:', error.message);
    return null;
  }
}

// Run the test
testThomasUser().catch(console.error);
