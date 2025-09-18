export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const slackId = String(req.query.slackId || '').trim();
  const email = String(req.query.email || '').trim();
  
  // Either slackId or email must be provided
  if (!slackId && !email) {
    return res.status(400).json({ message: 'Missing slackId or email' });
  }
  
  // Validate slackId format if provided
  if (slackId && !/^[A-Za-z0-9_-]{1,50}$/.test(slackId)) {
    return res.status(400).json({ message: 'That is a funny looking slack id' });
  }

  const startDate = '2025-08-18';
  const endDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // Add 1 day
    return d.toISOString().slice(0, 10);
  })();
  
  try {
    let hackatimeUserId;
    let method = 'slackId';
    let fallbackUsed = false;
    
    // Helper function to fetch stats for a given user ID
    const fetchStats = async (userId) => {
      const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(userId)}/stats?features=projects&start_date=${startDate}&end_date=${endDate}`;
      const headers = { 
        Accept: 'application/json',
        "Rack-Attack-Bypass": process.env.HACKATIME_RATE_LIMIT_BYPASS || ''
      };
      
      const r = await fetch(url, { headers });
      const json = await r.json().catch(() => ({}));
      
      if (!r.ok) {
        throw new Error(`Stats fetch failed: ${r.status}`);
      }
      
      return json;
    };
    
    // Helper function to process projects data
    const processProjects = (json) => {
      const projects = Array.isArray(json?.data?.projects) ? json.data.projects : [];
      const names = projects.map((p) => p?.name).filter(Boolean);
      const projectsWithTime = projects.map((p) => ({
        name: p?.name,
        time: Math.round((p?.total_seconds || 0) / 60)
      })).filter((p) => p.name);
      
      return { projects: names, projectsWithTime };
    };
    
    // If both slackId and email are provided, try slackId first
    if (slackId && email) {
      console.log('Both slackId and email provided, trying slackId first');
      
      try {
        hackatimeUserId = slackId;
        const json = await fetchStats(hackatimeUserId);
        const { projects, projectsWithTime } = processProjects(json);
        
        // If we got projects from slackId, return them
        if (projects.length > 0) {
          console.log(`Found ${projects.length} projects using slackId method`);
          res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
          return res.status(200).json({ 
            projects, 
            projectsWithTime,
            method: 'slackId',
            userId: hackatimeUserId
          });
        } else {
          console.log('No projects found with slackId, falling back to email method');
          fallbackUsed = true;
        }
      } catch (error) {
        console.log('slackId method failed, falling back to email method:', error.message);
        fallbackUsed = true;
      }
    }
    
    // Use email method if:
    // 1. Only email is provided, OR
    // 2. Both are provided but slackId returned no projects or failed
    if (email && (!slackId || fallbackUsed)) {
      console.log('Looking up Hackatime user by email:', email);
      const lookupResponse = await fetch(`https://hackatime.hackclub.com/api/v1/users/lookup_email/${encodeURIComponent(email)}`, {
        headers: {
          "Rack-Attack-Bypass": process.env.HACKATIME_RATE_LIMIT_BYPASS || '',
          "Authorization": "Bearer " + (process.env.STATS_API_KEY || ''),
          "Accept": "application/json"
        }
      });
      
      if (!lookupResponse.ok) {
        const errorText = await lookupResponse.text().catch(() => '');
        console.error('Email lookup failed:', lookupResponse.status, errorText);
        return res.status(lookupResponse.status).json({ 
          message: 'Failed to lookup user by email',
          error: errorText 
        });
      }
      
      const lookupData = await lookupResponse.json().catch(() => ({}));
      hackatimeUserId = lookupData.user_id || lookupData.id;
      
      if (!hackatimeUserId) {
        return res.status(404).json({ message: 'User not found with that email' });
      }
      
      console.log('Found Hackatime user ID:', hackatimeUserId);
      method = 'email';
    } else if (slackId && !email) {
      // Use slackId directly if only slackId is provided
      hackatimeUserId = slackId;
    }
    
    // Fetch stats using the resolved user ID
    const json = await fetchStats(hackatimeUserId);
    const { projects, projectsWithTime } = processProjects(json);
    
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ 
      projects, 
      projectsWithTime,
      method,
      userId: hackatimeUserId,
      fallbackUsed: fallbackUsed
    });
  } catch (e) {
    console.error('hackatimeProjects proxy error:', e);
    return res.status(500).json({ message: 'Failed to fetch projects' });
  }
}


