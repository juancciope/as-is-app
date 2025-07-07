import time
import pandas as pd
import os

# --- Selenium Imports ---
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementNotInteractableException

# --- Configuration ---
LISTINGS_URL = "https://clearrecon-tn.com/tennessee-listings/"
CSV_OUTPUT_FILENAME = "clearrecon_tn_foreclosures.csv"
SOURCE_WEBSITE_NAME = "clearrecon-tn.com"
SELENIUM_TIMEOUT = 30  # Timeout for waiting for elements

# --- Helper Function to Fetch Page Content using Selenium ---
def fetch_page_with_selenium(url):
    """
    Fetches the full HTML content of a given URL using Selenium.
    This version handles the disclaimer and dynamically finds controls to select "All" entries per page.
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
        time.sleep(5) # Initial wait for the page to start loading scripts

        # 1. Handle Disclaimer
        try:
            agree_button_xpath = "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'agree')]"
            agree_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, agree_button_xpath))
            )
            print("Found 'Agree' disclaimer button. Clicking via JavaScript...")
            driver.execute_script("arguments[0].click();", agree_button)
            print("Clicked disclaimer. Waiting for page to transition...")
            time.sleep(5)
        except TimeoutException:
            print("Disclaimer 'Agree' button not found. Assuming page is already loaded.")
        except Exception as e_agree:
            print(f"An error occurred while handling the disclaimer: {e_agree}")

        # 2. Dynamically find table ID and set "Show All" Entries
        try:
            print("Finding table by stable class name 'posts-data-table' to get its dynamic ID...")
            table_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "posts-data-table"))
            )
            dynamic_table_id = table_element.get_attribute("id")
            if not dynamic_table_id:
                raise Exception("Could not retrieve the dynamic ID from the table element.")
            print(f"Found dynamic table ID: {dynamic_table_id}")
            
            # Construct the dynamic name for the <select> element
            native_select_name = f"{dynamic_table_id}_length"
            
            print(f"Attempting to set native select '{native_select_name}' value to -1 (All) via JS...")
            
            # Wait for the select element to be present
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, native_select_name))
            )
            # Use JavaScript to set the value to '-1' (for 'All') and trigger the 'change' event
            driver.execute_script(f"var sel = document.getElementsByName('{native_select_name}')[0]; if(sel) {{ sel.value = '-1'; sel.dispatchEvent(new Event('change', {{ bubbles: true }})); }}")
            
            print("Set 'All' via JavaScript. Waiting for table to update...")
            time.sleep(7) # Wait for the DataTables library to reload the table with all entries

        except (TimeoutException, NoSuchElementException, ElementNotInteractableException) as e_select:
            print(f"Could not find and interact with 'Show X per page' dropdown: {e_select}")
            print("Proceeding with default number of entries per page.")
        except Exception as e_dynamic:
            print(f"An error occurred during the dynamic dropdown interaction: {e_dynamic}")

        # 3. Wait for the table data to be present
        print("Waiting for data rows to be loaded...")
        WebDriverWait(driver, SELENIUM_TIMEOUT).until(
            EC.presence_of_element_located((By.CLASS_NAME, "post-row"))
        )
        print("Data rows found. Page should be fully rendered.")
        
        html_content = driver.page_source
        print("Successfully fetched page content using Selenium.")
        
    except TimeoutException:
        print(f"TimeoutException: Table content (class='post-row') did not appear within {SELENIUM_TIMEOUT} seconds.")
        if driver:
            print("\n--- Page Source at Timeout (first 5000 chars) ---")
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

# --- Function to Parse the Listings Data Table ---
def parse_listings_data(html_content):
    """
    Parses the HTML content to extract listing data from the table.
    """
    if not html_content:
        print("HTML content is empty, cannot parse.")
        return []

    soup = BeautifulSoup(html_content, 'html.parser')
    listings_list = []

    listings_table = soup.find('table', class_='posts-data-table')
    if not listings_table:
        print("Could not find the listings table with class='posts-data-table'.")
        return listings_list
    
    print("Successfully found table with class='posts-data-table'.")

    table_body = listings_table.find('tbody')
    if not table_body:
        print("Could not find the tbody within the listings table.")
        return listings_list
    
    rows = table_body.find_all('tr') # Get all rows

    if not rows:
        print("No <tr> data rows found in the table body.")
        return listings_list

    for row_index, row in enumerate(rows, start=1):
        if row.find('th'): # Skip header rows if they are inside tbody
            continue

        cells = row.find_all('td')
        if len(cells) == 4:
            try:
                ts_number = cells[0].text.strip()
                address = cells[1].text.strip()
                sale_date = cells[2].text.strip()
                current_bid = cells[3].text.strip()

                listings_list.append({
                    'SourceWebsite': SOURCE_WEBSITE_NAME,
                    'TS_Number': ts_number,
                    'PropertyAddress': address,
                    'SaleDate': sale_date,
                    'CurrentBid': current_bid
                })
            except Exception as e:
                print(f"Row {row_index}: Error parsing row. Details: {e}. Row content: {row.get_text(strip=True, separator='|')}")
        else:
            if any(c.text.strip() for c in cells):
                print(f"Row {row_index}: Skipping row, expected 4 cells, got {len(cells)}. Content: {row.get_text(strip=True, separator='|')}")
            
    return listings_list

# --- Main Script Logic ---
if __name__ == "__main__":
    print(f"--- Starting Scraper for {SOURCE_WEBSITE_NAME} ---")
    
    html_content_selenium = fetch_page_with_selenium(LISTINGS_URL)
    
    if html_content_selenium:
        print("\n--- Parsing Listings Data (from Selenium-fetched content) ---")
        listings = parse_listings_data(html_content_selenium)
        print(f"Found {len(listings)} listing entries.")
        
        if listings:
            df = pd.DataFrame(listings)
            
            print(f"\n--- First 5 Listing Entries ---")
            print(df.head().to_string())
            
            try:
                df.to_csv(CSV_OUTPUT_FILENAME, index=False, encoding='utf-8')
                print(f"\nData successfully saved to {CSV_OUTPUT_FILENAME}")
            except Exception as e:
                print(f"Error saving data to CSV: {e}")
        else:
            print("No listing data was extracted.")
    else:
        print("Failed to fetch HTML content using Selenium. Scraper cannot proceed.")
        
    print(f"\n--- End of Scraper for {SOURCE_WEBSITE_NAME} ---")
