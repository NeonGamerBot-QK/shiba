const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameId, name, description, thumbnailUrl, thumbnailUpload, GitHubURL, HackatimeProjects } = req.body || {};
  if (!token || !gameId) {
    return res.status(400).json({ message: 'Missing required fields: token, gameId' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Fetch the game to verify ownership
    const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
      method: 'GET',
    });
    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: not the owner of this game' });
    }

    const fields = {};
    if (typeof name === 'string') fields.Name = name;
    if (typeof description === 'string') fields.Description = description;
    if (typeof GitHubURL === 'string') fields.GitHubURL = GitHubURL;
    if (typeof HackatimeProjects === 'string') {
      // Accept comma-separated list of names; store as a single CSV string in Airtable
      const parts = HackatimeProjects.split(',').map((s) => s.trim()).filter(Boolean);
      fields['Hackatime Projects'] = parts.join(', ');
    }
    if (typeof thumbnailUrl === 'string' && thumbnailUrl.trim().length > 0) {
      fields.Thumbnail = [
        {
          url: thumbnailUrl.trim(),
        },
      ];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const updated = Object.keys(fields).length > 0 ? await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ fields }),
    }) : null;

    // Optional: direct upload to Airtable attachment field via base64 bytes
    if (thumbnailUpload && typeof thumbnailUpload === 'object') {
      const { fileBase64, contentType, filename } = thumbnailUpload || {};
      if (fileBase64 && contentType && filename) {
        const uploadResult = await airtableContentUpload({
          recordId: gameId,
          fieldName: 'Thumbnail',
          fileBase64,
          contentType,
          filename,
        });
        // Ensure only a single attachment remains by patching to the uploaded attachment only
        try {
          const fieldArrays = uploadResult && uploadResult.fields ? Object.values(uploadResult.fields).filter((v) => Array.isArray(v)) : [];
          const uploadedArray = fieldArrays && fieldArrays[0];
          const uploadedAtt = Array.isArray(uploadedArray) && uploadedArray.length > 0 ? uploadedArray[uploadedArray.length - 1] : null;
          if (uploadedAtt && uploadedAtt.id) {
            await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ fields: { Thumbnail: [{ id: uploadedAtt.id }] } }),
            });
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('post-upload thumbnail normalization failed:', e);
        }
      }
    }

    // Fetch final record to return latest fields (in case upload occurred)
    const latest = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, {
      method: 'GET',
    });

    const result = {
      id: latest.id,
      name: latest.fields?.Name || '',
      description: latest.fields?.Description || '',
      thumbnailUrl: Array.isArray(latest.fields?.Thumbnail) && latest.fields.Thumbnail[0]?.url ? latest.fields.Thumbnail[0].url : '',
      GitHubURL: latest.fields?.GitHubURL || latest.fields?.GithubURL || '',
      HackatimeProjects: Array.isArray(latest.fields?.['Hackatime Projects'])
        ? latest.fields['Hackatime Projects'].filter(Boolean).join(', ')
        : (typeof latest.fields?.['Hackatime Projects'] === 'string' ? latest.fields['Hackatime Projects'] : ''),
    };

    return res.status(200).json({ ok: true, game: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('updateGame error:', error);
    return res.status(500).json({ message: 'An unexpected error occurred.' });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

function escapeFormulaString(value) {
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

async function airtableContentUpload({ recordId, fieldName, fileBase64, contentType, filename }) {
  const url = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(recordId)}/${encodeURIComponent(fieldName)}/uploadAttachment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: fileBase64, contentType, filename }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Airtable content upload error ${res.status}: ${text}`);
  }
  return res.json();
}

async function findUserByToken(token) {
  const tokenEscaped = escapeFormulaString(token);
  const formula = `{token} = "${tokenEscaped}"`;
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

function normalizeLinkedIds(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === 'string') return value;
    if (typeof value[0] === 'object' && value[0] && typeof value[0].id === 'string') {
      return value.map((v) => v.id);
    }
  }
  return [];
}


