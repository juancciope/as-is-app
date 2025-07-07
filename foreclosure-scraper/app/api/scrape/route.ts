import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { scrapers } = await request.json();
    
    // Validate input
    const validScrapers = ['clearrecon', 'phillipjoneslaw', 'tnledger', 'wabipowerbi', 'wilson', 'all'];
    const selectedScrapers = scrapers || ['all'];
    
    if (!Array.isArray(selectedScrapers) || !selectedScrapers.every(s => validScrapers.includes(s))) {
      return NextResponse.json({ error: 'Invalid scrapers selection' }, { status: 400 });
    }

    // Step 1: Call the Python scraper endpoint to generate CSV
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    console.log('Starting Python scraper...');
    const scraperResponse = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scrapers: selectedScrapers })
    });

    if (!scraperResponse.ok) {
      throw new Error(`Python scraper failed with status: ${scraperResponse.status}`);
    }

    const scraperResult = await scraperResponse.json();
    console.log('Python scraper completed, transferring to database...');

    // Step 2: Transfer CSV data to Supabase
    const csvToDbResponse = await fetch(`${baseUrl}/api/csv-to-db`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!csvToDbResponse.ok) {
      const csvError = await csvToDbResponse.json();
      throw new Error(`CSV to DB transfer failed: ${csvError.error}`);
    }

    const csvResult = await csvToDbResponse.json();
    console.log('Data transfer completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Scraping completed and data saved to database',
      scraperOutput: scraperResult.output || 'Scraping completed',
      recordsProcessed: csvResult.recordsProcessed,
      recordsInserted: csvResult.recordsInserted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run scrapers', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ready',
    availableScrapers: ['clearrecon', 'phillipjoneslaw', 'tnledger', 'wabipowerbi', 'wilson']
  });
}