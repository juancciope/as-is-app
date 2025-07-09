#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

// Configuration
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const ACTOR_NAME = `pj-foreclosure-scraper-${Date.now()}`;

if (!APIFY_API_TOKEN) {
  console.error('Please set APIFY_API_TOKEN environment variable');
  process.exit(1);
}

// Actor files content
const actorFiles = {
  '.actor/actor.json': {
    "actorSpecification": 1,
    "name": "phillipjoneslaw-scraper",
    "title": "Phillip Jones Law Foreclosure Scraper",
    "description": "Scrapes foreclosure auction data from Phillip Jones Law website",
    "version": "1.0",
    "dockerfile": "./Dockerfile"
  },
  
  
  'Dockerfile': `FROM apify/actor-python:3.11

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./

CMD python3 main.py`,
  
  'requirements.txt': `apify
requests
beautifulsoup4`,
  
  'main.py': `import asyncio
from apify import Actor
import requests
from bs4 import BeautifulSoup

# Configuration
AUCTION_URL = "https://phillipjoneslaw.com/foreclosure-auctions.cfm?accept=yes"
SOURCE_WEBSITE_NAME = "phillipjoneslaw.com"

async def main():
    async with Actor:
        Actor.log.info(f"Starting scraper for {SOURCE_WEBSITE_NAME}")

        # Fetch the page
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive'
        }

        try:
            Actor.log.info(f"Fetching URL: {AUCTION_URL}")
            response = requests.get(AUCTION_URL, headers=headers, timeout=30)
            response.raise_for_status()
            Actor.log.info(f"Successfully fetched page (Status: {response.status_code})")

            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')

            # Find the auction table
            auction_table = soup.find('table', id='auctionTbl')
            if not auction_table:
                Actor.log.warning("Could not find auction table with id='auctionTbl'")
                # Try alternative selectors
                auction_table = soup.find('table', class_='auction-table')
                if not auction_table:
                    Actor.log.error("Could not find any auction table")
                    return

            Actor.log.info("Found auction table, parsing rows...")

            # Find table body or use table directly
            table_body = auction_table.find('tbody')
            if not table_body:
                table_body = auction_table

            rows = table_body.find_all('tr')

            if not rows:
                Actor.log.error("No rows found in table")
                return

            Actor.log.info(f"Found {len(rows)} rows")

            scraped_count = 0
            for idx, row in enumerate(rows):
                cells = row.find_all(['td', 'th'])

                # Skip header rows
                if cells and cells[0].name == 'th':
                    Actor.log.info(f"Skipping header row {idx}")
                    continue

                if len(cells) == 6:
                    try:
                        auction_data = {
                            'SourceWebsite': SOURCE_WEBSITE_NAME,
                            'CaseNumber': cells[0].get_text(strip=True),
                            'PropertyAddress': cells[1].get_text(strip=True),
                            'County': cells[2].get_text(strip=True),
                            'SaleDate': cells[3].get_text(strip=True),
                            'SaleTime': cells[4].get_text(strip=True),
                            'Status': cells[5].get_text(strip=True)
                        }

                        # Only add if we have actual data
                        if auction_data['CaseNumber'] and auction_data['PropertyAddress']:
                            await Actor.push_data(auction_data)
                            scraped_count += 1
                            Actor.log.info(f"Scraped auction: {auction_data['CaseNumber']}")
                        else:
                            Actor.log.info(f"Skipping empty row {idx}")

                    except Exception as e:
                        Actor.log.error(f"Error parsing row {idx}: {str(e)}")
                        continue
                else:
                    Actor.log.debug(f"Row {idx} has {len(cells)} cells, expected 6")

            Actor.log.info(f"Successfully scraped {scraped_count} auctions")

            if scraped_count == 0:
                Actor.log.warning("No auction data was scraped - check if website structure changed")

        except requests.RequestException as e:
            Actor.log.error(f"Request error: {str(e)}")
        except Exception as e:
            Actor.log.error(f"Unexpected error during scraping: {str(e)}")

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