# TN Ledger Foreclosure Scraper

This actor scrapes foreclosure notices from the Tennessee Ledger website with intelligent date detection.

## Features

- **Smart Date Detection**: Automatically determines the correct Friday date to scrape based on when the actor is run
- **Complete Data Extraction**: Scrapes both summary and detailed information for each foreclosure notice
- **Error Handling**: Robust error handling for network issues and page structure changes
- **Respectful Scraping**: Includes delays between requests to avoid overloading the server

## How it Works

The scraper intelligently determines which Friday's data to scrape:

- **If run on Friday**: Scrapes today's data
- **If run on Saturday**: Scrapes yesterday's (Friday) data  
- **If run Sunday-Thursday**: Scrapes the most recent Friday's data

This ensures you always get the most current available foreclosure notices.

## Input Configuration

- `noticesDate` (optional): Specific date to scrape in M/D/YYYY format (e.g., "7/4/2025")
- If not provided, the actor automatically determines the correct Friday date

## Output

The actor outputs an array of foreclosure notices with the following fields:

### Summary Data (from list page):
- `borrower_list`: Borrower name
- `property_address_list`: Property address
- `advertised_auction_date_list`: Auction date
- `date_of_first_notice_list`: First notice date
- `details_url`: URL to detailed notice page

### Detailed Data (from detail pages):
- `borrower_detail`: Detailed borrower information
- `address_detail`: Complete property address
- `original_trustee`: Original trustee name
- `attorney`: Attorney information
- `instrument_no`: Instrument number
- `substitute_trustee`: Substitute trustee
- `advertised_auction_date_detail`: Detailed auction date
- `date_of_first_public_notice_detail`: Detailed first notice date
- `trust_date`: Trust date
- `tdn_no`: TDN number
- `sale_details_text`: Full sale details text

## Usage

1. Run the actor without any input for automatic date detection
2. Or specify a specific date using the `noticesDate` input parameter
3. The actor will scrape all available foreclosure notices for that date

## Error Handling

The actor includes comprehensive error handling:
- Network connectivity issues
- Page structure changes
- Individual notice parsing errors
- Timeout handling

If individual notices fail to process, they're still included in the output with an error flag.