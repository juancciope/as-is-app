const Apify = require('apify');
const { launchPlaywright } = require('apify');

Apify.main(async () => {
    const input = await Apify.getInput();
    
    console.log('Starting TN Ledger scraper...');
    
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
        
        return \`\${month}/\${day}/\${year}\`;
    };
    
    // Get the target date
    const targetDate = input?.noticesDate || getTargetFridayDate();
    console.log('Target notices date:', targetDate);
    
    const browser = await launchPlaywright({
        launchOptions: {
            headless: true,
        },
    });
    
    const page = await browser.newPage();
    
    // Set user agent to mimic a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    const BASE_URL = 'https://tnledger.com';
    const NOTICES_LIST_URL = \`https://tnledger.com/Notices.aspx?noticesDate=\${encodeURIComponent(targetDate)}\`;
    
    try {
        console.log('Navigating to:', NOTICES_LIST_URL);
        await page.goto(NOTICES_LIST_URL, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for the foreclosure grid to load
        await page.waitForSelector('#ContentPane_ForeclosureGridView', { timeout: 15000 });
        
        // Extract notice list data
        const noticeListData = await page.evaluate(() => {
            const notices = [];
            const table = document.querySelector('#ContentPane_ForeclosureGridView');
            
            if (!table) {
                console.log('Foreclosure table not found');
                return notices;
            }
            
            const rows = table.querySelectorAll('tbody tr');
            console.log(\`Found \${rows.length} table rows\`);
            
            for (let i = 1; i < rows.length; i++) { // Skip header row
                const cells = rows[i].querySelectorAll('td');
                if (cells.length >= 5) {
                    const linkElement = cells[0].querySelector('a');
                    let detailsUrl = null;
                    
                    if (linkElement && linkElement.href) {
                        const jsHref = linkElement.href;
                        const match = jsHref.match(/javascript:OpenChildFT2\\('([^']+)','([^']+)'\\)/);
                        if (match) {
                            const noticeId = match[1];
                            const encodedDate = match[2];
                            const noticeDate = decodeURIComponent(encodedDate);
                            detailsUrl = \`https://tnledger.com/Search/Details/ViewNotice.aspx?id=\${noticeId}&date=\${noticeDate}\`;
                        }
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
        
        console.log(\`Found \${noticeListData.length} notices on list page\`);
        
        if (noticeListData.length === 0) {
            console.log('No notices found. This might be because:');
            console.log('1. No foreclosure notices for this date');
            console.log('2. The date format is incorrect');
            console.log('3. The page structure has changed');
            
            await Apify.pushData([]);
            return;
        }
        
        // Process each notice detail page
        const allNotices = [];
        
        for (let i = 0; i < noticeListData.length; i++) {
            const notice = noticeListData[i];
            console.log(\`Processing notice \${i + 1}/\${noticeListData.length}: \${notice.borrower_list}\`);
            
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
                        const span = recordDiv.querySelector(\`#\${id}\`);
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
                allNotices.push(combinedData);
                
                // Add delay between requests to be respectful
                await page.waitForTimeout(2000);
                
            } catch (error) {
                console.error(\`Error processing detail page for \${notice.borrower_list}:\`, error);
                // Add notice with error flag
                allNotices.push({
                    ...notice,
                    detail_page_error: \`Failed to fetch or parse detail page: \${error.message}\`
                });
            }
        }
        
        console.log(\`Successfully processed \${allNotices.length} notices\`);
        
        // Save results to dataset
        await Apify.pushData(allNotices);
        
        console.log(\`TN Ledger scraper completed successfully for date: \${targetDate}\`);
        
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