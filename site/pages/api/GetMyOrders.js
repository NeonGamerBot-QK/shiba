import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const AIRTABLE_SHOP_ITEMS_TABLE = process.env.AIRTABLE_SHOP_ITEMS_TABLE || 'Shop';
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

    // Get orders for this user
    const orders = await getOrdersForUser(user.id);
    
    console.log('Found orders:', orders);
    
    return res.status(200).json({ ok: true, orders });
  } catch (error) {
    console.error('GetMyOrders error:', error);
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

async function getOrdersForUser(userId) {
  // Try a different filter approach for linked records
  const userEscaped = safeEscapeFormulaString(userId);
  
  // Method 1: Try direct comparison with the linked record
  let filterFormula = `{Spent By} = "${userEscaped}"`;
  console.log('Trying filter formula 1:', filterFormula);
  
  let params = new URLSearchParams({
    filterByFormula: filterFormula,
  });
  
  let data = await airtableRequest(`${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  console.log('Method 1 results:', data.records?.length || 0);
  
  // If that doesn't work, try method 2
  if (!data.records || data.records.length === 0) {
    filterFormula = `FIND("${userEscaped}", ARRAYJOIN({Spent By}))`;
    console.log('Trying filter formula 2:', filterFormula);
    
    params = new URLSearchParams({
      filterByFormula: filterFormula,
    });
    
    data = await airtableRequest(`${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    console.log('Method 2 results:', data.records?.length || 0);
  }
  
  // If still no results, try method 3
  if (!data.records || data.records.length === 0) {
    // Just get all orders and filter in JavaScript
    console.log('Falling back to client-side filtering...');
    data = await airtableRequest(`${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}`, {
      method: 'GET',
    });
    
    if (data.records) {
      data.records = data.records.filter(record => {
        const spentBy = record.fields['Spent By'];
        return Array.isArray(spentBy) && spentBy.includes(userId);
      });
    }
    
    console.log('Method 3 (client-side) results:', data.records?.length || 0);
  }
  
  if (!data.records) return [];
  
  // Get shop item details for each order
  const ordersWithDetails = await Promise.all(
    data.records.map(async (order) => {
      const shopItemId = order.fields['Shop Item']?.[0];
      let shopItemName = 'Unknown Item';
      let shopItemThumbnail = '/comingSoon.png';
      
      // Check if we already have the shop item name from a lookup field
      if (order.fields['ShopItemName'] && Array.isArray(order.fields['ShopItemName'])) {
        shopItemName = order.fields['ShopItemName'][0] || 'Unknown Item';
      }
      
      // Check if we already have the shop item thumbnail from a lookup field
      if (order.fields['ShopItemThumbnail'] && Array.isArray(order.fields['ShopItemThumbnail'])) {
        // It's a lookup field that returns an array of attachment objects
        const thumbnailField = order.fields['ShopItemThumbnail'][0];
        if (thumbnailField?.url) {
          shopItemThumbnail = thumbnailField.url;
        }
      }
      
      // Check if we already have the shop item cost from a lookup field
      let shopItemCost = 0;
      if (order.fields['ShopItemCost'] && Array.isArray(order.fields['ShopItemCost'])) {
        shopItemCost = order.fields['ShopItemCost'][0] || 0;
      }
      
      console.log('Order fields:', JSON.stringify(order.fields, null, 2));
      
      return {
        id: order.id,
        orderId: order.fields.OrderID || '',
        status: order.fields.Status || 'Unfulfilled',
        shopItemName: shopItemName,
        shopItemThumbnail: shopItemThumbnail,
        amountSpent: shopItemCost || order.fields['Amount Spent'] || 0,
        createdAt: order.fields['Created At'] || order.createdTime,
      };
    })
  );
  
  return ordersWithDetails;
}
