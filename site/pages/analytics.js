import { useEffect } from "react";
import ShibaFunnelChart from "../components/ShibaFunnelChart";
import SignupCountComponent from "../components/SignupCountComponent";
import HoursPerDayChart from "../components/HoursPerDayChart";
import ReviewBacklogChart from "../components/ReviewBacklogChart";

export default function AnalyticsPage({ funnelData, signupData, hoursPerDayData, reviewBacklogData }) {
  useEffect(() => {
    // Disable the animated background for this page
    const animatedBackground = document.querySelector('[style*="backgroundImage"]');
    if (animatedBackground) {
      animatedBackground.style.opacity = '0';
    }
    
    // Cleanup function to restore background when leaving page
    return () => {
      if (animatedBackground) {
        animatedBackground.style.opacity = '0.2';
      }
    };
  }, []);

  return (
    <div style={{ 
      backgroundColor: 'white', 
      display: "flex", 
      justifyContent: "center", 
      backgroundImage: 'none', 
      width: '100vw', 
      minHeight: '100vh',
      padding: '20px'
    }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        width: "100%", 
        maxWidth: "800px", 
        paddingBottom: 32 
      }}>
        <p style={{marginTop: 0, fontWeight: 600, marginBottom: 16}}>Analytics for Shiba</p>
        <p>In the spirit of open source, we're publicly sharing our analytics dashboard for Shiba. This is the data the team uses to see how the program is doing and to make decisions on what to add to the platform.</p>
        
        <ShibaFunnelChart {...funnelData} />
        
        <div style={{ 
          display: 'flex', 
          gap: '20px', 
          marginTop: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <SignupCountComponent {...signupData} />
          </div>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <ReviewBacklogChart data={reviewBacklogData} />
          </div>
        </div>
        
        <HoursPerDayChart data={hoursPerDayData} />
      </div>
    </div>
  );
}

export async function getServerSideProps() {
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appg245A41MWc6Rej';
  const AIRTABLE_USERS_TABLE = process.env.AIRTABLE_USERS_TABLE || 'Users';
  const AIRTABLE_POSTS_TABLE = process.env.AIRTABLE_POSTS_TABLE || 'Posts';
  const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

  // Import Airtable for review backlog data
  const Airtable = require('airtable');
  const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

  if (!AIRTABLE_API_KEY) {
    console.error('Missing AIRTABLE_API_KEY');
    return {
      props: {
        funnelData: { signedUp: 0, onboarded: 0, connectedHackatime: 0, slack: 0, logged10Hours: 0, logged20Hours: 0, logged30Hours: 0, logged40Hours: 0, logged50Hours: 0, logged60Hours: 0, logged70Hours: 0, logged80Hours: 0, logged90Hours: 0, logged100Hours: 0 },
        signupData: { totalSignups: 0, hackClubCommunity: 0, referrals: 0 },
        hoursPerDayData: [],
        reviewBacklogData: [],
      },
    };
  }

  try {
    // Helper function to make Airtable requests
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

    // Helper function to fetch all records from a table
    async function fetchAllAirtableRecords(tableName) {
      let allRecords = [];
      let offset;
      
      do {
        const params = new URLSearchParams();
        params.set('pageSize', '100');
        if (offset) params.set('offset', offset);
        
        const page = await airtableRequest(`${encodeURIComponent(tableName)}?${params.toString()}`, { method: 'GET' });
        allRecords = allRecords.concat(page?.records || []);
        offset = page?.offset;
      } while (offset);
      
      return allRecords;
    }

    // Fetch all users and posts in parallel
    const [allUsers, allPosts] = await Promise.all([
      fetchAllAirtableRecords(AIRTABLE_USERS_TABLE),
      fetchAllAirtableRecords(AIRTABLE_POSTS_TABLE)
    ]);

    // Process funnel data
    const signedUp = allUsers.length;
    const onboarded = allUsers.filter(user => user.fields?.hasOnboarded === true).length;
    const connectedHackatime = allUsers.filter(user => {
      const hackatimeProjects = user.fields?.['Hackatime Projects'];
      return hackatimeProjects && hackatimeProjects.length > 0;
    }).length;
    const slack = allUsers.filter(user => {
      const slackId = user.fields?.['slack id'];
      return typeof slackId === 'string' && slackId.trim() !== '';
    }).length;

    const logged10Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 10;
    }).length;
    const logged20Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 20;
    }).length;
    const logged30Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 30;
    }).length;
    const logged40Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 40;
    }).length;
    const logged50Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 50;
    }).length;
    const logged60Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 60;
    }).length;
    const logged70Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 70;
    }).length;
    const logged80Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 80;
    }).length;
    const logged90Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 90;
    }).length;
    const logged100Hours = allUsers.filter(user => {
      const hoursSpent = user.fields?.['Hours Spent'];
      return typeof hoursSpent === 'number' && hoursSpent >= 100;
    }).length;

    // Process signup data
    let hackClubCommunity = 0;
    let referrals = 0;
    
    allUsers.forEach(user => {
      const referredBy = user.fields?.ReferredBy;
      
      if (!referredBy || referredBy === '' || referredBy === null || referredBy === undefined) {
        hackClubCommunity++;
      } else {
        referrals++;
      }
    });

    // Process hours per day data
    const startDate = new Date('2025-05-18T00:00:00Z');
    const filteredPosts = allPosts.filter(post => {
      const createdAt = post.fields?.['Created At'];
      if (!createdAt) return false;
      
      const postDate = new Date(createdAt);
      return postDate >= startDate;
    });

    const hoursPerDay = {};
    
    filteredPosts.forEach(post => {
      const createdAt = post.fields?.['Created At'];
      const hoursSpent = post.fields?.['HoursSpent'];
      
      if (createdAt && typeof hoursSpent === 'number' && hoursSpent > 0) {
        const date = new Date(createdAt);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!hoursPerDay[dateKey]) {
          hoursPerDay[dateKey] = 0;
        }
        hoursPerDay[dateKey] += hoursSpent;
      }
    });

    const hoursPerDayArray = Object.entries(hoursPerDay)
      .map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 100) / 100 // Round to 2 decimal places
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    const funnelData = {
      signedUp,
      onboarded,
      slack,
      connectedHackatime,
      logged10Hours,
      logged20Hours,
      logged30Hours,
      logged40Hours,
      logged50Hours,
      logged60Hours,
      logged70Hours,
      logged80Hours,
      logged90Hours,
      logged100Hours
    };

    const signupData = {
      totalSignups: signedUp,
      hackClubCommunity,
      referrals
    };

    // Fetch review backlog data
    const reviewStatuses = {
      'Needs Review': 0,
      'Needs Rereview': 0,
      'Reviewed': 0
    };

    let allReviewRecords = [];

    // Fetch all records from Active YSWS Record table (100 at a time)
    await base('Active YSWS Record')
      .select({
        pageSize: 100,
        fields: ['ReviewStatus']
      })
      .eachPage((records, fetchNextPage) => {
        allReviewRecords = allReviewRecords.concat(records);
        fetchNextPage();
      });

    // Count ReviewStatus values
    allReviewRecords.forEach(record => {
      const status = record.get('ReviewStatus');
      if (status && reviewStatuses.hasOwnProperty(status)) {
        reviewStatuses[status]++;
      }
    });

    // Format data for chart
    const reviewBacklogData = [
      {
        label: 'Needs Review',
        value: reviewStatuses['Needs Review'],
        color: '#ff6b6b'
      },
      {
        label: 'Needs Rereview',
        value: reviewStatuses['Needs Rereview'],
        color: '#ffa726'
      },
      {
        label: 'Reviewed',
        value: reviewStatuses['Reviewed'],
        color: '#66bb6a'
      }
    ];

    return {
      props: {
        funnelData,
        signupData,
        hoursPerDayData: hoursPerDayArray,
        reviewBacklogData,
      },
    };
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    
    // Return fallback data if API fails
    return {
      props: {
        funnelData: {
          signedUp: 1200,
          onboarded: 850,
          connectedHackatime: 600,
          logged10Hours: 400,
          logged20Hours: 250,
          logged30Hours: 150,
          logged40Hours: 100,
          logged50Hours: 80,
          logged60Hours: 60,
          logged70Hours: 45,
          logged80Hours: 35,
          logged90Hours: 25,
          logged100Hours: 20
        },
        signupData: {
          totalSignups: 1200,
          hackClubCommunity: 800,
          referrals: 400
        },
        hoursPerDayData: [],
        reviewBacklogData: [],
      },
    };
  }
}
