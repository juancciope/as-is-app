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

    // Call the Python scraper endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scrapers: selectedScrapers })
    });

    if (!response.ok) {
      throw new Error(`Python scraper failed with status: ${response.status}`);
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Scraping completed successfully',
      output: result.message || 'Scraping completed',
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