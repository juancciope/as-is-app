// Vercel API endpoint to trigger TN Ledger scraper
// Place this in your Vercel app at: api/scrapers/tnledger/trigger.js

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get configuration from request body or environment variables
  const {
    noticesDate,
    supabaseUrl = process.env.SUPABASE_URL,
    supabaseAnonKey = process.env.SUPABASE_ANON_KEY,
    googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY,
    tableName = 'tn_ledger_foreclosures'
  } = req.body;

  // Apify configuration
  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  const ACTOR_ID = 'hallow_arbor/tnledger-foreclosure-scraper'; // Your actor ID

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'Apify token not configured' });
  }

  try {
    // Trigger the Apify actor
    const response = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          noticesDate,
          supabaseUrl,
          supabaseAnonKey,
          googleMapsApiKey,
          tableName
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apify API error: ${error}`);
    }

    const run = await response.json();

    // Return the run info
    return res.status(200).json({
      success: true,
      runId: run.data.id,
      runUrl: `https://console.apify.com/actors/${ACTOR_ID}/runs/${run.data.id}`,
      status: run.data.status,
      startedAt: run.data.startedAt
    });

  } catch (error) {
    console.error('Error triggering TN Ledger scraper:', error);
    return res.status(500).json({
      error: 'Failed to trigger scraper',
      details: error.message
    });
  }
}