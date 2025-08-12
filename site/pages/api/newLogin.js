import crypto from 'crypto';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = 'Users';
const AIRTABLE_OTP_TABLE = 'OTP';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const LOOPS_TRANSACTIONAL_KEY = process.env.LOOPS_TRANSACTIONAL_KEY;
const LOOPS_TRANSACTIONAL_TEMPLATE_ID = process.env.LOOPS_TRANSACTIONAL_TEMPLATE_ID; // required to send
const LOOPS_API_BASE = 'https://app.loops.so/api/v1';

export default async function handler(req, res) {
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

  try {
    // Ensure user exists (create if new)
    let userRecord = await findUserByEmail(normalizedEmail);
    if (!userRecord) {
      userRecord = await createUser(normalizedEmail);
    }

    // Enforce 10 second cooldown for OTP
    const hasRecentOtp = await hasRecentOtpForEmail(normalizedEmail, 10);
    if (hasRecentOtp) {
      return res.status(429).json({ message: 'Please wait 10 seconds before requesting a new code.' });
    }

    // Generate new credentials
    const tokenLength = 120;
    const otp = generateSixDigitCode();
    const token = generateAlphanumericToken(tokenLength);

    // Create OTP record
    await createOtpRecord({ email: normalizedEmail, otp, token });

    // Update user's token
    await updateUserToken(userRecord.id, token);

    // Fire-and-forget transactional email via Loops (do not block success)
    sendOtpEmailViaLoops(normalizedEmail, otp).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('sendOtpEmailViaLoops error:', err);
    });

    return res.status(200).json({ message: 'OTP generated and sent.' });
  } catch (error) {
    // Log detailed error on server for debugging
    // eslint-disable-next-line no-console
    console.error('newLogin error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}


const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateSixDigitCode() {
  // 100000..999999 ensures 6 digits and avoids Airtable numeric field issues
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

function escapeFormulaString(value) {
  // Use double quotes in formula and escape any embedded double quotes
  return String(value).replace(/"/g, '\\"');
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
  const emailEscaped = escapeFormulaString(email);
  const formula = `LOWER(SUBSTITUTE({Email}, " ", "")) = "${emailEscaped}"`;
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

async function createUser(email) {
  const payload = {
    records: [
      {
        fields: {
          Email: email,
        },
      },
    ],
  };
  const data = await airtableRequest(encodeURIComponent(AIRTABLE_USERS_TABLE), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.records[0];
}

async function updateUserToken(userId, token) {
  const candidateFields = ['token', 'Token', 'User Token'];
  let lastError = null;
  for (const fieldName of candidateFields) {
    try {
      const payload = { fields: { [fieldName]: token } };
      await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Failed to update user token');
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
  const emailEscaped = escapeFormulaString(email);
  const params = new URLSearchParams();
  params.set('filterByFormula', `LOWER(SUBSTITUTE({Email}, " ", "")) = "${emailEscaped}"`);
  params.set('pageSize', '1');
  params.set('sort[0][field]', 'Created At');
  params.set('sort[0][direction]', 'desc');
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_OTP_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  const record = data.records && data.records[0];
  return record || null;
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
    return; // Not configured; skip sending
  }
  const url = `${LOOPS_API_BASE}/transactional`;
  const payload = {
    transactionalId: LOOPS_TRANSACTIONAL_TEMPLATE_ID,
    email,
    // Include multiple common variable names to avoid template mismatch
    dataVariables: { otp, OTP: otp, code: otp },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOOPS_TRANSACTIONAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errMsg = data?.error || `status ${res.status}`;
    throw new Error(`Loops transactional send failed: ${errMsg}`);
  }
  if (data && data.success === false) {
    throw new Error(`Loops transactional send failed: ${data?.error || 'unknown error'}`);
  }
}


