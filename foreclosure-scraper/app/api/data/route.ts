import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface DataRecord {
  WITHIN_30MIN?: string;
  CTY?: string;
  DATE?: string;
  [key: string]: any;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'unified';
    
    // Define file paths
    const dataPath = path.join(process.cwd(), 'data', 'processed');
    let fileName = 'unified_data.csv';
    
    if (source !== 'unified') {
      fileName = `${source}_data.csv`;
    }
    
    const filePath = path.join(dataPath, fileName);
    
    // Read and parse CSV
    const fileContent = await readFile(filePath, 'utf-8');
    const records: DataRecord[] = parse(fileContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    // Apply filters if provided
    const withinRange = searchParams.get('within30min');
    const city = searchParams.get('city');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    let filteredRecords: DataRecord[] = records;
    
    if (withinRange === 'true') {
      filteredRecords = filteredRecords.filter(r => r.WITHIN_30MIN === 'Y');
    }
    
    if (city) {
      filteredRecords = filteredRecords.filter(r => 
        r.CTY?.toLowerCase().includes(city.toLowerCase())
      );
    }
    
    if (dateFrom || dateTo) {
      filteredRecords = filteredRecords.filter(r => {
        if (!r.DATE) return false; // Skip records without dates
        const recordDate = new Date(r.DATE);
        if (dateFrom && recordDate < new Date(dateFrom)) return false;
        if (dateTo && recordDate > new Date(dateTo)) return false;
        return true;
      });
    }
    
    return NextResponse.json({
      data: filteredRecords,
      total: filteredRecords.length,
      source,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Data fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data', details: error.message },
      { status: 500 }
    );
  }
}