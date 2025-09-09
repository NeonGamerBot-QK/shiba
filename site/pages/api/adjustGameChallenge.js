import { safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_CHALLENGES_TABLE = process.env.AIRTABLE_CHALLENGES_TABLE || 'Challenges';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    console.error('[adjustGameChallenge] Missing AIRTABLE_API_KEY');
    return res.status(500).json({ message: 'Server configuration error' });
  }

  try {
    const { token, challengeId, status } = req.body || {};
    
    console.log('[adjustGameChallenge] Request body:', req.body);
    console.log('[adjustGameChallenge] Extracted values:', { token, challengeId, status });
    
    if (!token) {
      console.log('[adjustGameChallenge] Missing token');
      return res.status(400).json({ message: 'Token is required' });
    }
    
    if (!challengeId) {
      console.log('[adjustGameChallenge] Missing challengeId');
      return res.status(400).json({ message: 'Challenge ID is required' });
    }
    
    if (!status) {
      console.log('[adjustGameChallenge] Missing status');
      return res.status(400).json({ message: 'Status is required' });
    }

    console.log(`[adjustGameChallenge] Updating challenge ${challengeId} to status: ${status} for token: ${token}`);

    // Update the challenge record in Airtable
    const updateData = {
      fields: {
        Status: status
      }
    };

    const response = await airtableRequest(`${AIRTABLE_CHALLENGES_TABLE}/${challengeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });

    console.log(`[adjustGameChallenge] Successfully updated challenge ${challengeId}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Challenge status updated successfully',
      challengeId: challengeId,
      newStatus: status
    });

  } catch (error) {
    console.error('[adjustGameChallenge] Error:', error);
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
