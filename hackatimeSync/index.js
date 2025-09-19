const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Global sync state
let isSyncRunning = false;
let lastSyncTime = null;
let lastSyncResult = null;
let syncError = null;
let syncCount = 0;

// Airtable configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// Smart backoff configuration
const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second base delay

// Continuous sync function
async function runContinuousSync() {
  if (isSyncRunning) {
    console.log('Sync already running, skipping...');
    return;
  }

  isSyncRunning = true;
  syncCount++;
  console.log(`\n🔄 Starting continuous sync #${syncCount} at ${new Date().toISOString()}`);

  try {
    const result = await performFullSync();
    lastSyncResult = result;
    lastSyncTime = new Date();
    syncError = null;
    console.log(`✅ Continuous sync #${syncCount} completed successfully at ${lastSyncTime.toISOString()}`);
    
    // Start the next sync immediately
    console.log('🔄 Starting next sync immediately...');
    setTimeout(() => {
      isSyncRunning = false; // Allow next sync to start
      runContinuousSync();
    }, 1000); // Small delay to prevent overwhelming
    
  } catch (error) {
    syncError = error;
    console.error(`❌ Continuous sync #${syncCount} failed:`, error.message);
    
    // Even on error, try again after a short delay
    console.log('🔄 Retrying sync after error...');
    setTimeout(() => {
      isSyncRunning = false; // Allow retry to start
      runContinuousSync();
    }, 5000); // 5 second delay on errors
  }
}

// Smart retry function with exponential backoff
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error.message.includes('429') || error.message.includes('rate limit')) {
        if (attempt === maxRetries) {
          throw error; // Give up after max retries
        }
        
        const delay = BASE_DELAY * Math.pow(2, attempt); // Exponential backoff
        console.log(`⚠️ Rate limited (attempt ${attempt + 1}/${maxRetries + 1}), backing off for ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Re-throw non-rate-limit errors immediately
    }
  }
}

// Core sync logic
async function performFullSync() {
  if (!AIRTABLE_API_KEY) {
    throw new Error('Server configuration error: Missing Airtable API key');
  }

  // Start with user daysActive sync first
  console.log('Starting user daysActive sync...');
  const userSyncResult = await syncUserDaysActive();
  
  console.log('User daysActive sync complete. Now starting games sync...');
  console.log('Fetching all games from Airtable...');
  
  // Fetch all games with pagination, only specific fields
  const allGames = await fetchAllGames();
  
  console.log(`Fetched ${allGames.length} games. Now fetching Hackatime data per user...`);
  
  // Group games by user (slack id) to minimize API calls
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
  
  // Only include users who have at least one game with non-empty Hackatime Projects
  const uniqueUsersAll = Object.keys(gamesByUser);
  const uniqueUsers = uniqueUsersAll.filter((slackId) => {
    const userGames = gamesByUser[slackId] || [];
    return userGames.some((g) => {
      const projects = g.fields?.['Hackatime Projects'];
      if (Array.isArray(projects)) return projects.filter(Boolean).length > 0;
      if (typeof projects === 'string') return projects.trim().length > 0;
      return false;
    });
  });
  console.log(`Found ${uniqueUsersAll.length} unique users; ${uniqueUsers.length} with Hackatime Projects`);
  
  // Fetch Hackatime data for each unique user with smart retry
  const userHackatimeData = {};
  const userSpansData = {};
  for (let i = 0; i < uniqueUsers.length; i++) {
    const slackId = uniqueUsers[i];
    console.log(`Fetching Hackatime data for user ${i + 1}/${uniqueUsers.length}: ${slackId}`);
    
    try {
      // Use retry with backoff for Hackatime API calls
      userHackatimeData[slackId] = await retryWithBackoff(async () => {
        return await fetchHackatimeData(slackId);
      });
      
      // Fetch spans data for this user
      userSpansData[slackId] = await retryWithBackoff(async () => {
        return await fetchHackatimeSpans(slackId);
      });
      
      // Small delay to be respectful to Hackatime API
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`❌ Failed to fetch Hackatime data for ${slackId} after retries:`, error.message);
      // Don't default to 0 - skip this user entirely if we can't get data
      continue;
    }
  }
  
  console.log('Hackatime data fetched. Now updating games...');
  
  // Track claimed projects per user to prevent double counting
  const userClaimedProjects = {};
  uniqueUsers.forEach(slackId => {
    userClaimedProjects[slackId] = new Set();
  });
  
  // Update each game with calculated seconds
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  
  for (let i = 0; i < allGames.length; i++) {
    const game = allGames[i];
    const fields = game.fields || {};
    const slackId = fields['slack id'];
    
    console.log(`Processing game ${i + 1}/${allGames.length}: ${fields.Name}`);
    
    // Skip update if no slack id or hackatime projects
    if (!slackId || !fields['Hackatime Projects']) {
      console.log(`Skipping ${fields.Name} - missing slack id or hackatime projects`);
      skippedCount++;
      continue;
    }
    
    // Skip if we don't have Hackatime data for this user (due to rate limiting)
    if (!userHackatimeData[slackId]) {
      console.log(`Skipping ${fields.Name} - no Hackatime data available for user ${slackId} (likely rate limited)`);
      skippedCount++;
      continue;
    }
    
    try {
      // Get the user's Hackatime data (already fetched)
      const hackatimeData = userHackatimeData[slackId];
      
      // Calculate total seconds for this specific game's projects (with claiming)
      const totalSeconds = calculateProjectSecondsWithClaiming(
        hackatimeData, 
        fields['Hackatime Projects'], 
        userClaimedProjects[slackId]
      );
      
      // Update the game in Airtable with retry
      const updateSuccess = await retryWithBackoff(async () => {
        return await updateGameHackatimeSeconds(game.id, totalSeconds);
      });
      
      if (updateSuccess) {
        successCount++;
        console.log(`✅ Updated ${fields.Name}: ${totalSeconds} seconds`);
      } else {
        errorCount++;
        console.error(`❌ Failed to update ${fields.Name} in Airtable`);
      }
      
      // Process posts for this game if we have spans data
      if (userSpansData[slackId]) {
        try {
          await processGamePosts(game, userSpansData[slackId], fields['Hackatime Projects']);
        } catch (error) {
          console.error(`❌ Error processing posts for ${fields.Name}:`, error.message);
        }
      }
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error updating ${fields.Name}:`, error.message);
    }
  }
  
  console.log(`Games sync complete! ${successCount} successful, ${errorCount} errors, ${skippedCount} skipped`);
  
  return {
    success: true,
    totalGames: allGames.length,
    uniqueUsers: uniqueUsers.length,
    successfulUpdates: successCount,
    errors: errorCount,
    skipped: skippedCount,
    userSync: userSyncResult,
    timestamp: new Date().toISOString()
  };
}

// Airtable helper functions
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

async function fetchAllGames() {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    
    console.log(`Fetching games page... (offset: ${offset || 'none'})`);
    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    const pageRecords = page?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
    
    console.log(`Fetched ${pageRecords.length} games, total so far: ${allRecords.length}`);
  } while (offset);
  
  return allRecords;
}

async function fetchAllUsers() {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);
    
    console.log(`Fetching users page... (offset: ${offset || 'none'})`);
    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    const pageRecords = page?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
    
    console.log(`Fetched ${pageRecords.length} users, total so far: ${allRecords.length}`);
  } while (offset);
  
  return allRecords;
}


// Hackatime API integration with better error handling
async function fetchHackatimeData(slackId) {
  if (!slackId) throw new Error('Missing slackId');
  
  const start_date = process.env.HACKATIME_START_DATE || '2025-08-18';
  const end_date = process.env.HACKATIME_END_DATE || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Add 1 day
    return d.toISOString().slice(0, 10);
  })();
  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects&start_date=${start_date}&end_date=${end_date}`;
  
  console.log(`Fetching Hackatime data for ${slackId}...`);
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

// Helper function to calculate project seconds with claiming to prevent double counting across games
function calculateProjectSecondsWithClaiming(hackatimeData, gameProjectsField, claimedProjects) {
  let totalSeconds = 0;
  
  if (!gameProjectsField || !hackatimeData.projects.length) {
    return totalSeconds;
  }
  
  // Parse the game's Hackatime Projects field (comma-separated like "qes-ttmi-rng, wkydo")
  const projectNames = Array.isArray(gameProjectsField) 
    ? gameProjectsField.filter(Boolean)
    : (typeof gameProjectsField === 'string' ? gameProjectsField.split(',').map(p => p.trim()) : []);
  
  console.log(`  └─ Game projects: [${projectNames.join(', ')}]`);
  
  for (const projectName of projectNames) {
    if (!projectName) continue;
    
    const projectNameLower = projectName.toLowerCase();
    
    // Check if this project has already been claimed by another game for this user
    if (claimedProjects.has(projectNameLower)) {
      console.log(`  ├─ Project "${projectName}": ALREADY CLAIMED (0s)`);
      continue;
    }
    
    // Find matching project in Hackatime data
    const matchingProject = hackatimeData.projects.find(p => 
      p.name && p.name.toLowerCase() === projectNameLower
    );
    
    if (matchingProject) {
      totalSeconds += matchingProject.total_seconds || 0;
      claimedProjects.add(projectNameLower); // Claim this project
      console.log(`  ├─ Project "${projectName}": ${matchingProject.total_seconds}s (CLAIMED)`);
    } else {
      console.log(`  ├─ Project "${projectName}": NOT FOUND in Hackatime data`);
    }
  }
  
  return totalSeconds;
}

async function updateGameHackatimeSeconds(gameId, seconds) {
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

// New function to fetch spans from Hackatime API
async function fetchHackatimeSpans(slackId) {
  if (!slackId) throw new Error('Missing slackId');
  
  const start_date = process.env.HACKATIME_START_DATE || '2025-08-18';
  
  // Get all projects for this user first
  const hackatimeData = await fetchHackatimeData(slackId);
  const projects = hackatimeData.projects || [];
  
  const allSpans = {};
  
  // Fetch spans for each project
  for (const project of projects) {
    if (!project.name) continue;
    
    const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/heartbeats/spans?start_date=${start_date}&project=${encodeURIComponent(project.name)}`;
    
    console.log(`Fetching spans for project "${project.name}"...`);
    const headers = { Accept: 'application/json' };
    if (process.env.RACK_ATTACK_BYPASS) {
      headers['Rack-Attack-Bypass'] = process.env.RACK_ATTACK_BYPASS;
    }
    
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        console.log(`Rate limited for project "${project.name}", skipping...`);
        continue;
      }
      
      if (!response.ok) {
        console.log(`Failed to fetch spans for project "${project.name}": ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const spans = Array.isArray(data?.spans) ? data.spans : [];
      allSpans[project.name] = spans;
      
      // Small delay between project requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`Error fetching spans for project "${project.name}":`, error.message);
    }
  }
  
  return allSpans;
}

// New function to fetch posts for a game
async function fetchPostsForGame(gameId) {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    params.set('sort[0][field]', 'Created At');
    params.set('sort[0][direction]', 'asc');
    if (offset) params.set('offset', offset);
    
    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    const pageRecords = page?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
    
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

// New function to process posts and calculate hours spent
async function processGamePosts(game, spansData, gameProjects) {
  const gameId = game.id;
  const gameName = game.fields?.Name || 'Unknown Game';
  
  console.log(`Processing posts for game: ${gameName}`);
  
  // Get project names for this game
  const projectNames = Array.isArray(gameProjects) 
    ? gameProjects.filter(Boolean)
    : (typeof gameProjects === 'string' ? gameProjects.split(',').map(p => p.trim()) : []);
  
  if (projectNames.length === 0) {
    console.log(`No projects found for game ${gameName}, skipping post processing`);
    return;
  }
  
  // Fetch all posts for this game
  const posts = await fetchPostsForGame(gameId);
  console.log(`Found ${posts.length} posts for game ${gameName}`);
  
  if (posts.length === 0) {
    return;
  }
  
  // Filter out posts that already have TimeSpentOnAsset field populated
  const postsToProcess = posts.filter(post => {
    const timeSpentOnAsset = post.fields?.['TimeSpentOnAsset'];
    if (timeSpentOnAsset !== null && timeSpentOnAsset !== undefined && timeSpentOnAsset !== '') {
      console.log(`Skipping post ${post.id} - TimeSpentOnAsset already populated: ${timeSpentOnAsset}`);
      return false;
    }
    return true;
  });
  
  console.log(`Processing ${postsToProcess.length} posts (${posts.length - postsToProcess.length} skipped due to existing TimeSpentOnAsset)`);
  
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
      console.log(`Updated post ${i + 1}/${postsToProcess.length}: ${hoursSpent.toFixed(2)} hours`);
    } catch (error) {
      console.error(`Failed to update post ${postId}:`, error.message);
    }
  }
}

// Helper function to calculate hours from spans data
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

// Function to format Hackatime data into daysActive string format (Shiba projects only)
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

// Function to update user's daysActive field only if it would change
async function updateUserDaysActive(userId, newDaysActiveString) {
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

// New function to update post hours spent
async function updatePostHoursSpent(postId, hoursSpent) {
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

// Function to sync user daysActive data
async function syncUserDaysActive() {
  console.log('Fetching all users and games from Airtable...');
  
  // Fetch all users and games in parallel
  const [allUsers, allGames] = await Promise.all([
    fetchAllUsers(),
    fetchAllGames()
  ]);
  
  console.log(`Fetched ${allUsers.length} users and ${allGames.length} games. Processing daysActive data...`);
  
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
  
  let userSuccessCount = 0;
  let userErrorCount = 0;
  let userSkippedCount = 0;
  
  for (let i = 0; i < allUsers.length; i++) {
    const user = allUsers[i];
    const fields = user.fields || {};
    const slackId = fields['slack id'];
    const currentDaysActive = fields['daysActive'] || '';
    
    console.log(`Processing user ${i + 1}/${allUsers.length}: ${fields.Name || 'Unknown'} (${slackId})`);
    
    // Skip if no slack id
    if (!slackId) {
      console.log(`Skipping user - missing slack id`);
      userSkippedCount++;
      continue;
    }
    
    try {
      // Get user's games from the pre-fetched data
      const userGames = gamesByUser[slackId] || [];
      
      // Fetch Hackatime data for this user
      const hackatimeData = await retryWithBackoff(async () => {
        return await fetchHackatimeData(slackId);
      });
      
      // Fetch spans data for this user
      const spansData = await retryWithBackoff(async () => {
        return await fetchHackatimeSpans(slackId);
      });
      
      // Format the daysActive string (Shiba projects only)
      const newDaysActiveString = formatDaysActiveString(hackatimeData, spansData, userGames);
      
      // Only update if the string would change
      if (newDaysActiveString !== currentDaysActive) {
        console.log(`Updating daysActive for ${fields.Name}: "${newDaysActiveString}"`);
        
        const updateSuccess = await retryWithBackoff(async () => {
          return await updateUserDaysActive(user.id, newDaysActiveString);
        });
        
        if (updateSuccess) {
          userSuccessCount++;
          console.log(`✅ Updated ${fields.Name} daysActive`);
        } else {
          userErrorCount++;
          console.error(`❌ Failed to update ${fields.Name} daysActive`);
        }
      } else {
        console.log(`Skipping ${fields.Name} - daysActive unchanged`);
        userSkippedCount++;
      }
      
      // Small delay to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      userErrorCount++;
      console.error(`❌ Error processing user ${fields.Name}:`, error.message);
    }
  }
  
  console.log(`User daysActive sync complete! ${userSuccessCount} successful, ${userErrorCount} errors, ${userSkippedCount} skipped`);
  
  return {
    totalUsers: allUsers.length,
    successfulUpdates: userSuccessCount,
    errors: userErrorCount,
    skipped: userSkippedCount
  };
}

// Minimal middleware - only what's needed
app.use(express.json({ limit: '1mb' }));

// Essential routes only
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Manual sync trigger (for debugging/monitoring)
app.get('/api/sync-status', (req, res) => {
  res.json({
    isRunning: isSyncRunning,
    lastSyncTime: lastSyncTime?.toISOString(),
    lastError: syncError?.message,
    syncCount: syncCount,
    timestamp: new Date().toISOString()
  });
});

// Manual sync trigger
app.post('/api/sync', async (req, res) => {
  if (isSyncRunning) {
    return res.status(409).json({ 
      message: 'Sync already running',
      lastSyncTime: lastSyncTime?.toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  try {
    console.log('Manual sync triggered via API...');
    const result = await performFullSync();
    res.json(result);
  } catch (error) {
    console.error('Manual sync error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to sync games',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start continuous sync
console.log('🚀 Starting continuous sync loop...');
setTimeout(() => {
  console.log('🔄 Starting first sync in 10 seconds...');
  runContinuousSync();
}, 10000);

app.listen(PORT, () => {
  console.log(`HackatimeSync server is running on port ${PORT}`);
});

module.exports = app;
