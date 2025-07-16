import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { scrapers } = await request.json();
    
    // For now, return a message indicating to use Apify
    return NextResponse.json({
      success: false,
      message: 'Local scrapers are being migrated to Apify. Please use the individual Apify scraper buttons.',
      note: 'Currently only Phillip Jones Law is available via Apify.'
    }, { status: 501 });
    
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