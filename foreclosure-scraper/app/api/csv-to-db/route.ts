import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, FORECLOSURE_TABLE } from '@/lib/supabase';
import { readFile } from 'fs/promises';
import { parse } from 'csv-parse/sync';
import path from 'path';

interface CSVRecord {
  SOURCE: string;
  DATE: string;
  TIME?: string;
  PL: string;
  FIRM: string;
  ADDRESS: string;
  CTY: string;
  WITHIN_30MIN: string;
  CLOSEST_CITY?: string;
  DISTANCE_MILES?: string;
  EST_DRIVE_TIME?: string;
  GEOCODE_METHOD?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Read the CSV file that was created by the Python scraper
    const csvPath = path.join(process.cwd(), 'data', 'processed', 'unified_data.csv');
    
    // Check if file exists
    let csvContent: string;
    try {
      csvContent = await readFile(csvPath, 'utf-8');
    } catch (error) {
      return NextResponse.json({
        error: 'CSV file not found',
        details: 'Python scraper may not have completed successfully'
      }, { status: 404 });
    }

    // Parse CSV
    const records: CSVRecord[] = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    if (records.length === 0) {
      return NextResponse.json({
        error: 'No data found in CSV file'
      }, { status: 400 });
    }

    // Clear existing data
    const { error: deleteError } = await supabaseAdmin
      .from(FORECLOSURE_TABLE)
      .delete()
      .neq('id', 0);

    if (deleteError) {
      console.error('Error clearing existing data:', deleteError);
      return NextResponse.json({
        error: 'Failed to clear existing data',
        details: deleteError.message
      }, { status: 500 });
    }

    // Convert CSV records to Supabase format
    const supabaseRecords = records.map(row => ({
      source: row.SOURCE,
      date: row.DATE,
      time: row.TIME && row.TIME.trim() !== '' ? row.TIME : null,
      pl: row.PL,
      firm: row.FIRM,
      address: row.ADDRESS,
      city: row.CTY,
      within_30min: row.WITHIN_30MIN,
      closest_city: row.CLOSEST_CITY && row.CLOSEST_CITY.trim() !== '' ? row.CLOSEST_CITY : null,
      distance_miles: row.DISTANCE_MILES && row.DISTANCE_MILES.trim() !== '' ? parseFloat(row.DISTANCE_MILES) : null,
      est_drive_time: row.EST_DRIVE_TIME && row.EST_DRIVE_TIME.trim() !== '' ? row.EST_DRIVE_TIME : null,
      geocode_method: row.GEOCODE_METHOD && row.GEOCODE_METHOD.trim() !== '' ? row.GEOCODE_METHOD : null
    }));

    // Insert in batches to avoid payload size limits
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < supabaseRecords.length; i += batchSize) {
      const batch = supabaseRecords.slice(i, i + batchSize);
      
      const { error: insertError } = await supabaseAdmin
        .from(FORECLOSURE_TABLE)
        .insert(batch);

      if (insertError) {
        console.error('Error inserting batch:', insertError);
        return NextResponse.json({
          error: 'Failed to insert data batch',
          details: insertError.message,
          batchNumber: Math.floor(i / batchSize) + 1
        }, { status: 500 });
      }

      totalInserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      message: 'Data successfully transferred from CSV to database',
      recordsProcessed: records.length,
      recordsInserted: totalInserted,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('CSV to DB transfer error:', error);
    return NextResponse.json({
      error: 'Failed to transfer CSV data to database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}