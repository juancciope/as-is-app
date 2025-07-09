const { Actor } = require('apify');
const { chromium } = require('playwright');

// Configuration
const SALES_URL = "https://sales.wilson-assoc.com/";
const SOURCE_WEBSITE_NAME = "sales.wilson-assoc.com";
const STATE_TO_SELECT = "TN"; // Tennessee
const TIMEOUT = 20000; // 20 seconds

// Helper function to get date range (next 30 days)
function getDateRange() {
    const today = new Date();
    const dateBegin = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const dateEnd = new Date(today);
    dateEnd.setDate(today.getDate() + 30);
    const dateEndStr = dateEnd.toISOString().split('T')[0];
    
    return { dateBegin, dateEnd: dateEndStr };
}

// Function to fetch sales data with Playwright automation
async function fetchSalesDataWithPlaywright() {
    console.log('Starting Wilson Associates scraper...');
    
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });
    
    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        viewport: { width: 1920, height: 1080 }
    });
    
    let salesData = [];
    
    try {
        console.log(`Navigating to: ${SALES_URL}`);
        await page.goto(SALES_URL, { waitUntil: 'networkidle', timeout: 60000 });
        
        // Wait for page to settle
        await page.waitForTimeout(3000);
        
        // 1. Click "I AGREE" button
        try {
            console.log('Looking for "I AGREE" button...');
            const agreeButton = await page.waitForSelector('#btnAgree', { timeout: TIMEOUT });
            await agreeButton.click();
            console.log('"I AGREE" button clicked. Waiting for sales page to load...');
            await page.waitForTimeout(5000);
        } catch (error) {
            console.log('I AGREE button not found or not clickable. Assuming already on sales page.');
        }
        
        // 2. Set Date Range (Next 30 days)
        console.log('Setting date range for the next 30 days...');
        const { dateBegin, dateEnd } = getDateRange();
        
        try {
            // Set begin date
            await page.waitForSelector('#txtRangeBegin', { timeout: TIMEOUT });
            await page.evaluate((date) => {
                document.getElementById('txtRangeBegin').value = date;
            }, dateBegin);
            console.log(`Set 'Date range begin' to: ${dateBegin}`);
            
            // Set end date
            await page.waitForSelector('#txtRangeEnd', { timeout: TIMEOUT });
            await page.evaluate((date) => {
                document.getElementById('txtRangeEnd').value = date;
            }, dateEnd);
            console.log(`Set 'Date range end' to: ${dateEnd}`);
            
            await page.waitForTimeout(1000);
        } catch (error) {
            console.error('Error setting date fields:', error);
            throw error;
        }
        
        // 3. Select State (Tennessee)
        try {
            console.log(`Selecting state: ${STATE_TO_SELECT}...`);
            await page.waitForSelector('#ddlState', { timeout: TIMEOUT });
            await page.selectOption('#ddlState', STATE_TO_SELECT);
            console.log(`State '${STATE_TO_SELECT}' selected.`);
            
            // Wait for potential page update after state selection
            console.log('Waiting for 5 seconds after state selection...');
            await page.waitForTimeout(5000);
        } catch (error) {
            console.error('Error selecting state:', error);
            throw error;
        }
        
        // 4. Click Search Button
        try {
            console.log('Clicking "Search" button...');
            const searchButton = await page.waitForSelector('#btnSearch', { timeout: TIMEOUT });
            await searchButton.click();
            console.log('"Search" button clicked.');
        } catch (error) {
            console.error('Error clicking search button:', error);
            throw error;
        }
        
        // 5. Wait for results table to load
        console.log('Waiting for results table to load...');
        try {
            await page.waitForSelector('#gvSales', { timeout: TIMEOUT + 10000 });
            console.log('Results table found.');
            
            // Wait for table to fully render
            await page.waitForTimeout(5000);
            
            // Extract sales data
            salesData = await page.evaluate(() => {
                const sales = [];
                const table = document.getElementById('gvSales');
                
                if (!table) {
                    console.log('Sales table not found');
                    return sales;
                }
                
                const tbody = table.querySelector('tbody');
                if (!tbody) {
                    console.log('Table body not found');
                    return sales;
                }
                
                const rows = tbody.querySelectorAll('tr');
                
                // Skip header row (first row)
                for (let i = 1; i < rows.length; i++) {
                    const cells = rows[i].querySelectorAll('td');
                    
                    if (cells.length === 10) {
                        const saleDate = cells[0].textContent.trim();
                        const saleTime = cells[1].textContent.trim();
                        const priorSaleDate = cells[2].textContent.trim();
                        const address = cells[3].textContent.trim();
                        const city = cells[4].textContent.trim();
                        const county = cells[5].textContent.trim();
                        const state = cells[6].textContent.trim();
                        const zipCode = cells[7].textContent.trim();
                        const location = cells[8].textContent.trim();
                        const auctioneer = cells[9].textContent.trim();
                        
                        sales.push({
                            SourceWebsite: 'sales.wilson-assoc.com',
                            SaleDate: saleDate,
                            SaleTime: saleTime,
                            PriorSaleDate: priorSaleDate,
                            PropertyAddress: address,
                            City: city,
                            County: county,
                            State: state,
                            ZipCode: zipCode,
                            SaleLocation: location,
                            Auctioneer: auctioneer,
                            scraped_at: new Date().toISOString()
                        });
                    } else if (cells.length === 1 && cells[0].getAttribute('colspan')) {
                        // Handle "no sales found" message
                        const message = cells[0].textContent.trim();
                        console.log(`Found message: ${message}`);
                    }
                }
                
                return sales;
            });
            
            console.log(`Successfully extracted ${salesData.length} sales entries`);
            
        } catch (error) {
            console.error('Error waiting for or parsing results table:', error);
            
            // Check if "no sales" message is present
            try {
                const noSalesMessage = await page.textContent('body');
                if (noSalesMessage.includes('Selected parameters returned no sales')) {
                    console.log('Found "Selected parameters returned no sales" message.');
                    salesData = [];
                } else {
                    throw error;
                }
            } catch (checkError) {
                console.error('Error checking for no sales message:', checkError);
                throw error;
            }
        }
        
    } catch (error) {
        console.error('Error during automation:', error);
        
        // Take screenshot for debugging
        try {
            const screenshot = await page.screenshot({ fullPage: true });
            await Actor.setValue('error-screenshot', screenshot, { contentType: 'image/png' });
            console.log('Error screenshot saved to key-value store');
        } catch (screenshotError) {
            console.error('Failed to take screenshot:', screenshotError);
        }
        
        throw error;
    } finally {
        await browser.close();
    }
    
    return salesData;
}

Actor.main(async () => {
    console.log('Starting Wilson Associates foreclosure scraper...');
    
    try {
        const salesData = await fetchSalesDataWithPlaywright();
        
        if (salesData.length > 0) {
            console.log(`Successfully scraped ${salesData.length} sales entries`);
            console.log('Sample data:', JSON.stringify(salesData[0], null, 2));
        } else {
            console.log('No sales data found for the specified criteria');
        }
        
        // Save to dataset
        await Actor.pushData(salesData);
        
        console.log('Wilson Associates scraper completed successfully');
        
    } catch (error) {
        console.error('Wilson Associates scraper failed:', error);
        throw error;
    }
});