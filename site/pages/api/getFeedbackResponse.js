import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_PLAYTESTS_TABLE = process.env.AIRTABLE_PLAYTESTS_TABLE || 'PlaytestTickets';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, feedbackText } = req.body || {};
  
  if (!token || !feedbackText) {
    return res.status(400).json({ message: 'Missing required fields: token, feedbackText' });
  }

  try {
    // Find user by token
    const user = await findUserByToken(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Find the playtest record that contains this feedback
    const playtestRecord = await findPlaytestByFeedback(feedbackText);
    if (!playtestRecord) {
      return res.status(404).json({ message: 'Playtest record not found for this feedback' });
    }

    // Return the current Response and ResponseMessage values
    const response = playtestRecord.fields.Response === "None" ? null : (playtestRecord.fields.Response || null);
    const responseMessage = playtestRecord.fields.ResponseMessage === "None" ? null : (playtestRecord.fields.ResponseMessage || null);

    return res.status(200).json({ 
      ok: true, 
      response: response,
      responseMessage: responseMessage,
      playtestId: playtestRecord.id
    });

  } catch (error) {
    console.error('getFeedbackResponse error:', error);
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

async function findPlaytestByFeedback(feedbackText) {
  const escapedFeedback = safeEscapeFormulaString(feedbackText);
  const params = new URLSearchParams({
    filterByFormula: `{Feedback} = "${escapedFeedback}"`,
    pageSize: '1',
  });
  
  const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_PLAYTESTS_TABLE)}?${params.toString()}`, {
    method: 'GET',
  });
  
  return (data.records && data.records[0]) || null;
}
