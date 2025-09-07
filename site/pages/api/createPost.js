import { safeEscapeFormulaString, generateSecureRandomString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || 'Games';
const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';
const ALPHANUMERIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  const { token, gameId, content, attachmentsUpload, playLink, postType, timelapseVideoId, githubImageLink, timeScreenshotId, hoursSpent, minutesSpent } = req.body || {};
  if (!token || !gameId || !content) {
    return res.status(400).json({ message: 'Missing required fields: token, gameId, content' });
  }
  
  // Validate artlog-specific fields
  if (postType === 'artlog') {
    if (!timelapseVideoId || !githubImageLink || hoursSpent === undefined || minutesSpent === undefined) {
      return res.status(400).json({ 
        message: 'Artlog posts require timelapseVideoId, githubImageLink, hoursSpent, and minutesSpent. TimeScreenshotId is optional.' 
      });
    }
  }

  const sanitized = String(content).trim().substring(0, 5000); // they really should not be this long
  if (sanitized.length === 0) {
    return res.status(400).json({ message: 'Content empty?' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Verify ownership of the game
    const game = await airtableRequest(`${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(gameId)}`, { method: 'GET' });
    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res.status(403).json({ message: 'Forbidden: not the owner of this game' });
    }

    // Create a new Post and link to the Game
    const postId = generateAlphanumericId(16);
    const fields = {
      Content: sanitized,
      Game: [gameId],
      PostID: postId,
    };
    
    // Add artlog-specific fields
    if (postType === 'artlog') {
      fields.Timelapse = timelapseVideoId;
      fields['Link to Github Asset'] = githubImageLink;
      // Only set screenshot field if it has a valid value
      if (timeScreenshotId && timeScreenshotId.trim() !== '') {
        fields.TimeScreenshotFile = [{ url: timeScreenshotId }];
      }
      fields.TimeSpentOnAsset = parseFloat(hoursSpent) + (parseFloat(minutesSpent) / 60);
    }

    if (typeof playLink === 'string' && playLink.trim().length > 0) {
      const trimmed = playLink.trim().substring(0, 500);
      try {
        const url = new URL(trimmed);
        if (url.protocol === 'https:') {
          fields.PlayLink = trimmed;
        }
      } catch {
        // wonky
      }
    }
    const payload = { records: [{ fields }] };
    const created = await airtableRequest(encodeURIComponent(AIRTABLE_POSTS_TABLE), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const rec = created?.records?.[0];
    
    // Optionally upload multiple attachments to Attachements field
    if (rec && Array.isArray(attachmentsUpload) && attachmentsUpload.length > 0) {
      for (const item of attachmentsUpload) {
        const { fileBase64, url, contentType, filename, id, size } = item || {};
        
        // Handle base64 uploads (legacy approach)
        if (fileBase64 && contentType && filename) {
          try {
            await airtableContentUpload({
              recordId: rec.id,
              fieldName: 'Attachements',
              fileBase64,
              contentType,
              filename,
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('createPost attachment upload failed:', e);
          }
        }
        
        // Handle URL-based attachments (new S3 approach)
        if (url && contentType && filename) {
          try {
            // Get current post to see existing attachment links
            const currentPost = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(rec.id)}`, { method: 'GET' });
            const existingLinks = currentPost?.fields?.AttachementLinks || '';
            const linksArray = existingLinks ? existingLinks.split(',').map(link => link.trim()).filter(link => link) : [];
            
            // Add the new URL to the list
            if (!linksArray.includes(url)) {
              linksArray.push(url);
            }
            
            // Update the post record with the new attachment links
            const updatePayload = {
              fields: {
                AttachementLinks: linksArray.join(', ')
              }
            };
            
            await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(rec.id)}`, {
              method: 'PATCH',
              body: JSON.stringify(updatePayload),
            });
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('createPost S3 attachment links failed:', e);
          }
        }
      }
    }
    
    // Fetch latest post to include uploaded attachments
    const latest = await airtableRequest(`${encodeURIComponent(AIRTABLE_POSTS_TABLE)}/${encodeURIComponent(rec.id)}`, { method: 'GET' });
    
    if (!latest) {
      console.error('Failed to fetch latest post data');
      return res.status(500).json({ message: 'Failed to fetch post data after creation' });
    }
    
    const result = latest
      ? {
          id: latest.id,
          content: latest.fields?.Content || '',
          gameId,
          PostID: latest.fields?.PostID || postId,
          createdAt: latest.fields?.['Created At'] || latest.createdTime || new Date().toISOString(),
          PlayLink: typeof latest.fields?.PlayLink === 'string' ? latest.fields.PlayLink : '',
          postType: (latest.fields?.Timelapse && latest.fields?.['Link to Github Asset'] && latest.fields?.TimeSpentOnAsset) ? 'artlog' : 'devlog',
                        timelapseVideoId: latest.fields?.Timelapse || '',
              githubImageLink: latest.fields?.['Link to Github Asset'] || '',
              timeScreenshotId: latest.fields?.TimeScreenshotFile?.[0]?.url || '',
              hoursSpent: postType === 'artlog' ? (latest.fields?.TimeSpentOnAsset || 0) : (latest.fields?.HoursSpent || 0),
              timeSpentOnAsset: latest.fields?.TimeSpentOnAsset || 0,
              minutesSpent: 0,
          attachments: (() => {
            const airtableAttachments = Array.isArray(latest.fields?.Attachements)
              ? latest.fields.Attachements.map((a) => ({ 
                  url: a?.url, 
                  type: a?.type, 
                  contentType: a?.type, // Add contentType for compatibility
                  filename: a?.filename, 
                  id: a?.id, 
                  size: a?.size 
                })).filter((a) => a.url)
              : [];
            
            // Add S3 attachment links
            const attachmentLinks = latest.fields?.AttachementLinks || '';
            const s3Attachments = attachmentLinks
              ? attachmentLinks.split(',').map(link => link.trim()).filter(link => link).map(url => {
                  const filename = url.split('/').pop() || 'attachment';
                  let ext = '';
                  
                  // Try to get extension from filename first
                  if (filename.includes('.')) {
                    ext = filename.split('.').pop().toLowerCase();
                  } 
                  // If no extension in filename, try to get it from the URL path
                  else {
                    const urlPath = new URL(url).pathname;
                    const pathParts = urlPath.split('.');
                    if (pathParts.length > 1) {
                      ext = pathParts[pathParts.length - 1].toLowerCase();
                    }
                  }
                  
                  // Determine content type from file extension
                  let contentType = 'application/octet-stream';
                  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) {
                    contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                  } else if (['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'mpg', 'mpeg'].includes(ext)) {
                    contentType = `video/${ext}`;
                  } else if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
                    contentType = `audio/${ext}`;
                  }
                  
                  return {
                    url: url,
                    type: contentType,
                    contentType: contentType,
                    filename: filename.includes('.') ? filename : `attachment.${ext}`,
                    id: `s3-${Date.now()}`,
                    size: 0
                  };
                })
              : [];
            
            return [...airtableAttachments, ...s3Attachments];
          })(),
          badges: Array.isArray(latest.fields?.Badges) ? latest.fields.Badges : [],
        }
      : null;

    console.log('createPost result:', result);
    return res.status(200).json({ ok: true, post: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('createPost error:', error);
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

function generateAlphanumericId(length) {
  return generateSecureRandomString(length);
}


