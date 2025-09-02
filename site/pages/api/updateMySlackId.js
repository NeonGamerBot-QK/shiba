// DISABLED: This endpoint is not used anywhere in the codebase
// Slack ID updates are handled automatically by the OAuth flow in oauthCallback.js

// const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
// const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
// const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
// const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     res.setHeader('Allow', 'POST');
//     return res.status(405).json({ message: 'Method Not Allowed' });
//   }

//   if (!AIRTABLE_API_KEY) {
//     return res.status(500).json({ message: 'Server configuration error' });
//   }

//   const { token, slackId } = req.body || {};
//   if (!token || !slackId) {
//     return res.status(400).json({ message: 'Missing required fields: token, slackId' });
//   }

//   try {
//     const user = await findUserByToken(token);
//     if (!user) {
//       return res.status(401).json({ message: 'Invalid token' });
//     }

//     const payload = { fields: { 'slack id': String(slackId) } };
//     await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}/${encodeURIComponent(user.id)}`, {
//       method: 'PATCH',
//       body: JSON.stringify(payload),
//     });

//     return res.status(200).json({ ok: true });
//   } catch (e) {
//     // eslint-disable-next-line no-console
//     console.error('updateMySlackId error:', e);
//     return res.status(500).json({ message: 'An unexpected error occurred.' });
//   }
// }

// function safeEscapeFormulaString(value) {
//   return String(value).replace(/"/g, '\\"');
// }

// async function airtableRequest(path, options = {}) {
//   const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
//   const response = await fetch(url, {
//     ...options,
//     headers: {
//       Authorization: `Bearer ${AIRTABLE_API_KEY}`,
//       'Content-Type': 'application/json',
//       ...(options.headers || {}),
//     },
//   });
//   if (!response.ok) {
//     const text = await response.text().catch(() => '');
//     throw new Error(`Airtable error ${response.status}: ${text}`);
//   }
//   return response.json();
// }

// async function findUserByToken(token) {
//   const tokenEscaped = safeEscapeFormulaString(token);
//   const params = new URLSearchParams({
//     filterByFormula: `{token} = "${tokenEscaped}"`,
//     pageSize: '1',
//   });
//   const data = await airtableRequest(`${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`, {
//     method: 'GET',
//   });
//   return (data.records && data.records[0]) || null;
// }

// Return 404 for any requests to this disabled endpoint
export default async function handler(req, res) {
  return res.status(404).json({ 
    message: 'Endpoint disabled - Slack ID updates are handled automatically via OAuth flow' 
  });
}


