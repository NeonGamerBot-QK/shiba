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
    const signedUp = allUsers.length;
    
    // Count users who have onboarded
    const onboarded = allUsers.filter(user => user.fields?.hasOnboarded === true).length;
    
    // Count users who have Hackatime Projects (they have hackatime)
    const connectedHackatime = allUsers.filter(user => {
      const hackatimeProjects = user.fields?.['Hackatime Projects'];
      return hackatimeProjects && hackatimeProjects.length > 0;
    }).length;

    // Count users who have connected Slack (non-empty slack id)
    const slack = allUsers.filter(user => {
      const slackId = user.fields?.['slack id'];
      return typeof slackId === 'string' && slackId.trim() !== '';
    }).length;

    // Count users by hour milestones
    const logged10Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 10;
    }).length;

    const logged20Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 20;
    }).length;

    const logged30Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 30;
    }).length;

    const logged40Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 40;
    }).length;

    const logged50Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 50;
    }).length;

    const logged60Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 60;
    }).length;

    const logged70Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 70;
    }).length;

    const logged80Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 80;
    }).length;

    const logged90Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 90;
    }).length;

    const logged100Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 100;
    }).length;

    // All metrics now have real data from the database
    const funnelData = {
      signedUp,
      onboarded,
      slack,
      connectedHackatime,
      logged10Hours,
      logged20Hours,
      logged30Hours,
      logged40Hours,
      logged50Hours,
      logged60Hours,
      logged70Hours,
      logged80Hours,
      logged90Hours,
      logged100Hours
    };

    res.status(200).json(funnelData);
  } catch (error) {
    console.error('getFunnelData error:', error);
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
