export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { slackId } = req.query;
  
  if (!slackId) {
    return res.status(400).json({ message: 'slackId is required' });
  }

  try {
    // Check cache first
    const cacheKey = `slackProfile_${slackId}`;
    const cachedData = await getCachedProfile(slackId);
    
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Fetch from cachet.dunkirk.sh
    const response = await fetch(`https://cachet.dunkirk.sh/users/${encodeURIComponent(slackId)}`);
    const profileData = await response.json().catch(() => ({}));
    
    if (profileData && (profileData.displayName || profileData.image)) {
      const profile = {
        displayName: profileData.displayName || '',
        image: profileData.image || '',
        slackId: slackId,
        cachedAt: Date.now()
      };
      
      // Cache the profile for 24 hours
      await setCachedProfile(slackId, profile);
      
      return res.status(200).json(profile);
    } else {
      // Cache empty result to avoid repeated failed requests
      const emptyProfile = {
        displayName: '',
        image: '',
        slackId: slackId,
        cachedAt: Date.now()
      };
      await setCachedProfile(slackId, emptyProfile);
      
      return res.status(200).json(emptyProfile);
    }
  } catch (error) {
    console.error('Error fetching Slack profile:', error);
    return res.status(500).json({ message: 'Failed to fetch profile' });
  }
}

// In-memory cache with 24-hour expiration
const profileCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function getCachedProfile(slackId) {
  const cached = profileCache.get(slackId);
  if (cached && (Date.now() - cached.cachedAt) < CACHE_DURATION) {
    return cached;
  }
  return null;
}

async function setCachedProfile(slackId, profile) {
  profileCache.set(slackId, profile);
  
  // Clean up expired entries periodically
  if (profileCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of profileCache.entries()) {
      if ((now - value.cachedAt) >= CACHE_DURATION) {
        profileCache.delete(key);
      }
    }
  }
}
