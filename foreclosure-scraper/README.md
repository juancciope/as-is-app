# Foreclosure Scraper Dashboard

A web application for scraping, analyzing, and monitoring foreclosure auction data from multiple sources in Tennessee.

## Features

- **Multi-Source Data Scraping**: Collects data from 5 different foreclosure/auction websites
- **Automated Geocoding**: Automatically geocodes properties and calculates distances to target cities
- **Real-time Dashboard**: Web-based UI for monitoring and analyzing data
- **Smart Filtering**: Filter by location (within 30 minutes of Nashville/Mt. Juliet), source, and date
- **Data Export**: Export filtered results to CSV format
- **Scheduled Scraping**: Support for automated scraping via cron jobs

## Data Sources

1. **ClearRecon** (clearrecon-tn.com) - Tennessee foreclosure listings
2. **Phillip Jones Law** (phillipjoneslaw.com) - Foreclosure auctions
3. **TN Ledger** (tnledger.com) - Public notices
4. **WABI PowerBI** (logs.com) - Power BI integrated data
5. **Wilson Associates** (sales.wilson-assoc.com) - Auction sales

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Scraping**: Python (Selenium, BeautifulSoup, Pandas)
- **Deployment**: Vercel
- **Database**: File-based CSV storage (can be upgraded to PostgreSQL)

## Project Structure

```
foreclosure-scraper/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── scrape/       # Scraping endpoints
│   │   └── data/         # Data retrieval endpoints
│   ├── dashboard/        # Dashboard pages
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── ui/              # Reusable UI components
│   └── dashboard/       # Dashboard-specific components
├── scrapers/             # Python scraping scripts
│   ├── sources/         # Individual scraper modules
│   └── aggregator.py    # Main aggregation script
├── data/                 # Data storage
│   ├── raw/            # Raw scraper outputs
│   ├── processed/      # Processed/unified data
│   └── cache/          # Geocoding cache
├── lib/                  # Utility functions
├── config/              # Configuration files
└── scripts/             # Utility scripts

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- Chrome browser (for Selenium-based scrapers)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd foreclosure-scraper
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment variables:
```bash
cp .env.example .env
```

5. Update `.env` with your configuration:
   - Add Power BI resource key for wabipowerbi scraper
   - Configure geocoding settings
   - Set target cities and drive time limits

### Running Locally

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

3. Click "Run All Scrapers" to start data collection

### Manual Scraping

Run individual scrapers:
```bash
npm run scrape:clearrecon
npm run scrape:phillipjoneslaw
npm run scrape:tnledger
npm run scrape:wabipowerbi
npm run scrape:wilson
```

Run all scrapers:
```bash
npm run scrape
```

## Deployment

### Vercel Deployment

1. Push your code to GitHub

2. Connect your GitHub repository to Vercel

3. Configure environment variables in Vercel dashboard

4. Deploy:
```bash
vercel --prod
```

### Environment Variables

Required environment variables for production:

- `POWERBI_RESOURCE_KEY`: Required for wabipowerbi scraper
- `GEOCODING_API_KEY`: Optional, for enhanced geocoding
- `CHROME_HEADLESS`: Set to "true" for server environments
- `TARGET_CITIES`: Comma-separated list of target cities
- `MAX_DRIVE_TIME_MINUTES`: Maximum drive time for filtering

## API Endpoints

### POST /api/scrape
Trigger scraping for selected sources.

Request body:
```json
{
  "scrapers": ["all"] // or specific scrapers: ["clearrecon", "tnledger"]
}
```

### GET /api/data
Retrieve scraped data with optional filters.

Query parameters:
- `source`: Data source filter (default: "unified")
- `within30min`: Filter properties within 30 minutes (true/false)
- `city`: Filter by city name
- `dateFrom`: Start date filter
- `dateTo`: End date filter

## Data Schema

Unified data format:
```csv
SOURCE,DATE,TIME,PL,FIRM,ADDRESS,CTY,WITHIN_30MIN,CLOSEST_CITY,DISTANCE_MILES,EST_DRIVE_TIME,GEOCODE_METHOD
```

## Troubleshooting

### Selenium Issues
- Ensure Chrome is installed
- Check ChromeDriver compatibility
- Set `CHROME_NO_SANDBOX=true` for containerized environments

### Geocoding Failures
- Check internet connectivity
- Verify geocoding API limits
- Review cache directory permissions

### Scraping Timeouts
- Increase `SCRAPING_TIMEOUT` in environment variables
- Check target website availability
- Review network connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.