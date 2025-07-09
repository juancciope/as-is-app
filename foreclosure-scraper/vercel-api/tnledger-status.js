// Vercel API endpoint to check TN Ledger scraper status
// Place this in your Vercel app at: api/scrapers/tnledger/status.js

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { runId } = req.query;

  if (!runId) {
    return res.status(400).json({ error: 'runId parameter required' });
  }

  const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
  const ACTOR_ID = 'hallow_arbor/tnledger-foreclosure-scraper';

  if (!APIFY_TOKEN) {
    return res.status(500).json({ error: 'Apify token not configured' });
  }

  try {
    // Get run status from Apify
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Apify API error: ${error}`);
    }

    const runData = await response.json();
    const run = runData.data;

    // Get dataset info if run is finished
    let resultCount = 0;
    let datasetId = null;
    
    if (run.status === 'SUCCEEDED' && run.defaultDatasetId) {
      datasetId = run.defaultDatasetId;
      
      // Get dataset info
      const datasetResponse = await fetch(
        `https://api.apify.com/v2/datasets/${datasetId}?token=${APIFY_TOKEN}`
      );
      
      if (datasetResponse.ok) {
        const datasetData = await datasetResponse.json();
        resultCount = datasetData.data.itemCount || 0;
      }
    }

    return res.status(200).json({
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      resultCount,
      datasetId,
      runUrl: `https://console.apify.com/actors/${ACTOR_ID}/runs/${run.id}`,
      datasetUrl: datasetId ? `https://console.apify.com/storage/datasets/${datasetId}` : null,
      stats: {
        durationMillis: run.stats?.durationMillis,
        computeUnits: run.stats?.computeUnits,
        memoryAvgMbytes: run.stats?.memoryAvgMbytes
      }
    });

  } catch (error) {
    console.error('Error checking scraper status:', error);
    return res.status(500).json({
      error: 'Failed to check scraper status',
      details: error.message
    });
  }
}