const { Actor } = require('apify');
const { chromium } = require('playwright');

// Constants
const BASE_URL = 'https://connectedinvestors.platlabs.com';
const LOGIN_URL = `${BASE_URL}/login`;
const PROPERTY_SEARCH_URL = `${BASE_URL}/find-deals/property-search`;

// Global browser and page instance
let browser = null;
let page = null;
let isLoggedIn = false;

// Main actor function
Actor.main(async () => {
    console.log('Starting Connected Investors Skip Trace Service...');
    
    const input = await Actor.getInput();
    const { username, password, propertyId, address } = input;

    if (!username || !password) {
        throw new Error('Username and password are required!');
    }

    try {
        // Launch browser
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 }
        });

        page = await context.newPage();
        
        // Login to Connected Investors
        console.log('Logging in to Connected Investors...');
        isLoggedIn = await loginToConnectedInvestors(page, username, password);
        
        if (!isLoggedIn) {
            throw new Error('Login failed. Please check your credentials.');
        }
        
        console.log('Login successful!');
        
        // If propertyId and address are provided, perform skip trace
        if (propertyId && address) {
            console.log(`Processing skip trace request for property ${propertyId}: ${address}`);
            
            const skipTraceData = await performSkipTrace(page, address);
            
            if (skipTraceData) {
                await Actor.pushData({
                    success: true,
                    propertyId,
                    address,
                    data: skipTraceData,
                    processedAt: new Date().toISOString()
                });
                
                console.log(`Successfully completed skip trace for property ${propertyId}`);
            } else {
                await Actor.pushData({
                    success: false,
                    propertyId,
                    address,
                    error: 'No skip trace data found',
                    processedAt: new Date().toISOString()
                });
                
                console.log(`No skip trace data found for property ${propertyId}`);
            }
        } else {
            // Service is ready and logged in
            console.log('Service is ready and logged in. You can now call this actor with propertyId and address.');
            await Actor.pushData({
                success: true,
                message: 'Service is ready and logged in',
                serviceStatus: 'ready',
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('Service error:', error);
        await Actor.pushData({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed. Service completed.');
        }
    }
});

// Login function
async function loginToConnectedInvestors(page, username, password) {
    try {
        console.log('Navigating to login page...');
        await page.goto(LOGIN_URL, { waitUntil: 'load', timeout: 60000 });
        
        await page.waitForTimeout(5000);
        
        // Find username field
        const usernameSelectors = [
            'input#v-0-1',
            'input[name="username"]',
            'input[type="text"][name="username"]'
        ];
        
        let usernameField = null;
        for (const selector of usernameSelectors) {
            try {
                usernameField = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                if (usernameField) {
                    console.log(`Found username field using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!usernameField) {
            throw new Error('Could not find username field');
        }
        
        await usernameField.fill(username);
        console.log('Username entered');
        
        // Find and click login button
        const loginButtonSelectors = [
            'button[type="submit"]:text("Log in")',
            'button:text("Log in")', 
            'button[type="submit"]'
        ];
        
        let loginButton = null;
        for (const selector of loginButtonSelectors) {
            try {
                loginButton = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                if (loginButton) {
                    console.log(`Found login button using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!loginButton) {
            throw new Error('Could not find login button');
        }
        
        await page.waitForTimeout(1000);
        await loginButton.click();
        console.log('Clicked login button');
        
        // Wait for OAuth redirect or page change
        try {
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
            console.log('Navigation timeout, checking current URL...');
        }
        
        const oauthUrl = page.url();
        console.log(`Current URL after login: ${oauthUrl}`);
        
        // Check if we're still on login page (might need to wait for redirect)
        if (oauthUrl.includes('connectedinvestors.platlabs.com/login')) {
            console.log('Still on login page, waiting for redirect...');
            await page.waitForTimeout(5000);
            
            // Try waiting for navigation again
            try {
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
            } catch (e) {
                console.log('No redirect occurred, checking final URL...');
            }
            
            const finalUrl = page.url();
            console.log(`Final URL after waiting: ${finalUrl}`);
            
            if (finalUrl.includes('login.firstam.com') || finalUrl.includes('firstamericanidentity.onmicrosoft.com')) {
                console.log('On OAuth page, entering password...');
                
                // Enter password
                await page.waitForTimeout(3000);
                const passwordField = await page.waitForSelector('input#password', { timeout: 10000 });
                await passwordField.fill(password);
                console.log('Password entered');
                
                // Click submit
                const submitButton = await page.waitForSelector('button#next', { timeout: 5000 });
                await submitButton.click();
                console.log('Clicked submit button');
                
                // Wait for redirect back
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForTimeout(3000);
                
                const returnUrl = page.url();
                console.log(`Return URL: ${returnUrl}`);
                
                // Check if we have the authorization code in the URL (successful OAuth)
                if (returnUrl.includes('connectedinvestors.platlabs.com') && returnUrl.includes('code=')) {
                    console.log('OAuth successful - received authorization code');
                    // Wait for the site to process the OAuth code
                    await page.waitForTimeout(5000);
                    const finalUrl = page.url();
                    console.log(`Final URL after OAuth processing: ${finalUrl}`);
                    return !finalUrl.includes('/login');
                }
                
                return returnUrl.includes('connectedinvestors.platlabs.com') && !returnUrl.includes('/login');
            }
            
            // If we're still on the login page, login failed
            if (finalUrl.includes('connectedinvestors.platlabs.com/login')) {
                console.log('Login failed - still on login page');
                return false;
            }
            
            // If we're on the main site, login succeeded
            if (finalUrl.includes('connectedinvestors.platlabs.com') && !finalUrl.includes('/login')) {
                console.log('Login successful - on main site');
                return true;
            }
        }
        
        if (oauthUrl.includes('login.firstam.com') || oauthUrl.includes('firstamericanidentity.onmicrosoft.com')) {
            console.log('Directly on OAuth page, entering password...');
            
            // Enter password
            await page.waitForTimeout(3000);
            const passwordField = await page.waitForSelector('input#password', { timeout: 10000 });
            await passwordField.fill(password);
            console.log('Password entered');
            
            // Click submit
            const submitButton = await page.waitForSelector('button#next', { timeout: 5000 });
            await submitButton.click();
            console.log('Clicked submit button');
            
            // Wait for redirect back
            await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            
            const finalUrl = page.url();
            console.log(`Final URL: ${finalUrl}`);
            
            // Check if we have the authorization code in the URL (successful OAuth)
            if (finalUrl.includes('connectedinvestors.platlabs.com') && finalUrl.includes('code=')) {
                console.log('OAuth successful - received authorization code');
                // Wait for the site to process the OAuth code
                await page.waitForTimeout(5000);
                const processedUrl = page.url();
                console.log(`Final URL after OAuth processing: ${processedUrl}`);
                return !processedUrl.includes('/login');
            }
            
            return finalUrl.includes('connectedinvestors.platlabs.com') && !finalUrl.includes('/login');
        }
        
        return false;
        
    } catch (error) {
        console.error('Login error:', error.message);
        return false;
    }
}

// Perform skip trace for a single property
async function performSkipTrace(page, address) {
    try {
        // Navigate to property search page
        console.log(`Navigating to property search page: ${PROPERTY_SEARCH_URL}`);
        await page.goto(PROPERTY_SEARCH_URL, { waitUntil: 'load' });
        console.log(`Successfully navigated to: ${page.url()}`);
        await page.waitForTimeout(3000);
        
        // Close any modals or overlays that might be present
        await dismissModalsAndOverlays(page);
        
        // Search for the property
        const skipTraceData = await searchAndEnrichProperty(page, address);
        
        return skipTraceData;
        
    } catch (error) {
        console.error(`Error performing skip trace for ${address}:`, error.message);
        return null;
    }
}

// Function to dismiss modals and overlays
async function dismissModalsAndOverlays(page) {
    try {
        console.log('Checking for modals and overlays...');
        
        // Check for headlessui portal (common modal framework)
        const portalRoot = await page.$('#headlessui-portal-root');
        if (portalRoot) {
            console.log('Found headlessui portal, attempting to dismiss...');
            
            // First, let's capture the modal content to understand what it contains
            let modalContent = null;
            try {
                modalContent = await portalRoot.textContent();
                console.log('=== MODAL CONTENT START ===');
                console.log(modalContent);
                console.log('=== MODAL CONTENT END ===');
                
                // Also get the HTML structure
                const modalHTML = await portalRoot.innerHTML();
                console.log('=== MODAL HTML START ===');
                console.log(modalHTML.substring(0, 1000) + (modalHTML.length > 1000 ? '...' : ''));
                console.log('=== MODAL HTML END ===');
            } catch (e) {
                console.log('Could not extract modal content:', e.message);
            }
            
            // Check if this is the session conflict modal and handle it specifically
            if (modalContent && modalContent.includes('someone else is already digging for gold')) {
                console.log('Detected session conflict modal - clicking "Kick Them Out"');
                try {
                    const kickButton = await page.$('button:has-text("Kick Them Out")');
                    if (kickButton) {
                        await kickButton.click();
                        console.log('Clicked "Kick Them Out" button');
                        await page.waitForTimeout(3000);
                        return; // Exit early since we handled the specific modal
                    }
                } catch (e) {
                    console.log('Could not click "Kick Them Out" button:', e.message);
                }
            }
            
            // Try clicking close buttons for other modals
            const closeSelectors = [
                'button[aria-label="Close"]',
                'button:has-text("×")',
                'button:has-text("Close")',
                'button:has-text("Skip")',
                'button:has-text("No thanks")',
                'button:has-text("Later")',
                'button:has-text("Dismiss")',
                'button:has-text("Continue")',
                '[data-headlessui-state] button:last-child',
                '.modal button:last-child'
            ];
            
            for (const selector of closeSelectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        await element.click();
                        console.log(`Clicked close button: ${selector}`);
                        await page.waitForTimeout(1000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            // If close buttons don't work, try pressing Escape
            await page.keyboard.press('Escape');
            console.log('Pressed Escape key');
            await page.waitForTimeout(1000);
            
            // If still present, try clicking outside the modal
            try {
                await page.click('body', { position: { x: 10, y: 10 } });
                console.log('Clicked outside modal');
                await page.waitForTimeout(1000);
            } catch (e) {
                // Ignore click errors
            }
        }
        
        // Wait a bit more to ensure modals are gone
        await page.waitForTimeout(2000);
        
        // Check if modal is still present after dismissal attempts
        const stillPresent = await page.$('#headlessui-portal-root');
        if (stillPresent) {
            console.log('WARNING: Modal is still present after dismissal attempts!');
            try {
                const remainingContent = await stillPresent.textContent();
                console.log('Remaining modal content:', remainingContent);
            } catch (e) {
                console.log('Could not read remaining modal content');
            }
        } else {
            console.log('Modal successfully dismissed or was not present');
        }
        
    } catch (error) {
        console.log('Error dismissing modals:', error.message);
        // Continue anyway, as modals might not be present
    }
}

// Search and enrich property
async function searchAndEnrichProperty(page, address) {
    try {
        // Find search input
        const searchSelectors = [
            'input[placeholder="Address, city, ZIP, metro area, county, state, APN, or MLS#"]',
            '.search-wrapper input',
            'input[type="text"]'
        ];
        
        let searchInput = null;
        let workingSelector = null;
        for (const selector of searchSelectors) {
            try {
                searchInput = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                if (searchInput) {
                    console.log(`Found search input using selector: ${selector}`);
                    workingSelector = selector;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!searchInput || !workingSelector) {
            throw new Error('Could not find search input');
        }
        
        // Clear and enter address
        await page.waitForTimeout(2000);
        await page.click(workingSelector);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.type(workingSelector, address);
        console.log(`Entered address: ${address}`);
        
        // Wait for search suggestions - shorter wait time
        await page.waitForTimeout(3000);
        
        // Look for search results dropdown with multiple possible selectors
        try {
            // Try different selectors for the dropdown
            const dropdownSelectors = [
                'div.py-4 ol li p',  // From Chrome recording
                '.search-results li p',
                'section ol li p',
                '[role="listbox"] li',
                'div[data-headlessui-state] li p'
            ];
            
            let foundDropdown = false;
            for (const selector of dropdownSelectors) {
                const results = await page.$$(selector);
                if (results.length > 0) {
                    console.log(`Found ${results.length} search results using selector: ${selector}`);
                    
                    // Click on the first result (usually the best match)
                    await results[0].click();
                    const text = await results[0].textContent();
                    console.log(`Clicked on address result: ${text}`);
                    foundDropdown = true;
                    break;
                }
            }
            
            if (!foundDropdown) {
                console.log('No dropdown results found, trying to press Enter');
                await page.keyboard.press('Enter');
            }
        } catch (e) {
            console.log('Error with dropdown selection:', e.message);
            await page.keyboard.press('Enter');
        }
        
        // Wait for property results
        await page.waitForTimeout(5000);
        
        // Look for property modal/dialog (it opens automatically after clicking address)
        const modalSelectors = [
            'div.sticky button.z-\\[1\\] > span',  // Save button from Chrome recording
            '[id*="headlessui-dialog-panel"]',
            'div[role="dialog"]',
            'main > div > div.sticky'
        ];
        
        let propertyModalFound = false;
        for (const selector of modalSelectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    console.log(`Found property modal using selector: ${selector}`);
                    propertyModalFound = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (propertyModalFound) {
            console.log('Property details modal is open');
            
            // Save to list and skip trace
            const skipTraceData = await saveAndSkipTrace(page, "Foreclousure Scraping");
            
            return skipTraceData;
        } else {
            console.log('No property modal found');
            return null;
        }
        
    } catch (error) {
        console.error('Error in search and enrich:', error.message);
        return null;
    }
}

// Save property to list and perform skip trace
async function saveAndSkipTrace(page, listName) {
    try {
        // First check if property is already skip traced by looking for "Skip Trace Again" button
        const skipTraceAgainButton = await page.$('button:has-text("Skip Trace Again")');
        
        if (skipTraceAgainButton) {
            console.log('Property already skip traced - extracting existing contact info');
            
            // Extract the existing contact information from the property modal
            const contactInfo = await extractExistingContactInfo(page);
            
            console.log('Found existing contact info:', contactInfo);
            return contactInfo;
        }
        
        // Property not skip traced yet - proceed with normal flow
        console.log('Property not skip traced yet - proceeding with normal flow');
        
        // Click save button
        const saveButton = await page.waitForSelector('div.sticky button.z-\\[1\\] > span', { timeout: 5000 });
        await saveButton.click();
        console.log('Clicked save button');
        await page.waitForTimeout(2000);
        
        // Click "use existing list"
        const useExistingButton = await page.waitForSelector('button:has-text("use existing list")', { timeout: 3000 });
        await useExistingButton.click();
        console.log('Clicked use existing list');
        await page.waitForTimeout(1000);
        
        // Click dropdown - it's within the portal root
        const dropdownSelectors = [
            '#headlessui-portal-root > div:nth-of-type(2) main button',
            '#headlessui-portal-root main button',
            'main button[aria-haspopup="listbox"]',
            'button[id*="headlessui-listbox-button"]'
        ];
        
        let dropdownButton = null;
        for (const selector of dropdownSelectors) {
            try {
                dropdownButton = await page.waitForSelector(selector, { timeout: 2000 });
                if (dropdownButton) {
                    console.log(`Found dropdown using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!dropdownButton) {
            throw new Error('Could not find dropdown button');
        }
        
        await dropdownButton.click();
        console.log('Clicked dropdown');
        await page.waitForTimeout(1000);
        
        // Select list - try multiple selectors
        const listSelectors = [
            `[aria-label="${listName}"]`,
            `#headlessui-listbox-option-[id*="${listName}"]`,
            `span:has-text("${listName}")`,
            `[id*="headlessui-listbox-option"]:has-text("${listName}")`
        ];
        
        let listOption = null;
        for (const selector of listSelectors) {
            try {
                listOption = await page.waitForSelector(selector, { timeout: 2000 });
                if (listOption) {
                    console.log(`Found list option using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!listOption) {
            throw new Error(`Could not find list option: ${listName}`);
        }
        
        await listOption.click();
        console.log(`Selected list: ${listName}`);
        await page.waitForTimeout(1000);
        
        // Click Save Property
        const savePropertyButton = await page.waitForSelector('button:has-text("Save Property")', { timeout: 3000 });
        await savePropertyButton.click();
        console.log('Clicked Save Property');
        await page.waitForTimeout(2000);
        
        // Click Skip Trace This Property - it appears in the same footer after saving
        // Try multiple selectors from the Chrome recordings
        const skipTraceSelectors = [
            '#headlessui-portal-root > div:nth-of-type(2) button.rounded > span:has-text("Skip Trace This")',
            'footer > button.rounded:has-text("Skip Trace")',
            'button:has-text("Skip Trace This Property")',
            'button.rounded:has-text("Skip Trace")',
            '#headlessui-portal-root button:has-text("Skip Trace")',
            'footer button:last-child'  // Often the skip trace button is the last button in footer
        ];
        
        let skipTraceButton = null;
        for (const selector of skipTraceSelectors) {
            try {
                skipTraceButton = await page.waitForSelector(selector, { timeout: 2000 });
                if (skipTraceButton) {
                    console.log(`Found skip trace button using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!skipTraceButton) {
            throw new Error('Could not find Skip Trace button');
        }
        
        await skipTraceButton.click();
        console.log('Clicked Skip Trace This Property');
        await page.waitForTimeout(5000);
        
        // Extract contact information
        const contactInfo = await extractContactInfo(page);
        
        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
        
        return contactInfo;
        
    } catch (error) {
        console.error('Error in save and skip trace:', error.message);
        return null;
    }
}

// Extract existing contact information from property modal
async function extractExistingContactInfo(page) {
    try {
        const contactInfo = {
            emails: [],
            phones: [],
            owners: [],
            parsedOwners: []
        };
        
        console.log('Extracting existing contact information from property modal...');
        
        // Wait a bit for content to load
        await page.waitForTimeout(2000);
        
        // Extract all text content from the modal
        const modalContent = await page.textContent('#headlessui-portal-root');
        
        if (modalContent) {
            // Extract emails
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = modalContent.match(emailRegex) || [];
            
            // Filter out common false positives
            const uniqueEmails = [...new Set(emails)].filter(email => 
                !email.includes('noreply') && 
                !email.includes('support') && 
                !email.includes('admin') &&
                !email.includes('no-reply') &&
                !email.includes('@connectedinvestors') &&
                !email.includes('@platlabs')
            );
            
            contactInfo.emails = uniqueEmails;
            
            // Extract phone numbers
            const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
            const phones = modalContent.match(phoneRegex) || [];
            const uniquePhones = [...new Set(phones)];
            
            contactInfo.phones = uniquePhones;
            
            // Try to extract owner names from common patterns
            const ownerPatterns = [
                /Owner:\s*([^\n]+)/gi,
                /Name:\s*([^\n]+)/gi,
                /Contact:\s*([^\n]+)/gi
            ];
            
            for (const pattern of ownerPatterns) {
                const matches = modalContent.matchAll(pattern);
                for (const match of matches) {
                    if (match[1] && match[1].trim().length > 2) {
                        contactInfo.owners.push(match[1].trim());
                    }
                }
            }
            
            // Remove duplicates from owners
            contactInfo.owners = [...new Set(contactInfo.owners)];
            
            // Parse owner names into first and last names
            contactInfo.parsedOwners = parseOwnerNames(contactInfo.owners);
        }
        
        console.log('Extracted existing contact info:', contactInfo);
        return contactInfo;
        
    } catch (error) {
        console.error('Error extracting existing contact info:', error.message);
        return null;
    }
}

// Extract contact information from skip trace results
async function extractContactInfo(page) {
    try {
        const contactInfo = {
            emails: [],
            phones: [],
            owners: [],
            parsedOwners: []
        };
        
        // Wait for skip trace results to load
        await page.waitForTimeout(3000);
        
        // Extract emails
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const pageContent = await page.textContent('body');
        const emails = pageContent.match(emailRegex) || [];
        
        // Remove duplicates and filter out common false positives
        const uniqueEmails = [...new Set(emails)].filter(email => 
            !email.includes('noreply') && 
            !email.includes('support') && 
            !email.includes('admin') &&
            !email.includes('no-reply')
        );
        
        contactInfo.emails = uniqueEmails;
        
        // Extract phone numbers
        const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const phones = pageContent.match(phoneRegex) || [];
        const uniquePhones = [...new Set(phones)];
        
        contactInfo.phones = uniquePhones;
        
        // Extract owner information
        const ownerSelectors = [
            'text=/Owner:/',
            'text=/Name:/',
            '[class*="owner"]',
            '[class*="contact"]'
        ];
        
        for (const selector of ownerSelectors) {
            try {
                const elements = await page.$$(selector);
                for (const element of elements) {
                    const text = await element.textContent();
                    if (text && text.length > 5 && text.length < 100) {
                        contactInfo.owners.push(text.trim());
                    }
                }
            } catch (e) {
                continue;
            }
        }
        
        // Remove duplicates from owners
        contactInfo.owners = [...new Set(contactInfo.owners)];
        
        // Parse owner names into first and last names
        contactInfo.parsedOwners = parseOwnerNames(contactInfo.owners);
        
        console.log('Extracted contact info:', contactInfo);
        return contactInfo;
        
    } catch (error) {
        console.error('Error extracting contact info:', error.message);
        return null;
    }
}

// Parse owner names from text into structured first/last name format
function parseOwnerNames(ownerStrings) {
    const parsedOwners = [];
    
    for (const ownerString of ownerStrings) {
        if (!ownerString || ownerString.trim().length === 0) continue;
        
        // Clean up the owner string
        let cleanName = ownerString.trim()
            .replace(/^(Owner:|Name:|Contact:)/i, '')  // Remove prefixes
            .replace(/[,&]+/g, ' ')  // Replace commas and ampersands with spaces
            .replace(/\s+/g, ' ')    // Normalize whitespace
            .trim();
        
        // Split by common separators for multiple owners
        const nameParts = cleanName.split(/\s+(and|&|\+)\s+/i);
        
        for (const namePart of nameParts) {
            if (namePart.toLowerCase() === 'and' || namePart === '&' || namePart === '+') continue;
            
            const trimmedName = namePart.trim();
            if (trimmedName.length < 2) continue;
            
            // Parse individual name
            const words = trimmedName.split(/\s+/);
            
            if (words.length >= 2) {
                // Standard "First Last" or "First Middle Last" format
                const firstName = words[0];
                const lastName = words[words.length - 1];
                
                parsedOwners.push({
                    firstName: firstName,
                    lastName: lastName,
                    fullName: trimmedName
                });
            } else if (words.length === 1) {
                // Single word - assume it's a last name
                parsedOwners.push({
                    firstName: '',
                    lastName: words[0],
                    fullName: trimmedName
                });
            }
            
            // Only take first 2 owners
            if (parsedOwners.length >= 2) break;
        }
        
        // Only take first 2 owners total
        if (parsedOwners.length >= 2) break;
    }
    
    return parsedOwners.slice(0, 2); // Ensure max 2 owners
}