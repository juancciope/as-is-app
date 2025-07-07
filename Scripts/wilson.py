import time
import pandas as pd
import os
from datetime import datetime, timedelta

# --- Selenium Imports ---
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementNotInteractableException

# --- Configuration ---
SALES_URL = "https://sales.wilson-assoc.com/"
CSV_OUTPUT_FILENAME = "wilson_assoc_foreclosures.csv"
SOURCE_WEBSITE_NAME = "sales.wilson-assoc.com"
SELENIUM_TIMEOUT = 20  # Timeout for waiting for elements
STATE_TO_SELECT = "TN" # For Tennessee

# --- Helper Function to Fetch Page Content using Selenium ---
def fetch_sales_data_with_selenium(url):
    """
    Automates interactions to fetch sales data:
    1. Agrees to terms.
    2. Sets date range (next 30 days).
    3. Selects state.
    4. Clicks search.
    5. Waits for and returns the HTML of the results table.
    """
    html_content = None
    chrome_options = webdriver.ChromeOptions()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("window-size=1920x1080")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")

    driver = None
    try:
        print("Initializing Selenium WebDriver for Chrome...")
        driver = webdriver.Chrome(service=ChromeService(ChromeDriverManager().install()), options=chrome_options)
        driver.set_page_load_timeout(60)

        print(f"Navigating to URL: {url}")
        driver.get(url)
        time.sleep(3) # Allow initial page elements to settle

        # 1. Click "I AGREE" button
        try:
            print("Looking for 'I AGREE' button...")
            # The button seems to be <input type="submit" name="btnAgree" value="I AGREE" id="btnAgree">
            agree_button = WebDriverWait(driver, SELENIUM_TIMEOUT).until(
                EC.element_to_be_clickable((By.ID, "btnAgree"))
            )
            agree_button.click()
            print("'I AGREE' button clicked. Waiting for sales page to load...")
            time.sleep(5) # Wait for the next page to load
        except TimeoutException:
            print("'I AGREE' button not found or not clickable within timeout. Assuming already on sales page or page structure changed.")
        except Exception as e_agree:
            print(f"Error clicking 'I AGREE' button: {e_agree}")
            # Continue, as it might already be on the sales page if run before

        # 2. Set Date Range (Next 30 days)
        print("Setting date range for the next 30 days...")
        today = datetime.now()
        date_begin_str = today.strftime("%Y-%m-%d")
        date_end = today + timedelta(days=30)
        date_end_str = date_end.strftime("%Y-%m-%d")

        try:
            # These are <input type="date">, so we can send keys or use JS
            # Using JavaScript to set date is often more reliable for date inputs
            date_begin_input = WebDriverWait(driver, SELENIUM_TIMEOUT).until(
                EC.presence_of_element_located((By.ID, "txtRangeBegin"))
            )
            driver.execute_script(f"arguments[0].value = '{date_begin_str}';", date_begin_input)
            print(f"Set 'Date range begin' to: {date_begin_str}")

            date_end_input = WebDriverWait(driver, SELENIUM_TIMEOUT).until(
                EC.presence_of_element_located((By.ID, "txtRangeEnd"))
            )
            driver.execute_script(f"arguments[0].value = '{date_end_str}';", date_end_input)
            print(f"Set 'Date range end' to: {date_end_str}")
            time.sleep(1) # Brief pause after setting dates
        except TimeoutException:
            print("Could not find date input fields.")
            raise # Re-raise to stop if essential filters can't be set
        except Exception as e_date:
            print(f"Error setting date fields: {e_date}")
            raise

        # 3. Select State (Tennessee)
        try:
            print(f"Selecting state: {STATE_TO_SELECT}...")
            state_dropdown_element = WebDriverWait(driver, SELENIUM_TIMEOUT).until(
                EC.presence_of_element_located((By.ID, "ddlState"))
            )
            select_state = Select(state_dropdown_element)
            select_state.select_by_value(STATE_TO_SELECT)
            print(f"State '{STATE_TO_SELECT}' selected.")
            # This site uses __doPostBack on state change, so wait for potential partial reload
            print("Waiting for 5 seconds after state selection for potential page update...")
            time.sleep(5) 
        except TimeoutException:
            print("Could not find state dropdown.")
            raise
        except Exception as e_state:
            print(f"Error selecting state: {e_state}")
            raise

        # 4. Click Search Button
        try:
            print("Clicking 'Search' button...")
            search_button = WebDriverWait(driver, SELENIUM_TIMEOUT).until(
                EC.element_to_be_clickable((By.ID, "btnSearch"))
            )
            search_button.click()
            print("'Search' button clicked.")
        except TimeoutException:
            print("Search button not found or not clickable.")
            raise
        except Exception as e_search:
            print(f"Error clicking search button: {e_search}")
            raise

        # 5. Wait for the results table to be present
        print("Waiting for results table (id='gvSales') to load...")
        WebDriverWait(driver, SELENIUM_TIMEOUT + 10).until( # Slightly longer wait for results
            EC.presence_of_element_located((By.ID, "gvSales"))
        )
        print("Results table 'gvSales' found.")
        
        # It's good to wait a bit more for all table rows to render if it's a large table
        time.sleep(5) 
        html_content = driver.page_source
        print("Successfully fetched page content with sales data.")

    except TimeoutException as te:
        print(f"TimeoutException during automation: {te}")
        if driver:
            print("\n--- Page Source at Timeout (current context, first 5000 chars) ---")
            try:
                print(driver.page_source[:5000])
            except Exception as page_source_error:
                print(f"Could not get page source after timeout: {page_source_error}")
            print("--- End of Page Source Snippet ---")
    except Exception as e:
        print(f"An error occurred during Selenium operations: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            print("Closing Selenium WebDriver.")
            driver.quit()
            
    return html_content

# --- Function to Parse the Sales Data Table ---
def parse_sales_data(html_content):
    """
    Parses the HTML content to extract sales data from the table.
    """
    if not html_content:
        print("HTML content is empty, cannot parse.")
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    sales_list = []

    sales_table = soup.find('table', id='gvSales')
    if not sales_table:
        print("Could not find the sales table with id='gvSales'.")
        # Check if the "no sales" message is present
        no_sales_message = soup.find(text=lambda t: "Selected parameters returned no sales" in t if t else False)
        if no_sales_message:
            print("Found 'Selected parameters returned no sales' message. No data to parse.")
        else:
            print("Sales table not found, and no 'no sales' message detected. HTML structure might have changed.")
            # print(f"HTML snippet (first 2000 chars): {html_content[:2000]}") # For debugging
        return sales_list

    print("Successfully found sales table with id='gvSales'.")

    table_body = sales_table.find('tbody')
    if not table_body:
        print("Could not find tbody within the sales table.")
        return sales_list
    
    rows = table_body.find_all('tr')

    if not rows or len(rows) <= 1: # First row is header
        print("No data rows found in the sales table.")
        return sales_list

    # Column headers from the HTML: Date, Time, Prior Sale Date, Address, City, County, State, Zip, Location, Auctioneer
    # Skip header row (index 0)
    for row_index, row in enumerate(rows[1:], start=1):
        cells = row.find_all('td')
        
        if len(cells) == 10: # Expecting 10 columns
            try:
                sale_date = cells[0].text.strip()
                sale_time = cells[1].text.strip()
                prior_sale_date = cells[2].text.strip()
                address = cells[3].text.strip()
                city = cells[4].text.strip()
                county = cells[5].text.strip()
                state = cells[6].text.strip()
                zip_code = cells[7].text.strip()
                location = cells[8].text.strip()
                auctioneer = cells[9].text.strip()

                sales_list.append({
                    'SourceWebsite': SOURCE_WEBSITE_NAME,
                    'SaleDate': sale_date,
                    'SaleTime': sale_time,
                    'PriorSaleDate': prior_sale_date,
                    'PropertyAddress': address, # Using a common name
                    'City': city,
                    'County': county,
                    'State': state,
                    'ZipCode': zip_code,
                    'SaleLocation': location, # Using a more descriptive name
                    'Auctioneer': auctioneer
                })
            except Exception as e:
                print(f"Row {row_index}: Error parsing row. Details: {e}. Row content: {row.get_text(strip=True, separator='|')}")
                continue
        else:
            # Check for "colspan" message like "No sales found for this criteria"
            if len(cells) == 1 and cells[0].get('colspan'):
                message = cells[0].text.strip()
                print(f"Found a single cell row (likely a message): {message}")
            else:
                print(f"Row {row_index}: Skipping row, expected 10 cells, got {len(cells)}. Content: {row.get_text(strip=True, separator='|')}")
            
    return sales_list

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Scraper for {SOURCE_WEBSITE_NAME} ---")
    
    html_content_selenium = fetch_sales_data_with_selenium(SALES_URL)
    
    if html_content_selenium:
        print("\n--- Parsing Sales Data (from Selenium-fetched content) ---")
        sales_entries = parse_sales_data(html_content_selenium)
        print(f"Found {len(sales_entries)} sales entries.")
        
        if sales_entries:
            df = pd.DataFrame(sales_entries)
            
            print(f"\n--- First 5 Sales Entries ---")
            print(df.head().to_string())
            
            try:
                df.to_csv(CSV_OUTPUT_FILENAME, index=False, encoding='utf-8')
                print(f"\nData successfully saved to {CSV_OUTPUT_FILENAME}")
            except Exception as e:
                print(f"Error saving data to CSV: {e}")
        else:
            print("No sales data was extracted.")
    else:
        print("Failed to fetch HTML content using Selenium. Scraper cannot proceed.")
        
    print(f"\n--- End of Scraper for {SOURCE_WEBSITE_NAME} ---")
