import requests
from bs4 import BeautifulSoup
import time
import pandas as pd # Optional, but recommended for data handling and CSV export
import re # For parsing the javascript link
from urllib.parse import unquote # For decoding URL encoded characters like %2f

# --- Configuration ---
BASE_URL = "https://tnledger.com"
# The initial page with the list of notices
# You can change the date in the URL to scrape different days
NOTICES_LIST_URL = "https://tnledger.com/Notices.aspx?noticesDate=7/4/2025"
REQUEST_DELAY = 1 # Seconds to wait between requests to be polite to the server

# --- Helper Function to Fetch Page Content ---
def fetch_page(url):
    """Fetches the content of a given URL."""
    headers = { # Add some basic headers to mimic a browser
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Connection': 'keep-alive'
    }
    try:
        print(f"Fetching URL: {url}")
        response = requests.get(url, headers=headers, timeout=20) # Increased timeout
        response.raise_for_status() # Raises an HTTPError for bad responses (4XX or 5XX)
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

# --- Function to Parse the Main Foreclosure Notices List Page ---
def parse_notices_list(html_content):
    """
    Parses the HTML of the main notices list page to extract individual notice details.
    Returns a list of dictionaries.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    notices_data = []
    notices_table = soup.find('table', id='ContentPane_ForeclosureGridView')

    if not notices_table:
        print("Could not find the foreclosure notices table (id='ContentPane_ForeclosureGridView') on the list page.")
        return notices_data

    table_body = notices_table.find('tbody')
    if not table_body:
        table_body = notices_table

    notice_rows = table_body.find_all('tr')

    if not notice_rows or len(notice_rows) <= 1:
        print("No data rows found in the table (or only header row).")
        return notices_data

    for row_index, row in enumerate(notice_rows[1:], start=1):
        cells = row.find_all('td')
        if len(cells) == 5:
            try:
                link_tag = cells[0].find('a', href=True)
                details_url = None
                if link_tag:
                    js_href = link_tag['href']
                    match = re.search(r"javascript:OpenChildFT2\('([^']+)','([^']+)'\)", js_href)
                    if match:
                        notice_id = match.group(1)
                        encoded_date = match.group(2)
                        notice_date = unquote(encoded_date)
                        details_url = f"{BASE_URL}/Search/Details/ViewNotice.aspx?id={notice_id}&date={notice_date}"
                    else:
                        print(f"Row {row_index}: Could not parse JavaScript link: {js_href}")
                else:
                    print(f"Row {row_index}: No link tag found in the first cell.")

                borrower = cells[1].text.strip()
                property_address = cells[2].text.strip()
                auction_date = cells[3].text.strip()
                first_notice_date = cells[4].text.strip()

                if property_address == '\xa0': property_address = ''
                if auction_date == '\xa0': auction_date = ''

                if details_url:
                    notices_data.append({
                        'borrower_list': borrower,
                        'property_address_list': property_address,
                        'advertised_auction_date_list': auction_date,
                        'date_of_first_notice_list': first_notice_date,
                        'details_url': details_url
                    })
                else:
                    print(f"Row {row_index}: Skipping row due to missing or unparseable details URL. Borrower: {borrower}")
            except AttributeError as e:
                print(f"Row {row_index}: Error parsing a row (AttributeError): {e}. Row content: {row.get_text(strip=True, separator='|')}")
            except Exception as e:
                print(f"Row {row_index}: An unexpected error occurred: {e}. Row: {row.get_text(strip=True, separator='|')}")
        else:
            print(f"Row {row_index}: Skipping row, expected 5 cells, got {len(cells)}. Content: {row.get_text(strip=True, separator='|')}")
    return notices_data


# --- Helper function to safely extract text from a BeautifulSoup element ---
def get_safe_text(element, default="Not found"):
    """Returns the stripped text of an element or a default value if element is None."""
    return element.text.strip() if element else default

# --- Function to Parse an Individual Notice Detail Page ---
def parse_notice_detail_page(html_content):
    """
    Parses the HTML of an individual notice detail page.
    Returns a dictionary with all the extracted fields.
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    details = {}

    record_details_div = soup.find('div', id='record-details')
    if not record_details_div:
        print("Could not find 'div#record-details' on the detail page.")
        # Return empty details or details with error flags
        for key in ['borrower_detail', 'address_detail', 'original_trustee', 'attorney',
                    'instrument_no', 'substitute_trustee', 'advertised_auction_date_detail',
                    'date_of_first_public_notice_detail', 'trust_date', 'tdn_no', 'sale_details_text']:
            details[key] = "Record details div not found"
        return details

    # Helper to find span by ID within the record_details_div
    def get_span_text(span_id, default="Not found"):
        span = record_details_div.find('span', id=span_id)
        return get_safe_text(span, default)

    details['borrower_detail'] = get_span_text('lbl1')
    
    address_part1 = get_span_text('lbl2')
    address_part2 = get_span_text('lbl3')
    full_address = []
    if address_part1 and address_part1 != "Not found":
        full_address.append(address_part1)
    if address_part2 and address_part2 != "Not found":
        full_address.append(address_part2)
    details['address_detail'] = " ".join(full_address) if full_address else "Not found"
    
    details['original_trustee'] = get_span_text('lbl4')
    details['attorney'] = get_span_text('lbl5')
    details['instrument_no'] = get_span_text('lbl6')
    details['substitute_trustee'] = get_span_text('lbl7')
    details['advertised_auction_date_detail'] = get_span_text('lbl8')
    details['date_of_first_public_notice_detail'] = get_span_text('lbl9')
    details['trust_date'] = get_span_text('lbl10') # This was empty in the example, will be "Not found" or ""
    details['tdn_no'] = get_span_text('lbl11')

    # Extracting the full sale details text from <p> tags after the summary panel
    sale_details_text_parts = []
    pnl_summary_div = record_details_div.find('div', id='pnlSummary')
    if pnl_summary_div:
        current_element = pnl_summary_div.find_next_sibling()
        while current_element:
            if current_element.name == 'p':
                # Using get_text with a separator to preserve some structure if text is broken by <br> etc.
                sale_details_text_parts.append(current_element.get_text(separator=' ', strip=True))
            current_element = current_element.find_next_sibling()
    
    if sale_details_text_parts:
        details['sale_details_text'] = "\n\n".join(sale_details_text_parts).strip()
    else:
        # Fallback if pnlSummary is not found or no <p> tags follow
        # This might happen if the page structure is different than expected
        all_p_tags = record_details_div.find_all('p')
        if all_p_tags:
            # A simple heuristic: assume the first <p> after the title is the start of the sale text
            # This is less robust and depends on the consistency of the page structure
            # For now, we rely on the pnl_summary_div approach. If it fails, this could be a fallback.
             print("Warning: Could not find pnlSummary or subsequent <p> tags for sale details. Trying to find all <p> tags in record-details.")
             temp_sale_text = []
             title_span = record_details_div.find('span', id='lblTitle') # Header like "Foreclosure Notice"
             found_title = False
             if title_span:
                 found_title = True

             for p_tag in all_p_tags:
                 if found_title and p_tag.find_parent('div', id='pnlSummary'): # Don't include p tags from summary table if any
                     continue
                 if found_title: # Add p_tags after the title
                     temp_sale_text.append(p_tag.get_text(separator=' ', strip=True))

             if temp_sale_text:
                details['sale_details_text'] = "\n\n".join(temp_sale_text).strip()
             else:
                details['sale_details_text'] = "Sale details text not found (fallback failed)"
        else:
            details['sale_details_text'] = "Sale details text not found"
            
    return details

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Scraper for {NOTICES_LIST_URL} ---")
    main_page_html = fetch_page(NOTICES_LIST_URL)
    all_foreclosure_data = []

    if main_page_html:
        print("\n--- Parsing Main Notices List Page ---")
        notices_on_list_page = parse_notices_list(main_page_html)
        print(f"Found {len(notices_on_list_page)} notice(s) with valid detail URLs on the list page.")

        if not notices_on_list_page:
             print("\nNo notices with valid detail URLs found on the list page. Exiting.")
        else:
            for i, notice_summary in enumerate(notices_on_list_page):
                print(f"\n--- Processing Notice {i+1} of {len(notices_on_list_page)} ---")
                detail_url = notice_summary.get('details_url')

                if not detail_url: # Should ideally not happen if parse_notices_list filters correctly
                    print(f"Skipping notice due to missing detail URL: {notice_summary.get('borrower_list', 'N/A')}")
                    continue

                print(f"Fetching detail page: {detail_url}")
                detail_page_html = fetch_page(detail_url)

                if detail_page_html:
                    print("Parsing detail page...")
                    detailed_info = parse_notice_detail_page(detail_page_html)
                    combined_data = {**notice_summary, **detailed_info}
                    all_foreclosure_data.append(combined_data)
                    print(f"Successfully processed and stored data for: {notice_summary.get('borrower_list', 'N/A')}")
                else:
                    print(f"Failed to fetch detail page: {detail_url}. Storing list data only.")
                    error_data = {**notice_summary, 'detail_page_error': f'Failed to fetch or parse {detail_url}'}
                    all_foreclosure_data.append(error_data)

                print(f"Waiting for {REQUEST_DELAY} seconds before next request...")
                time.sleep(REQUEST_DELAY)
    else:
        print("\nFailed to fetch the main notices list page. Cannot proceed.")

    if all_foreclosure_data:
        print(f"\n--- Scraping Complete ---")
        print(f"Total records processed: {len(all_foreclosure_data)}")
        df = pd.DataFrame(all_foreclosure_data)

        print("\n--- First 5 Rows of Scraped Data (sample) ---")
        # Displaying a subset of columns for brevity in console, full data in CSV
        columns_to_display = [
            'borrower_list', 'property_address_list', 'details_url', 
            'borrower_detail', 'address_detail', 'tdn_no', 'sale_details_text'
        ]
        # Filter columns that actually exist in the DataFrame to avoid KeyErrors
        existing_columns_to_display = [col for col in columns_to_display if col in df.columns]
        print(df[existing_columns_to_display].head().to_string())
        
        if 'sale_details_text' in df.columns and not df['sale_details_text'].empty:
             print(f"\n--- Example of Sale Details Text (first record with text) ---")
             first_sale_text = df[df['sale_details_text'].str.contains(r'\w', na=False)]['sale_details_text'].iloc[0] if not df[df['sale_details_text'].str.contains(r'\w', na=False)].empty else "No sale text found in processed records"
             print(first_sale_text[:500] + "..." if len(first_sale_text) > 500 else first_sale_text)


        try:
            csv_filename = "foreclosure_notices_tnledger_detailed.csv"
            df.to_csv(csv_filename, index=False, encoding='utf-8')
            print(f"\nData saved to {csv_filename}")
        except Exception as e:
            print(f"Error saving to CSV: {e}")
    else:
        print("\nNo data was scraped. Please check your parsing logic, selectors, or the website structure/availability.")

    print("\n--- End of Script ---")
