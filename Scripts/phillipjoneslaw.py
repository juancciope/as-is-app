import requests
from bs4 import BeautifulSoup
import time
import pandas as pd
import os # For checking if CSV exists

# --- Configuration ---
AUCTION_URL = "https://phillipjoneslaw.com/foreclosure-auctions.cfm?accept=yes"
REQUEST_DELAY = 1 # Seconds to wait between requests (though only one request here)
CSV_OUTPUT_FILENAME = "phillipjoneslaw_foreclosures.csv"
SOURCE_WEBSITE_NAME = "phillipjoneslaw.com" # To add a source column

# --- Helper Function to Fetch Page Content ---
def fetch_page(url):
    """Fetches the content of a given URL."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    }
    try:
        print(f"Fetching URL: {url}")
        response = requests.get(url, headers=headers, timeout=20)
        response.raise_for_status()
        print(f"Successfully fetched {url} (Status: {response.status_code})")
        return response.text
    except requests.exceptions.Timeout:
        print(f"Timeout error fetching {url}")
        return None
    except requests.exceptions.HTTPError as e:
        print(f"HTTP error fetching {url}: {e.response.status_code} {e.response.reason}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Generic error fetching {url}: {e}")
        return None

# --- Function to Parse the Auction Data Table ---
def parse_auction_data(html_content):
    """
    Parses the HTML content to extract auction data from the table.
    Returns a list of dictionaries, where each dictionary represents an auction.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    auction_list = []

    # Find the table by its ID
    auction_table = soup.find('table', id='auctionTbl')
    if not auction_table:
        print("Could not find the auction table with id='auctionTbl'.")
        return auction_list

    # Find all rows in the table body
    # The HTML structure provided shows <tr> directly under <tbody> which is under <table>
    table_body = auction_table.find('tbody')
    if not table_body: # Fallback if tbody is not explicitly found
        table_body = auction_table
    
    rows = table_body.find_all('tr')

    if not rows or len(rows) <= 1: # Check if any data rows exist (more than just header)
        print("No data rows found in the auction table.")
        return auction_list

    # Skip the header row (the first <tr>)
    for row_index, row in enumerate(rows[1:], start=1): # Start index from 1 for logging
        cells = row.find_all('td')
        
        # Expecting 6 cells: Case #, Address, County, Sale Date, Sale Time, Status
        if len(cells) == 6:
            try:
                case_number = cells[0].text.strip()
                address = cells[1].text.strip()
                county = cells[2].text.strip()
                sale_date = cells[3].text.strip()
                sale_time = cells[4].text.strip()
                # For status, get all text content, including handling multiple lines or nested tags if any
                status = cells[5].get_text(separator="\n", strip=True) 

                auction_list.append({
                    'SourceWebsite': SOURCE_WEBSITE_NAME,
                    'CaseNumber': case_number,
                    'PropertyAddress': address,
                    'County': county,
                    'SaleDate': sale_date,
                    'SaleTime': sale_time,
                    'Status': status
                })
            except Exception as e:
                print(f"Row {row_index}: Error parsing row. Details: {e}. Row content: {row.get_text(strip=True, separator='|')}")
                continue # Skip to the next row
        else:
            print(f"Row {row_index}: Skipping row, expected 6 cells, got {len(cells)}. Content: {row.get_text(strip=True, separator='|')}")
            
    return auction_list

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Scraper for {SOURCE_WEBSITE_NAME} ---")
    print(f"Fetching data from: {AUCTION_URL}")
    
    html_content = fetch_page(AUCTION_URL)
    
    if html_content:
        print("\n--- Parsing Auction Data ---")
        auctions = parse_auction_data(html_content)
        print(f"Found {len(auctions)} auction entries.")
        
        if auctions:
            # Convert list of dictionaries to Pandas DataFrame
            df = pd.DataFrame(auctions)
            
            print(f"\n--- First 5 Auction Entries ---")
            print(df.head().to_string())
            
            # Save to CSV
            try:
                # This script will create/overwrite its own CSV.
                # Merging with other CSVs will be a separate step as discussed.
                df.to_csv(CSV_OUTPUT_FILENAME, index=False, encoding='utf-8')
                print(f"\nData successfully saved to {CSV_OUTPUT_FILENAME}")
            except Exception as e:
                print(f"Error saving data to CSV: {e}")
        else:
            print("No auction data was extracted.")
    else:
        print("Failed to fetch HTML content. Scraper cannot proceed.")
        
    print(f"\n--- End of Scraper for {SOURCE_WEBSITE_NAME} ---")

