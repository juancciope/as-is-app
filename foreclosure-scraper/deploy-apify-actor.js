#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Configuration
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_NAME = `clearrecon-scraper-${Date.now()}`;

if (!APIFY_API_TOKEN) {
  console.error('Please set APIFY_API_TOKEN environment variable');
  process.exit(1);
}

// Actor files content
const actorFiles = {
  '.actor/actor.json': {
    "actorSpecification": 1,
    "name": "clearrecon-scraper",
    "title": "ClearRecon Tennessee Foreclosure Scraper",
    "description": "Scrapes foreclosure auction data from ClearRecon Tennessee website",
    "version": "1.0",
    "dockerfile": "./Dockerfile"
  },
  
  
  'Dockerfile': `FROM apify/actor-python:3.11

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps

COPY . ./

CMD python3 main.py`,
  
  'requirements.txt': `apify
requests
beautifulsoup4
playwright`,
  
  'main.py': `import asyncio
from apify import Actor
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

# Configuration
LISTINGS_URL = "https://clearrecon-tn.com/tennessee-listings/"
SOURCE_WEBSITE_NAME = "clearrecon-tn.com"

async def main():
    async with Actor:
        Actor.log.info(f"Starting scraper for {SOURCE_WEBSITE_NAME}")

        async with async_playwright() as p:
            try:
                # Launch browser
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()
                
                # Set user agent
                await page.set_extra_http_headers({
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                })

                Actor.log.info(f"Navigating to URL: {LISTINGS_URL}")
                await page.goto(LISTINGS_URL, wait_until='networkidle')
                await page.wait_for_timeout(10000)  # Wait for initial load

                # Handle disclaimer
                try:
                    Actor.log.info("Looking for disclaimer 'Agree' button...")
                    agree_button = await page.wait_for_selector("//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'agree')]", timeout=10000)
                    if agree_button:
                        Actor.log.info("Found 'Agree' button, clicking...")
                        await agree_button.click()
                        await page.wait_for_timeout(10000)
                        Actor.log.info("Clicked disclaimer button")
                except Exception as e:
                    Actor.log.info(f"No disclaimer found or error clicking: {str(e)}")

                # Find table and set to show all entries
                try:
                    Actor.log.info("Finding table to get dynamic ID...")
                    table_element = await page.wait_for_selector(".posts-data-table", timeout=10000)
                    dynamic_table_id = await table_element.get_attribute("id")
                    
                    if dynamic_table_id:
                        Actor.log.info(f"Found dynamic table ID: {dynamic_table_id}")
                        
                        # Set dropdown to show all entries
                        select_name = f"{dynamic_table_id}_length"
                        Actor.log.info(f"Setting dropdown '{select_name}' to show all entries...")
                        
                        await page.evaluate(f"""
                            var sel = document.getElementsByName('{select_name}')[0];
                            if (sel) {{
                                sel.value = '-1';
                                sel.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }}
                        """)
                        
                        Actor.log.info("Set dropdown to 'All', waiting for table to update...")
                        await page.wait_for_timeout(15000)
                        
                except Exception as e:
                    Actor.log.warning(f"Could not find or interact with dropdown: {str(e)}")

                # Wait for data rows to load
                try:
                    Actor.log.info("Waiting for data rows to load...")
                    await page.wait_for_selector(".post-row", timeout=45000)
                    Actor.log.info("Data rows found, page fully loaded")
                    
                    # Additional wait to ensure all content is loaded
                    await page.wait_for_timeout(5000)
                    
                except Exception as e:
                    Actor.log.error(f"Data rows not found: {str(e)}")
                    # Log page content for debugging
                    content = await page.content()
                    Actor.log.info(f"Page content snippet: {content[:1000]}")
                    return

                # Get page content and parse
                html_content = await page.content()
                soup = BeautifulSoup(html_content, 'html.parser')

                # Parse the listings
                listings_table = soup.find('table', class_='posts-data-table')
                if not listings_table:
                    Actor.log.error("Could not find listings table")
                    # Try alternative selectors
                    all_tables = soup.find_all('table')
                    Actor.log.info(f"Found {len(all_tables)} total tables on page")
                    if all_tables:
                        Actor.log.info(f"Table classes: {[t.get('class', []) for t in all_tables[:3]]}")
                    return

                Actor.log.info("Found listings table, parsing data...")
                
                table_body = listings_table.find('tbody')
                if not table_body:
                    Actor.log.error("Could not find table body")
                    Actor.log.info(f"Table structure: {listings_table.prettify()[:500]}")
                    return

                rows = table_body.find_all('tr')
                if not rows:
                    Actor.log.error("No rows found in table")
                    Actor.log.info(f"Table body content: {table_body.prettify()[:500]}")
                    return

                Actor.log.info(f"Found {len(rows)} rows")

                scraped_count = 0
                for idx, row in enumerate(rows):
                    # Skip header rows
                    if row.find('th'):
                        continue

                    cells = row.find_all('td')
                    if len(cells) == 4:
                        try:
                            listing_data = {
                                'SourceWebsite': SOURCE_WEBSITE_NAME,
                                'TS_Number': cells[0].get_text(strip=True),
                                'PropertyAddress': cells[1].get_text(strip=True),
                                'SaleDate': cells[2].get_text(strip=True),
                                'CurrentBid': cells[3].get_text(strip=True)
                            }

                            # Only add if we have actual data
                            if listing_data['TS_Number'] and listing_data['PropertyAddress']:
                                await Actor.push_data(listing_data)
                                scraped_count += 1
                                Actor.log.info(f"Scraped listing: {listing_data['TS_Number']}")
                            else:
                                Actor.log.debug(f"Skipping empty row {idx}")

                        except Exception as e:
                            Actor.log.error(f"Error parsing row {idx}: {str(e)}")
                            continue
                    else:
                        if any(c.get_text(strip=True) for c in cells):
                            Actor.log.debug(f"Row {idx} has {len(cells)} cells, expected 4")

                Actor.log.info(f"Successfully scraped {scraped_count} listings")

                if scraped_count == 0:
                    Actor.log.warning("No listing data was scraped - check if website structure changed")

                await browser.close()

            except Exception as e:
                Actor.log.error(f"Error during scraping: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())`
};

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: body });
        }
      });
    });
    
    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function deployActor() {
  try {
    console.log('🚀 Starting actor deployment...');
    
    // Step 1: Create or update actor
    console.log('📝 Creating/updating actor...');
    const createActorOptions = {
      hostname: 'api.apify.com',
      port: 443,
      path: `/v2/acts?token=${APIFY_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const actorData = {
      name: ACTOR_NAME,
      title: 'Phillip Jones Law Foreclosure Scraper',
      description: 'Scrapes foreclosure auction data from Phillip Jones Law website',
      isPublic: false, // Create as private first
      seoTitle: 'Phillip Jones Law Foreclosure Scraper',
      seoDescription: 'Scrapes foreclosure auction data from Phillip Jones Law website',
      categories: ['ECOMMERCE']
    };

    const createResponse = await makeRequest(createActorOptions, actorData);
    
    let actorId;
    if (createResponse.statusCode === 201) {
      console.log('✅ Actor created successfully');
      actorId = createResponse.body.data.id;
    } else if (createResponse.statusCode === 400 && createResponse.body.error?.type === 'duplicate-value') {
      console.log('ℹ️  Actor already exists, will update it');
      actorId = ACTOR_NAME; // Use the name as ID for existing actors
    } else {
      console.error('❌ Failed to create actor:', createResponse.body);
      return;
    }

    // Step 2: Upload source code
    console.log('📦 Uploading source code...');
    
    const uploadOptions = {
      hostname: 'api.apify.com',
      port: 443,
      path: `/v2/acts/${actorId}/versions?token=${APIFY_API_TOKEN}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const sourceFiles = [];
    for (const [fileName, content] of Object.entries(actorFiles)) {
      sourceFiles.push({
        name: fileName,
        content: typeof content === 'string' ? content : JSON.stringify(content, null, 2)
      });
    }

    const versionData = {
      versionNumber: '1.0',
      sourceType: 'SOURCE_FILES',
      sourceFiles: sourceFiles,
      buildTag: 'latest'
    };

    const uploadResponse = await makeRequest(uploadOptions, versionData);
    
    if (uploadResponse.statusCode === 201) {
      console.log('✅ Source code uploaded successfully');
      console.log('🔨 Building actor...');
      
      const buildId = uploadResponse.body.data.buildId;
      
      // Step 3: Wait for build to complete
      let buildStatus = 'RUNNING';
      while (buildStatus === 'RUNNING') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        const buildOptions = {
          hostname: 'api.apify.com',
          port: 443,
          path: `/v2/acts/${actorId}/builds/${buildId}?token=${APIFY_API_TOKEN}`,
          method: 'GET'
        };
        
        const buildResponse = await makeRequest(buildOptions);
        buildStatus = buildResponse.body.data.status;
        console.log(`📊 Build status: ${buildStatus}`);
      }
      
      if (buildStatus === 'SUCCEEDED') {
        console.log('✅ Build succeeded! Publishing actor...');
        
        // Step 4: Publish the actor to make it public
        const publishOptions = {
          hostname: 'api.apify.com',
          port: 443,
          path: `/v2/acts/${actorId}/publication?token=${APIFY_API_TOKEN}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        };
        
        const publishData = {
          versionNumber: '1.0'
        };
        
        const publishResponse = await makeRequest(publishOptions, publishData);
        
        if (publishResponse.statusCode === 201) {
          console.log('🎉 Actor deployed and published successfully!');
          console.log(`🔗 Actor URL: https://apify.com/${uploadResponse.body.data.username}/${ACTOR_NAME}`);
          console.log(`📋 Actor ID: ${uploadResponse.body.data.username}/${ACTOR_NAME}`);
        } else {
          console.log('⚠️  Actor deployed but failed to publish:', publishResponse.body);
          console.log(`📋 Actor ID (private): ${uploadResponse.body.data.username}/${ACTOR_NAME}`);
        }
      } else {
        console.error('❌ Build failed:', buildStatus);
      }
    } else {
      console.error('❌ Failed to upload source code:', uploadResponse.body);
    }

  } catch (error) {
    console.error('❌ Deployment failed:', error);
  }
}

deployActor();