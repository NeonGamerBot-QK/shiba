const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_SITE_SETTINGS_TABLE = process.env.AIRTABLE_SITE_SETTINGS_TABLE || 'Site Settings';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const settings = await fetchSiteSettings();
    return res.status(200).json({ ok: true, settings });
  } catch (error) {
    console.error('GetSiteSettings error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

async function fetchSiteSettings() {
  const records = await airtableRequest(`${AIRTABLE_SITE_SETTINGS_TABLE}?maxRecords=100`);
  
  // Convert records to a key-value object
  const settings = {};
  records.records.forEach(record => {
    const key = record.fields.key;
    const value = record.fields.value;
    if (key && value !== undefined) {
      settings[key] = value;
    }
  });
  
  // Log the mainPageBackground setting for debugging
  if (settings.mainPageBackground) {
    console.log('Site Settings - mainPageBackground:', settings.mainPageBackground);
  }
  
  return settings;
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
