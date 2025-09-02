const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    // Get all posts from the Posts table
    const allPosts = await fetchAllAirtableRecords(AIRTABLE_POSTS_TABLE);
    
    // Filter posts from May 18th 2025 onwards
    const startDate = new Date('2025-05-18T00:00:00Z');
    const filteredPosts = allPosts.filter(post => {
      const createdAt = post.fields?.['Created At'];
      if (!createdAt) return false;
      
      const postDate = new Date(createdAt);
      return postDate >= startDate;
    });

    // Aggregate hours spent per day
    const hoursPerDay = {};
    
    filteredPosts.forEach(post => {
      const createdAt = post.fields?.['Created At'];
      const hoursSpent = post.fields?.['HoursSpent'];
      
      if (createdAt && typeof hoursSpent === 'number' && hoursSpent > 0) {
        const date = new Date(createdAt);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!hoursPerDay[dateKey]) {
          hoursPerDay[dateKey] = 0;
        }
        hoursPerDay[dateKey] += hoursSpent;
      }
    });

    // Convert to array format and sort by date
    const hoursPerDayArray = Object.entries(hoursPerDay)
      .map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(hoursPerDayArray);
  } catch (error) {
    console.error('getHoursPerDay error:', error);
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
