const { Actor, PlaywrightCrawler } = require('apify');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

// Function to parse auction details from sale_details_text
function parseAuctionDetails(saleDetailsText) {
    const details = {
        auction_time: null,
        auction_location: null,
        auction_address: null
    };
    
    if (!saleDetailsText || saleDetailsText === 'Sale details text not found') {
        return details;
    }
    
    // Split into lines for easier parsing
    const lines = saleDetailsText.split('\n').map(line => line.trim()).filter(line => line);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for time patterns (e.g., "10:00 AM", "2:00 P.M.")
        const timeMatch = line.match(/\b(\d{1,2}:\d{2}\s*[AP]\.?M\.?)\b/i);
        if (timeMatch && !details.auction_time) {
            details.auction_time = timeMatch[1];
        }
        
        // Look for location keywords
        if (line.toLowerCase().includes('courthouse') || 
            line.toLowerCase().includes('door') || 
            line.toLowerCase().includes('steps') ||
            line.toLowerCase().includes('entrance')) {
            details.auction_location = line;
            
            // Try to extract address from next lines
            if (i + 1 < lines.length && lines[i + 1].match(/\d+\s+\w+/)) {
                details.auction_address = lines[i + 1];
            }
        }
        
        // Look for specific address patterns
        if (line.match(/^\d+\s+[\w\s]+(?:street|st|avenue|ave|road|rd|drive|dr|court|ct|circle|cir|boulevard|blvd)/i)) {
            if (!details.auction_address) {
                details.auction_address = line;
            }
        }
    }
    
    return details;
}

// Function to geocode an address
async function geocodeAddress(address, googleMapsApiKey) {
    if (!address || !googleMapsApiKey) return null;
    
    try {
        const encodedAddress = encodeURIComponent(address);
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleMapsApiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const result = data.results[0];
            return {
                lat: result.geometry.location.lat,
                lng: result.geometry.location.lng,
                formatted_address: result.formatted_address,
                place_id: result.place_id
            };
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    
    return null;
}

Actor.main(async () => {
    const input = await Actor.getInput();
    
    console.log('Starting TN Ledger scraper...');
    
    // Extract configuration from input
    const {
        noticesDate,
        supabaseUrl,
        supabaseAnonKey,
        googleMapsApiKey,
        tableName = 'tn_ledger_foreclosures'
    } = input || {};
    
    // Initialize Supabase client if credentials provided
    let supabase = null;
    if (supabaseUrl && supabaseAnonKey) {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
        console.log('Supabase client initialized');
    }
    
    // Function to get the correct Friday date for TN Ledger scraping
    const getTargetFridayDate = () => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        
        let targetDate;
        
        if (dayOfWeek === 5) {
            // If today is Friday, use today's date
            targetDate = new Date(today);
        } else if (dayOfWeek === 6) {
            // If today is Saturday, use yesterday (Friday)
            targetDate = new Date(today);
            targetDate.setDate(today.getDate() - 1);
        } else {
            // For Sunday through Thursday, use the most recent Friday
            const daysToSubtract = dayOfWeek === 0 ? 2 : dayOfWeek + 2;
            targetDate = new Date(today);
            targetDate.setDate(today.getDate() - daysToSubtract);
        }
        
        // Format as M/D/YYYY (e.g., "7/4/2025")
        const month = targetDate.getMonth() + 1;
        const day = targetDate.getDate();
        const year = targetDate.getFullYear();
        
        return `${month}/${day}/${year}`;
    };
    
    // Get the target date
    const targetDate = input?.noticesDate || getTargetFridayDate();
    console.log('Target notices date:', targetDate);
    
    const browser = await chromium.launch({
        headless: true,
    });
    
    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    // Listen to console logs from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    const BASE_URL = 'https://tnledger.com';
    const NOTICES_LIST_URL = `https://tnledger.com/Notices.aspx?noticesDate=${encodeURIComponent(targetDate)}`;
    
    try {
        console.log('Navigating to:', NOTICES_LIST_URL);
        await page.goto(NOTICES_LIST_URL, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Take a screenshot for debugging
        const screenshot = await page.screenshot({ fullPage: true });
        await Actor.setValue('debug-screenshot', screenshot, { contentType: 'image/png' });
        console.log('Screenshot saved to key-value store');
        
        // Wait for the table to load
        try {
            await page.waitForSelector('#ContentPane_ForeclosureGridView', { timeout: 15000 });
            console.log('Foreclosure grid found');
            
            // Wait a bit more for content to fully load
            console.log('Waiting for content to load...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error) {
            console.log('Foreclosure grid not found, checking page content...');
            const pageContent = await page.content();
            console.log('Page title:', await page.title());
            
            // Check for any error messages or alternate selectors
            const bodyText = await page.evaluate(() => document.body.innerText);
            console.log('Page text snippet:', bodyText.substring(0, 500));
        }
        
        // Extract notice list data
        const noticeListData = await page.evaluate(() => {
            const notices = [];
            
            // Debug: Log all tables on the page
            const allTables = document.querySelectorAll('table');
            console.log(`Found ${allTables.length} tables on the page`);
            
            // Debug: Log all elements with IDs containing 'Foreclosure'
            const foreclosureElements = document.querySelectorAll('[id*="Foreclosure"]');
            console.log(`Found ${foreclosureElements.length} elements with 'Foreclosure' in ID`);
            foreclosureElements.forEach(el => console.log('Foreclosure element ID:', el.id));
            
            // Debug: Check for GridView elements
            const gridViews = document.querySelectorAll('[id*="GridView"]');
            console.log(`Found ${gridViews.length} GridView elements`);
            gridViews.forEach(el => console.log('GridView ID:', el.id));
            
            const table = document.querySelector('#ContentPane_ForeclosureGridView');
            
            if (!table) {
                console.log('Foreclosure table not found');
                return notices;
            }
            
            // First try tbody tr, if empty try all tr elements
            let rows = table.querySelectorAll('tbody tr');
            if (rows.length === 0) {
                rows = table.querySelectorAll('tr');
                console.log('Using all tr elements since tbody is empty');
            }
            console.log(`Found ${rows.length} table rows`);
            
            // Debug: Check table structure
            if (rows.length > 0) {
                console.log('First row HTML:', rows[0].innerHTML.substring(0, 300));
                if (rows.length > 1) {
                    console.log('Second row HTML:', rows[1].innerHTML.substring(0, 300));
                }
            }
            
            for (let i = 1; i < rows.length; i++) { // Skip header row
                const cells = rows[i].querySelectorAll('td');
                console.log(`Row ${i} - Number of cells: ${cells.length}`);
                
                if (cells.length >= 5) {
                    const linkElement = cells[0].querySelector('a');
                    let detailsUrl = null;
                    
                    if (linkElement) {
                        // Check onclick attribute as well as href
                        const onclick = linkElement.getAttribute('onclick');
                        const href = linkElement.getAttribute('href');
                        console.log(`Row ${i} - Link onclick:`, onclick);
                        console.log(`Row ${i} - Link href:`, href);
                        
                        // Try to extract from onclick or href
                        const jsString = onclick || href || '';
                        const match = jsString.match(/OpenChildFT2\('([^']+)','([^']+)'\)/);
                        if (match) {
                            const noticeId = match[1];
                            const encodedDate = match[2];
                            const noticeDate = decodeURIComponent(encodedDate);
                            detailsUrl = `https://tnledger.com/Search/Details/ViewNotice.aspx?id=${noticeId}&date=${noticeDate}`;
                            console.log(`Row ${i} - Extracted URL:`, detailsUrl);
                        } else {
                            console.log(`Row ${i} - Could not extract URL from:`, jsString);
                        }
                    } else {
                        console.log(`Row ${i} - No link found in first cell`);
                    }
                    
                    if (detailsUrl) {
                        const borrower = cells[1].textContent.trim();
                        const propertyAddress = cells[2].textContent.trim();
                        const auctionDate = cells[3].textContent.trim();
                        const firstNoticeDate = cells[4].textContent.trim();
                        
                        notices.push({
                            borrower_list: borrower,
                            property_address_list: propertyAddress,
                            advertised_auction_date_list: auctionDate,
                            date_of_first_notice_list: firstNoticeDate,
                            details_url: detailsUrl
                        });
                    }
                }
            }
            
            return notices;
        });
        
        console.log(`Found ${noticeListData.length} notices on list page`);
        
        if (noticeListData.length === 0) {
            console.log('No notices found. This might be because:');
            console.log('1. No foreclosure notices for this date');
            console.log('2. The date format is incorrect');
            console.log('3. The page structure has changed');
            
            await Actor.pushData([]);
            return;
        }
        
        // Process each notice detail page
        const allNotices = [];
        
        for (let i = 0; i < noticeListData.length; i++) {
            const notice = noticeListData[i];
            console.log(`Processing notice ${i + 1}/${noticeListData.length}: ${notice.borrower_list}`);
            
            try {
                await page.goto(notice.details_url, { waitUntil: 'networkidle', timeout: 30000 });
                await page.waitForSelector('#record-details', { timeout: 15000 });
                
                const detailData = await page.evaluate(() => {
                    const details = {};
                    const recordDiv = document.querySelector('#record-details');
                    
                    if (!recordDiv) {
                        return { error: 'Record details div not found' };
                    }
                    
                    // Helper function to get span text by ID
                    const getSpanText = (id) => {
                        const span = recordDiv.querySelector(`#${id}`);
                        return span ? span.textContent.trim() : 'Not found';
                    };
                    
                    details.borrower_detail = getSpanText('lbl1');
                    
                    // Combine address parts
                    const addressPart1 = getSpanText('lbl2');
                    const addressPart2 = getSpanText('lbl3');
                    const fullAddress = [];
                    if (addressPart1 && addressPart1 !== 'Not found') fullAddress.push(addressPart1);
                    if (addressPart2 && addressPart2 !== 'Not found') fullAddress.push(addressPart2);
                    details.address_detail = fullAddress.join(' ') || 'Not found';
                    
                    details.original_trustee = getSpanText('lbl4');
                    details.attorney = getSpanText('lbl5');
                    details.instrument_no = getSpanText('lbl6');
                    details.substitute_trustee = getSpanText('lbl7');
                    details.advertised_auction_date_detail = getSpanText('lbl8');
                    details.date_of_first_public_notice_detail = getSpanText('lbl9');
                    details.trust_date = getSpanText('lbl10');
                    details.tdn_no = getSpanText('lbl11');
                    
                    // Extract sale details text from p tags after pnlSummary
                    const saleDetailsText = [];
                    const pnlSummary = recordDiv.querySelector('#pnlSummary');
                    if (pnlSummary) {
                        let currentElement = pnlSummary.nextElementSibling;
                        while (currentElement) {
                            if (currentElement.tagName === 'P') {
                                saleDetailsText.push(currentElement.textContent.trim());
                            }
                            currentElement = currentElement.nextElementSibling;
                        }
                    }
                    
                    details.sale_details_text = saleDetailsText.length > 0 
                        ? saleDetailsText.join('\\n\\n') 
                        : 'Sale details text not found';
                    
                    return details;
                });
                
                // Combine list and detail data
                const combinedData = { ...notice, ...detailData };
                
                // Parse auction details from sale_details_text
                const auctionDetails = parseAuctionDetails(combinedData.sale_details_text);
                combinedData.auction_time = auctionDetails.auction_time;
                combinedData.auction_location = auctionDetails.auction_location;
                combinedData.auction_address = auctionDetails.auction_address;
                
                // Add geolocation if Google Maps API key is provided
                if (googleMapsApiKey) {
                    // Geocode property address
                    const propertyGeo = await geocodeAddress(combinedData.address_detail || combinedData.property_address_list, googleMapsApiKey);
                    if (propertyGeo) {
                        combinedData.property_lat = propertyGeo.lat;
                        combinedData.property_lng = propertyGeo.lng;
                        combinedData.property_formatted_address = propertyGeo.formatted_address;
                    }
                    
                    // Geocode auction location if available
                    if (auctionDetails.auction_address) {
                        const auctionGeo = await geocodeAddress(auctionDetails.auction_address, googleMapsApiKey);
                        if (auctionGeo) {
                            combinedData.auction_lat = auctionGeo.lat;
                            combinedData.auction_lng = auctionGeo.lng;
                            combinedData.auction_formatted_address = auctionGeo.formatted_address;
                        }
                    }
                }
                
                // Add metadata
                combinedData.scraped_at = new Date().toISOString();
                combinedData.notice_date = targetDate;
                
                allNotices.push(combinedData);
                
                // Add delay between requests to be respectful
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`Error processing detail page for ${notice.borrower_list}:`, error);
                // Add notice with error flag
                allNotices.push({
                    ...notice,
                    detail_page_error: `Failed to fetch or parse detail page: ${error.message}`
                });
            }
        }
        
        console.log(`Successfully processed ${allNotices.length} notices`);
        
        // Save results to dataset
        await Actor.pushData(allNotices);
        
        // Send to Supabase if configured
        if (supabase && allNotices.length > 0) {
            console.log(`Sending ${allNotices.length} notices to Supabase...`);
            
            try {
                // Insert in batches to avoid timeouts
                const batchSize = 50;
                for (let i = 0; i < allNotices.length; i += batchSize) {
                    const batch = allNotices.slice(i, i + batchSize);
                    
                    const { data, error } = await supabase
                        .from(tableName)
                        .upsert(batch, {
                            onConflict: 'details_url' // Assumes unique constraint on details_url
                        });
                    
                    if (error) {
                        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
                    } else {
                        console.log(`Inserted batch ${i / batchSize + 1} (${batch.length} records)`);
                    }
                }
                
                console.log('Supabase sync completed');
            } catch (error) {
                console.error('Error syncing to Supabase:', error);
                // Don't throw - we still want the actor to succeed
            }
        }
        
        console.log(`TN Ledger scraper completed successfully for date: ${targetDate}`);
        
    } catch (error) {
        console.error('Error in TN Ledger scraper:', error);
        
        // Check if it's a timeout or navigation error
        if (error.message.includes('timeout') || error.message.includes('net::ERR_')) {
            console.log('This might be due to:');
            console.log('1. Network connectivity issues');
            console.log('2. The TN Ledger website being down');
            console.log('3. The specific notices page not existing for this date');
        }
        
        throw error;
    } finally {
        await browser.close();
    }
});