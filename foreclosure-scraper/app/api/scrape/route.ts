import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { scrapers } = await request.json();
    
    // Validate input
    const validScrapers = ['clearrecon', 'phillipjoneslaw', 'tnledger', 'wabipowerbi', 'wilson', 'all'];
    const selectedScrapers = scrapers || ['all'];
    
    if (!Array.isArray(selectedScrapers) || !selectedScrapers.every(s => validScrapers.includes(s))) {
      return NextResponse.json({ error: 'Invalid scrapers selection' }, { status: 400 });
    }

    // Run the aggregator script
    const scriptPath = path.join(process.cwd(), 'foreclosure-scraper', 'scrapers', 'aggregator.py');
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath}`);
    
    if (stderr) {
      console.error('Scraper stderr:', stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping completed successfully',
      output: stdout,
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