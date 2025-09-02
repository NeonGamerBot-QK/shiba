import { isValidUrl, safeEscapeFormulaString } from './utils/security.js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "appg245A41MWc6Rej";
const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || "Users";
const AIRTABLE_GAMES_TABLE = process.env.AIRTABLE_GAMES_TABLE || "Games";
const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ message: "Server configuration error" });
  }

  const {
    token,
    gameId,
    name,
    description,
    thumbnailUrl,
    thumbnailUpload,
    GitHubURL,
    ShowreelLink,
    HackatimeProjects,
  } = req.body || {};
  if (!token || !gameId) {
    return res
      .status(400)
      .json({ message: "Missing required fields: token, gameId" });
  }

  // Validate gameId format (should be a valid Airtable record ID)
  const airtableRecordIdRegex = /^rec[a-zA-Z0-9]{14}$/;
  if (!airtableRecordIdRegex.test(gameId)) {
    return res.status(400).json({ message: 'Invalid game ID format' });
  }

  try {
    const userRecord = await findUserByToken(token);
    if (!userRecord) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Fetch the game to verify ownership
    const game = await airtableRequest(
      `${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(
        gameId
      )}`,
      {
        method: "GET",
      }
    );
    const ownerIds = normalizeLinkedIds(game?.fields?.Owner);
    const isOwner = ownerIds.includes(userRecord.id);
    if (!isOwner) {
      return res
        .status(403)
        .json({ message: "Forbidden: not the owner of this game" });
    }

    const fields = {};

    if (typeof name === "string") {
      const sname = name.trim().substring(0, 100);
      if (sname.length > 0) fields.Name = sname;
    }

    if (typeof description === "string") {
      const sdesc = description.trim().substring(0, 1000);
      if (sdesc.length > 0) fields.Description = sdesc;
    }

    if (typeof GitHubURL === "string") {
      const t = GitHubURL.trim();
      if (t.length > 0) {
        if (isValidUrl(t, ["https:"], ["github.com"])) {
          fields.GitHubURL = t;
        } else {
          return res.status(400).json({ message: "Invalid GitHub URL" });
        }
      }
    }

    if (typeof ShowreelLink === "string") {
      const t = ShowreelLink.trim();
      if (t.length > 0) {
        if (isValidUrl(t, ["https:"], ["youtube.com", "youtu.be"])) {
          fields.ShowreelLink = t;
        } else {
          return res.status(400).json({ message: "Invalid Showreel URL. Please use a valid YouTube URL." });
        }
      } else {
        // Allow clearing the field by setting it to empty string
        fields.ShowreelLink = "";
      }
    }

    if (typeof HackatimeProjects === "string") {
      // Accept comma-separated list of names; store as a single CSV string in Airtable
      const sproj = HackatimeProjects.substring(0, 500);
      const parts = sproj
        .split(",")
        .map((s) => s.trim().replace(/[<>&"']/g, ""))
        .filter(Boolean)
        .slice(0, 5);
      if (parts.length > 0) {
        fields["Hackatime Projects"] = parts.join(", ");
      }
    }

    if (typeof thumbnailUrl === "string" && thumbnailUrl.trim().length > 0) {
      const t = thumbnailUrl.trim().substring(0, 500);
      if (isValidUrl(t, ["https:", "http:"])) {
        fields.Thumbnail = [
          {
            url: t,
          },
        ];
      } else {
        return res.status(400).json({ message: "Invalid thumbnail URL" });
      }
    }

    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const updated =
      Object.keys(fields).length > 0
        ? await airtableRequest(
            `${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(
              gameId
            )}`,
            {
              method: "PATCH",
              body: JSON.stringify({ fields }),
            }
          )
        : null;

    // Optional: direct upload to Airtable attachment field via base64 bytes
    if (thumbnailUpload && typeof thumbnailUpload === "object") {
      const { fileBase64, contentType, filename } = thumbnailUpload || {};
      if (fileBase64 && contentType && filename) {
        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedTypes.includes(contentType)) {
          return res
            .status(400)
            .json({ message: "Invalid file type for thumbnail" });
        }

        // Validate file size (max 5MB)
        const fileSize = Math.ceil((fileBase64.length * 3) / 4);
        if (fileSize > 5 * 1024 * 1024) {
          return res
            .status(400)
            .json({ message: "Thumbnail file too large (max 5MB)" });
        }

        const uploadResult = await airtableContentUpload({
          recordId: gameId,
          fieldName: "Thumbnail",
          fileBase64,
          contentType,
          filename,
        });
        // Ensure only a single attachment remains by patching to the uploaded attachment only
        try {
          const fieldArrays =
            uploadResult && uploadResult.fields
              ? Object.values(uploadResult.fields).filter((v) =>
                  Array.isArray(v)
                )
              : [];
          const uploadedArray = fieldArrays && fieldArrays[0];
          const uploadedAtt =
            Array.isArray(uploadedArray) && uploadedArray.length > 0
              ? uploadedArray[uploadedArray.length - 1]
              : null;
          if (uploadedAtt && uploadedAtt.id) {
            await airtableRequest(
              `${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(
                gameId
              )}`,
              {
                method: "PATCH",
                body: JSON.stringify({
                  fields: { Thumbnail: [{ id: uploadedAtt.id }] },
                }),
              }
            );
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("post-upload thumbnail normalization failed:", e);
        }
      }
    }

    // Fetch final record to return latest fields (in case upload occurred)
    const latest = await airtableRequest(
      `${encodeURIComponent(AIRTABLE_GAMES_TABLE)}/${encodeURIComponent(
        gameId
      )}`,
      {
        method: "GET",
      }
    );

    const result = {
      id: latest.id,
      name: latest.fields?.Name || "",
      description: latest.fields?.Description || "",
      thumbnailUrl:
        Array.isArray(latest.fields?.Thumbnail) &&
        latest.fields.Thumbnail[0]?.url
          ? latest.fields.Thumbnail[0].url
          : "",
      GitHubURL: latest.fields?.GitHubURL || latest.fields?.GithubURL || "",
      ShowreelLink: latest.fields?.ShowreelLink || "",
      HackatimeProjects: Array.isArray(latest.fields?.["Hackatime Projects"])
        ? latest.fields["Hackatime Projects"].filter(Boolean).join(", ")
        : typeof latest.fields?.["Hackatime Projects"] === "string"
        ? latest.fields["Hackatime Projects"]
        : "",
    };

    return res.status(200).json({ ok: true, game: result });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("updateGame error:", error);
    return res.status(500).json({ message: "An unexpected error occurred." });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "5mb",
    },
  },
};

async function airtableRequest(path, options = {}) {
  const url = `${AIRTABLE_API_BASE}/${AIRTABLE_BASE_ID}/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Airtable error ${response.status}: ${text}`);
  }
  return response.json();
}

async function airtableContentUpload({
  recordId,
  fieldName,
  fileBase64,
  contentType,
  filename,
}) {
  const url = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(
    recordId
  )}/${encodeURIComponent(fieldName)}/uploadAttachment`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: fileBase64, contentType, filename }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable content upload error ${res.status}: ${text}`);
  }
  return res.json();
}

async function findUserByToken(token) {
  // SECURITY FIX: Escape the token to prevent formula injection
  const escapedToken = safeEscapeFormulaString(token);
  const formula = `{token} = "${escapedToken}"`;
  const params = new URLSearchParams({
    filterByFormula: formula,
    pageSize: "1",
  });

  const data = await airtableRequest(
    `${encodeURIComponent(AIRTABLE_USERS_TABLE)}?${params.toString()}`,
    {
      method: "GET",
    }
  );
  const record = data.records && data.records[0];
  return record || null;
}

function normalizeLinkedIds(value) {
  if (Array.isArray(value)) {
    if (value.length === 0) return [];
    if (typeof value[0] === "string") return value;
    if (
      typeof value[0] === "object" &&
      value[0] &&
      typeof value[0].id === "string"
    ) {
      return value.map((v) => v.id);
    }
  }
  return [];
}
