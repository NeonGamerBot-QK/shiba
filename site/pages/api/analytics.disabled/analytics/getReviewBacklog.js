import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const reviewStatuses = {
      'Needs Review': 0,
      'Needs Rereview': 0,
      'Reviewed': 0
    };

    let allRecords = [];
    let offset = null;

    // Fetch all records from Active YSWS Record table (100 at a time)
    do {
      const params = {
        pageSize: 100,
        fields: ['ReviewStatus']
      };

      if (offset) {
        params.offset = offset;
      }

      const response = await base('Active YSWS Record').select(params).firstPage();
      
      allRecords = allRecords.concat(response);
      offset = response.offset;
    } while (offset);

    // Count ReviewStatus values
    allRecords.forEach(record => {
      const status = record.get('ReviewStatus');
      if (status && reviewStatuses.hasOwnProperty(status)) {
        reviewStatuses[status]++;
      }
    });

    // Format data for chart
    const chartData = [
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

    res.status(200).json({
      success: true,
      data: chartData,
      total: allRecords.length
    });

  } catch (error) {
    console.error('Error fetching review backlog data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch review backlog data'
    });
  }
}
