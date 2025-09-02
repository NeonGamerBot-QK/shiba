import crypto from 'crypto';
import { safeEscapeFormulaString } from './utils/security.js';
import { checkRateLimit } from './utils/rateLimit.js';
import { generateReferralCode, initializeUsedCodes } from './utils/referralCode.js';

// Simplified login endpoint - handles user login with OTP generation
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = 'Users';
const AIRTABLE_OTP_TABLE = 'OTP';
const AIRTABLE_REFERRALS_TABLE = 'Referrals';
const AIRTABLE_EMAIL_LOG_TABLE = 'EmailLog';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const LOOPS_TRANSACTIONAL_KEY = process.env.LOOPS_TRANSACTIONAL_KEY;
const LOOPS_TRANSACTIONAL_TEMPLATE_ID = process.env.LOOPS_TRANSACTIONAL_TEMPLATE_ID;
const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { email, sentby } = req.body || {};

  if (!email) {
    return res.status(400).json({ message: 'Missing required field: email' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const normalizedEmail = normalizeEmail(email);
  
  // Log email first to prevent data loss
  try {
    await logEmail(normalizedEmail);
  } catch (error) {
    console.error('Failed to log email:', error);
    // Continue with login process even if logging fails
  }

  // Initialize referral codes (only once per request)
  try {
    const existingCodes = await getAllExistingReferralCodes();
    initializeUsedCodes(existingCodes);
  } catch (error) {
    console.error('Failed to initialize referral codes:', error);
  }

  // Rate limiting by email address
  const rateLimitKey = `login:${normalizedEmail}`;
  if (!checkRateLimit(rateLimitKey, 5, 60000)) { // 5 requests per minute
    return res.status(429).json({ message: 'Too many login attempts. Please try again later.' });
  }

  try {
    // Simple user lookup - no fallbacks
    let userRecord = await findUserByEmail(normalizedEmail);
    
    if (!userRecord) {
      // Create new user with referral code
      userRecord = await createUser(normalizedEmail);
      
      // Handle referral tracking for new users
      if (sentby && sentby.trim() !== '') {
        try {
          await createReferralRecord(userRecord.id, sentby.trim(), normalizedEmail);
        } catch (referralError) {
          console.error('Failed to create referral record:', referralError);
        }
      }
    } else {
      // Ensure existing user has a referral code
      if (!userRecord.fields?.ReferralCode || userRecord.fields.ReferralCode.trim() === '') {
        try {
          const newReferralCode = generateReferralCode();
          await updateUserReferralCode(userRecord.id, newReferralCode);
          userRecord.fields = userRecord.fields || {};
          userRecord.fields.ReferralCode = newReferralCode;
        } catch (referralCodeError) {
          console.error('Failed to generate referral code for existing user:', referralCodeError);
        }
      }
    }

    // Simple OTP cooldown check
    const hasRecentOtp = await hasRecentOtpForEmail(normalizedEmail, 10);
    if (hasRecentOtp) {
      return res.status(429).json({ message: 'Please wait 10 seconds before requesting a new code.' });
    }

    // Generate credentials
    const tokenLength = 120;
    const otp = generateSixDigitCode();
    const token = generateAlphanumericToken(tokenLength);

    // Create OTP record and update user token
    await Promise.all([
      createOtpRecord({ email: normalizedEmail, otp, token }),
      updateUserToken(userRecord.id, token)
    ]);

    // Send email
    try {
      await sendOtpEmailViaLoops(normalizedEmail, otp);
    } catch (err) {
      console.error('sendOtpEmailViaLoops error:', err);
    }

    return res.status(200).json({ message: 'OTP generated and sent.' });
  } catch (error) {
    console.error('newLogin error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSixDigitCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function generateAlphanumericToken(length) {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const idx = crypto.randomInt(0, ALPHANUMERIC.length);
    result += ALPHANUMERIC[idx];
  }
  return result;
}

function normalizeEmail(input) {
  return String(input).toLowerCase().replace(/\s+/g, '');
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
  const emailEscaped = safeEscapeFormulaString(email);
  const formula = `{Email} = "${emailEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  return data.records && data.records[0] || null;
}

async function createUser(email) {
  const referralCode = generateReferralCode();
  
  const payload = {
    records: [
      {
        fields: {
          Email: email,
          ReferralCode: referralCode,
        },
      },
    ],
  };
  
  try {
    const data = await airtableRequest(encodeURIComponent(AIRTABLE_USERS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.records[0];
  } catch (error) {
    if (error.message.includes('duplicate') || 
        error.message.includes('already exists') ||
        error.message.includes('422') ||
        error.message.includes('UNIQUE')) {
      throw new Error('User already exists');
    }
    throw error;
  }
}

async function updateUserToken(userId, token) {
  const payload = { fields: { token } };
  await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function hasRecentOtpForEmail(email, secondsWindow) {
  const record = await getMostRecentOtpRecordForEmail(email);
  if (!record) return false;
  const createdMs = new Date(record.createdTime).getTime();
  if (!Number.isFinite(createdMs)) return false;
  const ageMs = Date.now() - createdMs;
  return ageMs <= secondsWindow * 1000;
}

async function getMostRecentOtpRecordForEmail(email) {
  const emailEscaped = safeEscapeFormulaString(email);
  const params = new URLSearchParams();
  params.set('filterByFormula', `{Email} = "${emailEscaped}"`);
  params.set('pageSize', '1');
  params.set('sort[0][field]', 'Created At');
  params.set('sort[0][direction]', 'desc');
  
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_OTP_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  return data.records && data.records[0] || null;
}

async function createOtpRecord({ email, otp, token }) {
  const payload = {
    records: [
      {
        fields: {
          Email: email,
          OTP: otp,
          'Token-generated': token,
        },
      },
    ],
  };
  await airtableRequest(encodeURIComponent(AIRTABLE_OTP_TABLE), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function sendOtpEmailViaLoops(email, otp) {
  if (!LOOPS_TRANSACTIONAL_KEY || !LOOPS_TRANSACTIONAL_TEMPLATE_ID) {
    console.error('Loops email configuration missing');
    return;
  }

  const url = `${LOOPS_API_BASE}/transactional`;
  const payload = {
    transactionalId: LOOPS_TRANSACTIONAL_TEMPLATE_ID,
    email,
    dataVariables: { otp, OTP: otp, code: otp },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

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

    console.log('OTP email sent successfully via Loops');

  } catch (error) {
    console.error('sendOtpEmailViaLoops failed:', error.message);
    throw error;
  }
}

async function getAllExistingReferralCodes() {
  const allCodes = [];
  let offset = null;
  
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) {
      params.set('offset', offset);
    }

    const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
      method: 'GET',
    });
    
    if (data.records) {
      const codes = data.records
        .map(record => record.fields?.ReferralCode)
        .filter(code => code && code.trim() !== '');
      allCodes.push(...codes);
    }
    
    offset = data.offset;
  } while (offset);
  
  return allCodes;
}

async function updateUserReferralCode(userId, referralCode) {
  const payload = { fields: { ReferralCode: referralCode } };
  await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function findUserByReferralCode(referralCode) {
  if (!referralCode || referralCode.trim() === '') {
    return null;
  }

  const referralCodeEscaped = safeEscapeFormulaString(referralCode.trim());
  const formula = `{ReferralCode} = "${referralCodeEscaped}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: '1',
  });

  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  return data.records && data.records.length > 0 ? data.records[0] : null;
}

async function createReferralRecord(referredPersonId, referralCode, email) {
  const referrerUser = await findUserByReferralCode(referralCode);
  
  const payload = {
    records: [
      {
        fields: {
          Email: email,
          ReferredPerson: [referredPersonId],
          ReferredBy: referrerUser ? [referrerUser.id] : [],
          ReferralCode: referralCode,
        },
      },
    ],
  };

  try {
    const data = await airtableRequest(encodeURIComponent(AIRTABLE_REFERRALS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    
    return data.records[0];
  } catch (error) {
    console.error('Failed to create referral record:', error);
    throw error;
  }
}

async function logEmail(email) {
  const payload = {
    records: [
      {
        fields: {
          Email: email,
        },
      },
    ],
  };
  await airtableRequest(encodeURIComponent(AIRTABLE_EMAIL_LOG_TABLE), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


