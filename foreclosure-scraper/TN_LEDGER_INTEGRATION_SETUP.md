# TN Ledger Integration Setup Guide

## Overview
The TN Ledger foreclosure scraper has been enhanced and is ready to integrate with your existing as-is-app dashboard. The scraper now includes auction detail parsing, geolocation, and direct integration with your current infrastructure.

## Current Status
✅ **Enhanced Actor Deployed**: `hallow_arbor/tnledger-foreclosure-scraper` (Version 1.0)
✅ **API Integration Updated**: Modified `/app/api/scrape-apify/route.ts` to handle enhanced data
✅ **Dashboard Button Ready**: TN Ledger button already exists in the dashboard
✅ **Environment Variables Documented**: Updated `.env.example` with required variables

## Required Environment Variables

Add these to your Vercel project environment variables:

```bash
# Apify Configuration
APIFY_API_TOKEN=your_apify_api_token_here
APIFY_ACTOR_ID_TNLEDGER=hallow_arbor/tnledger-foreclosure-scraper

# These should already be configured:
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Enhanced Features

### 1. **Auction Detail Parsing**
- Extracts auction time from `sale_details_text` (e.g., "10:00 AM", "2:00 P.M.")
- Identifies auction locations (courthouse, doors, steps, etc.)
- Parses auction addresses

### 2. **Geolocation**
- Geocodes property addresses using Google Maps API
- Provides latitude/longitude coordinates
- Enhanced county detection for accurate "within_30min" classification

### 3. **Smart Date Detection**
- Automatically determines the correct Friday date when run
- No manual date input required for normal operation

### 4. **Direct Database Integration**
- Data flows through your existing unified pipeline
- Maintains consistency with Phillip Jones Law and ClearRecon data
- Uses existing `foreclosure_data` table structure

## How It Works

1. **User clicks "Run TN Ledger"** in the dashboard
2. **API calls enhanced actor** with your environment variables
3. **Actor scrapes and processes data**:
   - Scrapes TN Ledger foreclosure notices
   - Parses auction time and location details
   - Geocodes addresses for accurate county detection
4. **Data flows to existing pipeline**:
   - Transforms to unified format
   - Stores in `foreclosure_data` table
   - Appears in dashboard alongside other sources

## Data Structure

The enhanced actor returns data with these additional fields:

```typescript
interface TnLedgerData {
  // Original fields
  borrower_list: string;
  property_address_list: string;
  advertised_auction_date_list: string;
  // ... other original fields
  
  // Enhanced fields
  auction_time?: string;          // e.g., "10:00 AM"
  auction_location?: string;      // e.g., "courthouse steps"
  auction_address?: string;       // e.g., "123 Main St"
  property_lat?: number;          // Geocoded latitude
  property_lng?: number;          // Geocoded longitude
  property_formatted_address?: string;
  scraped_at?: string;
  notice_date?: string;
}
```

## Testing

To test the integration:

1. **Set environment variables** in Vercel
2. **Deploy the updated code** to your Vercel app
3. **Click "Run TN Ledger"** in the dashboard
4. **Monitor the console** for processing logs
5. **Check the data table** for new TN Ledger entries

## Expected Results

- **Processing Time**: 2-3 minutes for ~30-40 notices
- **Data Quality**: Enhanced with auction times and geocoded locations
- **Integration**: Seamless with existing dashboard and filtering
- **Performance**: Efficient with built-in geocoding and smart date detection

## Next Steps

1. Add the environment variables to your Vercel project
2. Deploy the updated code
3. Test the TN Ledger button in your dashboard
4. Monitor the results and data quality

The TN Ledger scraper is now ready to provide enhanced foreclosure data directly to your existing as-is-app dashboard!