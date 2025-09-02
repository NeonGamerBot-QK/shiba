import crypto from 'crypto';
import { safeEscapeFormulaString, isValidEmail } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_OTP_TABLE = process.env.AIRTABLE_OTP_TABLE || 'OTP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ message: 'Missing required fields: email, otp' });
  }

  const normalizedEmail = normalizeEmail(email);
  
  // Rate limiting by email address for OTP attempts
  const rateLimitKey = `otp:${normalizedEmail}`;
  if (!checkRateLimit(rateLimitKey, 10, 300000)) { // 10 attempts per 5 minutes
    return res.status(429).json({ message: 'Too many OTP attempts. Please try again later.' });
  }

  try {
    // Simplified OTP lookup - just get the most recent one for this email
    const recentOtp = await getMostRecentOtpForEmail(normalizedEmail);
    if (!recentOtp) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const recentCode = String(recentOtp.fields?.OTP || '');
    if (recentCode !== String(otp)) {
      return res.status(400).json({ message: 'Invalid code.' });
    }

    // Check if OTP is expired (simplified check)
    if (recentOtp.createdTime) {
      const createdMs = new Date(recentOtp.createdTime).getTime();
      const ageMs = Date.now() - createdMs;
      if (ageMs > 5 * 60 * 1000) { // 5 minutes
        return res.status(400).json({ message: 'Code expired.' });
      }
    }

    // Fetch user and return current token
    const userRecord = await findUserByEmail(normalizedEmail);
    if (!userRecord) {
      return res.status(400).json({ message: 'User not found.' });
    }
    
    const token = String(userRecord.fields?.token || '');
    if (!token) {
      return res.status(400).json({ message: 'No active token for user.' });
    }

    return res.status(200).json({ token });
  } catch (error) {
    console.error('tryOTP error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

function normalizeEmail(input) {
  const normalized = String(input).toLowerCase().replace(/\s+/g, '');
  return isValidEmail(normalized) ? normalized : '';
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

async function findUserByEmail(email) {
  // SECURITY FIX: Escape the email to prevent formula injection
  const emailEscaped = safeEscapeFormulaString(email);
  const formula = `{Email} = "${emailEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}

async function getMostRecentOtpForEmail(email) {
  // SECURITY FIX: Escape the email to prevent formula injection
  const emailEscaped = safeEscapeFormulaString(email);
  const params = new URLSearchParams();
  // Simplified filter - just get the most recent OTP for this email
  params.set('filterByFormula', `{Email} = "${emailEscaped}"`);
  params.set('pageSize', '1');
  params.set('sort[0][field]', 'Created At');
  params.set('sort[0][direction]', 'desc');

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_OTP_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
}
