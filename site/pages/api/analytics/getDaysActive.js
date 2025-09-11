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
    
    // Process daysActive data from all users
    const dailyHours = {};
    
    allUsers.forEach(user => {
      const daysActive = user.fields?.['daysActive'];
      
      if (daysActive && typeof daysActive === 'string' && daysActive.trim() !== '') {
        // Parse the daysActive string format: "M/D/YY: hours, M/D/YY: hours"
        const entries = daysActive.split(',').map(entry => entry.trim());
        
        entries.forEach(entry => {
          const [dateStr, hoursStr] = entry.split(':').map(s => s.trim());
          if (dateStr && hoursStr) {
            try {
              const hours = parseFloat(hoursStr);
              if (!isNaN(hours) && hours > 0) {
                // Convert M/D/YY to YYYY-MM-DD format
                const [month, day, year] = dateStr.split('/').map(n => parseInt(n));
                const fullYear = 2000 + year; // Convert YY to YYYY
                const date = new Date(fullYear, month - 1, day);
                const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
                
                if (!dailyHours[dateKey]) {
                  dailyHours[dateKey] = 0;
                }
                dailyHours[dateKey] += hours;
              }
            } catch (error) {
              console.warn(`Failed to parse daysActive entry: ${entry}`, error);
            }
          }
        });
      }
    });

    // Convert to array format and sort by date
    const daysActiveArray = Object.entries(dailyHours)
      .map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json(daysActiveArray);
  } catch (error) {
    console.error('getDaysActive error:', error);
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
