const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_SHOP_TABLE = process.env.AIRTABLE_SHOP_TABLE || 'Shop';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const shopItems = await fetchAllShopItems();
    
    return res.status(200).json(shopItems);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('GetShopItems error:', error);
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

async function fetchAllShopItems() {
  let allRecords = [];
  let offset;
  
  do {
    const params = new URLSearchParams();
    params.set('pageSize', '100');
    if (offset) params.set('offset', offset);

    const page = await airtableRequest(`${encodeURIComponent(AIRTABLE_SHOP_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    const pageRecords = page?.records || [];
    allRecords = allRecords.concat(pageRecords);
    offset = page?.offset;
  } while (offset);

  return allRecords.map((record) => ({
    id: record.id,
    Name: record.fields?.Name || record.fields?.item || '',
    Cost: record.fields?.Cost || record.fields?.cost || 0,
    Description: record.fields?.Description || '',
    SoldItems: record.fields?.SoldItems || 0,
    InitialStock: record.fields?.InitialStock || record.fields?.stockAvailable || 0,
    InStock: record.fields?.['In Stock'] || record.fields?.stockAvailable || 0,
    Images: record.fields?.Images || [],
  }));
}
