import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const AIRTABLE_SHOP_ITEMS_TABLE = process.env.AIRTABLE_SHOP_ITEMS_TABLE || 'Shop';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  console.log('Purchase endpoint called');
  console.log('Request method:', req.method);
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    console.error('Missing AIRTABLE_API_KEY');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { 
    token, 
    shopItemId, 
    shippingInfo
  } = req.body || {};

  console.log('Extracted data:');
  console.log('- token:', token ? 'present' : 'missing');
  console.log('- shopItemId:', shopItemId);
  console.log('- shippingInfo:', shippingInfo ? 'present' : 'missing');

  if (!token || !shopItemId || !shippingInfo) {
    const missingFields = [];
    if (!token) missingFields.push('token');
    if (!shopItemId) missingFields.push('shopItemId');
    if (!shippingInfo) missingFields.push('shippingInfo');
    
    console.error('Missing required fields:', missingFields);
    return res.status(400).json({ 
      message: 'Missing required fields: ' + missingFields.join(', '),
      missingFields 
    });
  }

  try {
    console.log('Starting purchase process...');
    
    // Find user by token
    console.log('Looking up user by token...');
    const user = await findUserByToken(token);
    console.log('User lookup result:', user ? 'found' : 'not found');
    
    if (!user) {
      console.error('User not found for token');
      return res.status(401).json({ message: 'Invalid token' });
    }

    console.log('User found:', { id: user.id, email: user.fields?.email });

    // Check if shop item exists and get its price
    console.log('Checking shop item...');
    const shopItem = await getShopItemById(shopItemId);
    if (!shopItem) {
      console.error('Shop item not found:', shopItemId);
      return res.status(400).json({ message: 'Shop item not found' });
    }

    const itemPrice = parseFloat(shopItem.fields?.Cost || 0);
    const inStock = shopItem.fields?.['In Stock'] || 0;
    
    console.log('Shop item details:');
    console.log('- Item:', shopItem.fields?.Name || 'Unknown');
    console.log('- Cost:', itemPrice);
    console.log('- In Stock:', inStock);

    if (inStock <= 0) {
      console.error('Item out of stock');
      return res.status(400).json({ 
        message: 'Item is out of stock',
        itemName: shopItem.fields?.Name || 'Unknown item',
        inStock: inStock
      });
    }

    console.log('Stock check passed');

    // Check if user has enough SSS balance
    const userSSSBalance = user.fields?.['SSS Balance'] || 0;
    
    console.log('SSS Balance check:');
    console.log('- User SSS Balance:', userSSSBalance);
    console.log('- Purchase Amount:', itemPrice);
    
    if (userSSSBalance < itemPrice) {
      console.error('Insufficient SSS balance for purchase');
      return res.status(400).json({ 
        message: 'Insufficient SSS balance',
        userBalance: userSSSBalance,
        requiredAmount: itemPrice,
        shortfall: itemPrice - userSSSBalance
      });
    }
    
    console.log('SSS balance check passed');

    // Generate 9-digit OrderID
    const orderId = generateOrderId();
    console.log('Generated OrderID:', orderId);

    // Create order record
    const orderData = {
      fields: {
        'OrderID': orderId,
        'Status': 'Unfulfilled', // Default status
        'Spent By': [user.id], // Linked record to Users table
        'Shop Item': [shopItemId], // Linked record to Shop Items table
        'Amount Spent': itemPrice, // Amount spent from shop item cost
        'street address': shippingInfo.street1 || '',
        'street address #2': shippingInfo.street2 || '',
        'city': shippingInfo.city || '',
        'state': shippingInfo.state || '',
        'zip code': shippingInfo.zipcode || '',
        'country': shippingInfo.country || '',
        'first name': shippingInfo.firstName || '',
        'last name': shippingInfo.lastName || '',
        'phone number': shippingInfo.phone || '',
      }
    };

    console.log('Order data to create:', JSON.stringify(orderData, null, 2));

    console.log('Making Airtable request to create order...');
    const response = await airtableRequest(`${encodeURIComponent(AIRTABLE_ORDERS_TABLE)}`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    console.log('Airtable response:', JSON.stringify(response, null, 2));

    if (response.id) {
      console.log('Order created successfully');
      return res.status(200).json({ 
        ok: true, 
        order: response,
        orderId: orderId
      });
    } else {
      console.error('Failed to create order - no record returned');
      return res.status(500).json({ message: 'Failed to create order' });
    }

  } catch (error) {
    console.error('Purchase error:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  console.log('Airtable request URL:', url);
  console.log('Airtable request options:', JSON.stringify(options, null, 2));
  
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  
  console.log('Airtable response status:', response.status);
  console.log('Airtable response headers:', Object.fromEntries(response.headers.entries()));
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('Airtable error response:', text);
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  
  const data = await response.json();
  console.log('Airtable response data:', JSON.stringify(data, null, 2));
  return data;
}

async function findUserByToken(token) {
  console.log('findUserByToken called with token:', token ? 'present' : 'missing');
  
  const tokenEscaped = safeEscapeFormulaString(token);
  console.log('Escaped token:', tokenEscaped);
  
  const params = new URLSearchParams({
    filterByFormula: `{token} = "${tokenEscaped}"`,
    pageSize: '1',
  });
  
  console.log('User lookup URL params:', params.toString());
  
  const data = await airtableRequest(`Users?${params.toString()}`, {
    method: 'GET',
  });
  
  console.log('User lookup response:', JSON.stringify(data, null, 2));
  
  return (data.records && data.records[0]) || null;
}

async function getShopItemById(shopItemId) {
  console.log('getShopItemById called with:', shopItemId);
  
  try {
    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_SHOP_ITEMS_TABLE)}/${encodeURIComponent(shopItemId)}`, {
      method: 'GET',
    });
    
    console.log('Shop item lookup response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching shop item:', error);
    return null;
  }
}

function generateOrderId() {
  // Generate a random 9-digit number
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}
