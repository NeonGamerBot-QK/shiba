import crypto from 'crypto';
import { safeEscapeFormulaString } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = 'Users';
const AIRTABLE_OTP_TABLE = 'OTP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const LOOPS_TRANSACTIONAL_KEY = process.env.LOOPS_TRANSACTIONAL_KEY;
const LOOPS_TRANSACTIONAL_TEMPLATE_ID = process.env.LOOPS_TRANSACTIONAL_TEMPLATE_ID;
const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] newLogin: Starting request`);
  
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email } = req.body || {};
  if (!email) {
    return res.status(400).json({ message: 'Missing required field: email' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const normalizedEmail = normalizeEmail(email);
  console.log(`[${new Date().toISOString()}] newLogin: Processing ${normalizedEmail}`);

  // Rate limiting check
  const rateLimitKey = `login:${normalizedEmail}`;
  if (!checkRateLimit(rateLimitKey, 5, 60000)) {
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  try {
    // Generate OTP and token immediately
    const otp = generateSixDigitCode();
    const token = generateAlphanumericToken(120);
    
    // Find or create user first
    console.log(`[${new Date().toISOString()}] newLogin: Finding/creating user`);
    const userRecord = await findOrCreateUser(normalizedEmail);
    
    // Use parallel operations for write operations
    console.log(`[${new Date().toISOString()}] newLogin: Starting parallel write operations`);
    
    // Do OTP creation and token update in parallel
    const [otpCreated, tokenUpdated] = await Promise.all([
      createOtpRecord(normalizedEmail, otp, token),
      updateUserToken(userRecord.id, token)
    ]);
    
    console.log(`[${new Date().toISOString()}] newLogin: Write operations completed`);
    
    // Send email (non-blocking)
    sendOtpEmailViaLoops(normalizedEmail, otp, token).catch(err => {
      console.error('Email send failed:', err);
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] newLogin: Completed in ${totalTime}ms`);
    
    return res.status(200).json({ message: 'OTP generated and sent.' });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] newLogin: Failed after ${totalTime}ms:`, error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateAlphanumericToken(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

function normalizeEmail(input) {
  return String(input).toLowerCase().replace(/\s+/g, '');
}

async function findOrCreateUser(email) {
  // Try to find existing user first
  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) return existingUser;
  } catch (error) {
    console.log('User lookup failed, will create new user');
  }
  
  // Create new user if not found
  return createUser(email);
}

async function findUserByEmail(email) {
  const emailEscaped = safeEscapeFormulaString(email);
  const formula = `{Email} = "${emailEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${AIRTABLE_USERS_TABLE}?${params.toString()}`);
  return data.records?.[0] || null;
}

async function createUser(email) {
  const payload = {
    records: [{ fields: { Email: email } }]
  };
  
  const data = await airtableRequest(AIRTABLE_USERS_TABLE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  
  return data.records[0];
}

async function createOtpRecord(email, otp, token) {
  const payload = {
    records: [{
      fields: {
        Email: email,
        OTP: otp,
        'Token-generated': token,
      }
    }]
  };
  
  return airtableRequest(AIRTABLE_OTP_TABLE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateUserToken(userId, token) {
  const payload = { fields: { token } };
  return airtableRequest(`${AIRTABLE_USERS_TABLE}/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
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

async function airtableBatchRequest(operations) {
  // Airtable batch endpoint for multiple operations
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}`;
  
  const payload = {
    requests: operations.map(op => ({
      method: op.method,
      path: op.path,
      body: op.body
    }))
  };
  
  console.log(`[${new Date().toISOString()}] airtableBatchRequest: URL: ${url}`);
  console.log(`[${new Date().toISOString()}] airtableBatchRequest: Payload:`, JSON.stringify(payload, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`[${new Date().toISOString()}] airtableBatchRequest: Failed with status ${response.status}: ${text}`);
    throw new Error(`Airtable batch error ${response.status}: ${text}`);
  }
  
  const result = await response.json();
  console.log(`[${new Date().toISOString()}] airtableBatchRequest: Success:`, JSON.stringify(result, null, 2));
  return result;
}

async function sendOtpEmailViaLoops(email, otp, token) {
  if (!LOOPS_TRANSACTIONAL_KEY || !LOOPS_TRANSACTIONAL_TEMPLATE_ID) {
    throw new Error('Loops email configuration missing');
  }

  const magicLink = `https://shiba.hackclub.com/?token=${token}`;
  const url = `${LOOPS_API_BASE}/transactional`;
  const payload = {
    transactionalId: LOOPS_TRANSACTIONAL_TEMPLATE_ID,
    email,
    dataVariables: { otp, OTP: otp, code: otp, magicLink },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOOPS_TRANSACTIONAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Loops send failed: ${res.status}`);
    }

    const data = await res.json();
    if (data && data.success === false) {
      throw new Error(`Loops send failed: ${data?.error || 'unknown error'}`);
    }

    return true;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}


