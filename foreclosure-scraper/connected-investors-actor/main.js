const { Actor } = require('apify');
const { chromium } = require('playwright');

// Constants
const BASE_URL = 'https://connectedinvestors.platlabs.com';
const LOGIN_URL = `${BASE_URL}/login`;
const PROPERTY_SEARCH_URL = `${BASE_URL}/find-deals/property-search`;

// Main actor function
Actor.main(async () => {
    console.log('Starting Connected Investors Property Scraper...');
    
    const input = await Actor.getInput();
    const {
        username,
        password,
        addresses = ['522 Acorn Way, Mt Juliet'],
        skipTrace = true,
        maxProperties = 10,
        headless = true
    } = input;

    if (!username || !password) {
        throw new Error('Username and password are required!');
    }

    console.log(`Processing ${addresses.length} addresses with skip tracing: ${skipTrace}`);

    // Launch browser
    const browser = await chromium.launch({
        headless,
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

    const page = await context.newPage();
    
    try {
        // Step 1: Login
        console.log('Logging in...');
        const loginSuccess = await loginToConnectedInvestors(page, username, password);
        
        if (!loginSuccess) {
            throw new Error('Login failed. Please check your credentials.');
        }
        
        console.log('Login successful!');
        
        // Step 2: Process each address
        const allResults = [];
        
        for (const address of addresses) {
            console.log(`Processing address: ${address}`);
            
            try {
                const properties = await searchAndExtractProperties(page, address, maxProperties);
                
                for (const property of properties) {
                    // Add address context
                    property.searchAddress = address;
                    property.scraped_at = new Date().toISOString();
                    
                    // Perform skip tracing if enabled
                    if (skipTrace) {
                        console.log(`Performing skip trace for: ${property.address || address}`);
                        const skipTraceData = await performSkipTrace(page, property);
                        property.skipTrace = skipTraceData;
                    }
                    
                    allResults.push(property);
                }
                
                console.log(`Found ${properties.length} properties for address: ${address}`);
                
            } catch (error) {
                console.error(`Error processing address ${address}:`, error.message);
                // Continue with next address
            }
            
            // Small delay between addresses
            await page.waitForTimeout(2000);
        }
        
        console.log(`Total properties found: ${allResults.length}`);
        
        // Push results to dataset
        await Actor.pushData(allResults);
        
    } catch (error) {
        console.error('Error in main execution:', error);
        throw error;
    } finally {
        await browser.close();
        console.log('Browser closed. Scraping completed.');
    }
});

// Login function
async function loginToConnectedInvestors(page, username, password) {
    try {
        console.log('Navigating to login page...');
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
        
        // Wait for page to load
        await page.waitForTimeout(3000);
        
        // Take screenshot for debugging
        await page.screenshot({ path: 'login_page_initial.png' });
        
        const initialUrl = page.url();
        console.log(`Initial URL: ${initialUrl}`);
        
        // Click the login button to trigger OAuth redirect
        const loginButtonSelectors = [
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'button:has-text("Log In")',
            'a:has-text("Login")',
            'a:has-text("Sign In")',
            'a:has-text("Log In")',
            'button[type="submit"]',
            'input[type="submit"]',
            '.login-button',
            '[class*="login-btn"]',
            '#login-button'
        ];
        
        let loginTriggered = false;
        for (const selector of loginButtonSelectors) {
            try {
                const button = await page.$(selector);
                if (button) {
                    console.log(`Found login trigger button using selector: ${selector}`);
                    await button.click();
                    loginTriggered = true;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (loginTriggered) {
            console.log('Waiting for OAuth redirect...');
            // Wait for navigation to First American identity provider
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
        }
        
        // Check if we've been redirected to First American OAuth
        await page.waitForTimeout(3000);
        const oauthUrl = page.url();
        console.log(`Current URL after login click: ${oauthUrl}`);
        
        if (oauthUrl.includes('login.firstam.com') || oauthUrl.includes('firstamericanidentity.onmicrosoft.com')) {
            console.log('Detected First American OAuth page');
            await page.screenshot({ path: 'oauth_page.png' });
            
            // Wait a bit for the OAuth page to fully load
            await page.waitForTimeout(2000);
            
            // Find and fill username/email field on OAuth page
            const oauthUsernameSelectors = [
                'input[name="loginfmt"]',
                'input[name="username"]',
                'input[name="email"]',
                'input[type="email"]',
                'input[placeholder*="email" i]',
                'input[placeholder*="Email" i]',
                'input[placeholder*="username" i]',
                'input[placeholder*="Username" i]',
                'input#username',
                'input#email',
                'input#loginfmt'
            ];
            
            let usernameField = null;
            for (const selector of oauthUsernameSelectors) {
                try {
                    usernameField = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                    if (usernameField) {
                        console.log(`Found OAuth username field using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!usernameField) {
                console.log('Could not find OAuth username field. Analyzing available inputs...');
                const allInputs = await page.$$('input');
                console.log(`Found ${allInputs.length} input fields on OAuth page`);
                
                for (let i = 0; i < allInputs.length; i++) {
                    const input = allInputs[i];
                    const type = await input.getAttribute('type');
                    const name = await input.getAttribute('name');
                    const id = await input.getAttribute('id');
                    const placeholder = await input.getAttribute('placeholder');
                    const isVisible = await input.isVisible();
                    console.log(`Input ${i}: type=${type}, name=${name}, id=${id}, placeholder=${placeholder}, visible=${isVisible}`);
                }
                
                throw new Error('Could not find OAuth username field');
            }
            
            await usernameField.fill(username);
            console.log('OAuth username entered');
            
            // Find and fill password field
            const oauthPasswordSelectors = [
                'input[name="passwd"]',
                'input[name="password"]',
                'input[type="password"]',
                'input#password',
                'input#passwd',
                'input[placeholder*="password" i]',
                'input[placeholder*="Password" i]'
            ];
            
            let passwordField = null;
            for (const selector of oauthPasswordSelectors) {
                try {
                    passwordField = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                    if (passwordField) {
                        console.log(`Found OAuth password field using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!passwordField) {
                throw new Error('Could not find OAuth password field');
            }
            
            await passwordField.fill(password);
            console.log('OAuth password entered');
            
            // Find and click OAuth submit button
            const oauthSubmitSelectors = [
                'input[type="submit"]',
                'button[type="submit"]',
                'button:has-text("Sign in")',
                'button:has-text("Sign In")',
                'button:has-text("Login")',
                'button:has-text("Log In")',
                'input[value="Sign in"]',
                'input[value="Sign In"]',
                '#idSIButton9'
            ];
            
            let submitButton = null;
            for (const selector of oauthSubmitSelectors) {
                try {
                    submitButton = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                    if (submitButton) {
                        console.log(`Found OAuth submit button using selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (!submitButton) {
                // Try pressing Enter on password field
                await passwordField.press('Enter');
                console.log('Pressed Enter on OAuth password field');
            } else {
                await submitButton.click();
                console.log('Clicked OAuth submit button');
            }
            
            // Wait for OAuth redirect back to Connected Investors
            console.log('Waiting for redirect back to Connected Investors...');
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForTimeout(5000);
            
            // Take screenshot after OAuth login
            await page.screenshot({ path: 'after_oauth_login.png' });
            
            const finalUrl = page.url();
            console.log(`Final URL after OAuth: ${finalUrl}`);
            
            // Check if we're back on Connected Investors and not on login page
            if (finalUrl.includes('connectedinvestors.platlabs.com') && !finalUrl.includes('/login')) {
                console.log('OAuth login successful - returned to Connected Investors');
                return true;
            } else if (finalUrl.includes('/login')) {
                console.log('Still on login page after OAuth - login may have failed');
                return false;
            } else {
                console.log('Unexpected URL after OAuth login');
                return false;
            }
            
        } else {
            // Fallback to direct login if no OAuth redirect occurred
            console.log('No OAuth redirect detected, attempting direct login...');
            
            // Original login logic here as fallback
            const usernameSelectors = [
                'input[name="email"]',
                'input[name="username"]',
                'input[type="email"]',
                'input[type="text"]'
            ];
            
            let usernameField = null;
            for (const selector of usernameSelectors) {
                try {
                    const field = await page.$(selector);
                    if (field && await field.isVisible()) {
                        usernameField = field;
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            if (usernameField) {
                await usernameField.fill(username);
                
                const passwordField = await page.waitForSelector('input[type="password"]', { timeout: 5000 });
                if (passwordField) {
                    await passwordField.fill(password);
                    await passwordField.press('Enter');
                    
                    await page.waitForTimeout(5000);
                    
                    const currentUrl = page.url();
                    if (!currentUrl.includes('/login')) {
                        return true;
                    }
                }
            }
            
            return false;
        }
        
    } catch (error) {
        console.error('Error during login:', error.message);
        await page.screenshot({ path: 'login_error.png' });
        return false;
    }
}

// Property search and extraction function
async function searchAndExtractProperties(page, address, maxProperties) {
    try {
        console.log(`Navigating to property search page...`);
        await page.goto(PROPERTY_SEARCH_URL, { waitUntil: 'networkidle' });
        
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'property_search_page.png' });
        
        // Find search input
        const searchSelectors = [
            'input[placeholder*="address" i]',
            'input[placeholder*="Address" i]',
            'input[placeholder*="search" i]',
            'input[placeholder*="Search" i]',
            'input[type="search"]',
            'input[type="text"]:first-of-type',
            '#address-search',
            '.search-input'
        ];
        
        let searchInput = null;
        for (const selector of searchSelectors) {
            try {
                searchInput = await page.waitForSelector(selector, { timeout: 5000 });
                if (searchInput) {
                    console.log(`Found search input using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!searchInput) {
            throw new Error('Could not find search input field');
        }
        
        // Clear and enter address
        await searchInput.fill('');
        await searchInput.fill(address);
        console.log(`Entered address: ${address}`);
        
        // Submit search
        await searchInput.press('Enter');
        console.log('Search submitted');
        
        // Wait for results
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'search_results.png' });
        
        // Extract property results
        const properties = await extractPropertyData(page, maxProperties);
        
        return properties;
        
    } catch (error) {
        console.error('Error in property search:', error.message);
        await page.screenshot({ path: 'search_error.png' });
        return [];
    }
}

// Extract property data from results
async function extractPropertyData(page, maxProperties) {
    const properties = [];
    
    try {
        // Wait for results to load
        await page.waitForTimeout(3000);
        
        // Try different selectors for property elements
        const propertySelectors = [
            '.property-card',
            '.property-item',
            '.result-item',
            '[class*="property"]',
            '[class*="result"]',
            'article[class*="property"]',
            '.listing-item',
            '.property-listing'
        ];
        
        let propertyElements = [];
        for (const selector of propertySelectors) {
            try {
                propertyElements = await page.$$(selector);
                if (propertyElements.length > 0) {
                    console.log(`Found ${propertyElements.length} properties using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (propertyElements.length === 0) {
            console.log('No property elements found. Trying generic extraction...');
            
            // Try to get all text content from the page for analysis
            const pageContent = await page.textContent('body');
            console.log('Page content length:', pageContent.length);
            
            // If we can't find structured data, create a basic entry
            return [{
                address: 'Property found but could not extract details',
                raw_content: pageContent.substring(0, 1000), // First 1000 chars
                extraction_method: 'fallback'
            }];
        }
        
        // Limit to maxProperties
        const elementsToProcess = propertyElements.slice(0, maxProperties);
        
        for (let i = 0; i < elementsToProcess.length; i++) {
            const element = elementsToProcess[i];
            
            try {
                const propertyData = await extractSingleProperty(page, element, i);
                if (propertyData) {
                    properties.push(propertyData);
                }
            } catch (error) {
                console.error(`Error extracting property ${i}:`, error.message);
                // Continue with next property
            }
        }
        
    } catch (error) {
        console.error('Error in property data extraction:', error.message);
    }
    
    return properties;
}

// Extract data from a single property element
async function extractSingleProperty(page, element, index) {
    try {
        const propertyData = {
            index: index,
            extraction_method: 'structured'
        };
        
        // Get all text content from the element
        const elementText = await element.textContent();
        propertyData.raw_text = elementText;
        
        // Try to extract specific fields
        const fieldSelectors = {
            address: ['.address', '.property-address', '.location', '[class*="address"]'],
            price: ['.price', '.property-price', '.asking-price', '[class*="price"]'],
            beds: ['.beds', '.bedrooms', '.property-beds', '[class*="bed"]'],
            baths: ['.baths', '.bathrooms', '.property-baths', '[class*="bath"]'],
            sqft: ['.sqft', '.square-feet', '.sq-ft', '[class*="sqft"]'],
            lot_size: ['.lot-size', '.lot', '[class*="lot"]'],
            year_built: ['.year-built', '.built', '[class*="year"]'],
            property_type: ['.property-type', '.type', '[class*="type"]']
        };
        
        for (const [field, selectors] of Object.entries(fieldSelectors)) {
            for (const selector of selectors) {
                try {
                    const fieldElement = await element.$(selector);
                    if (fieldElement) {
                        const value = await fieldElement.textContent();
                        if (value && value.trim()) {
                            propertyData[field] = value.trim();
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        // Try to extract URLs or links
        try {
            const links = await element.$$('a');
            const propertyLinks = [];
            
            for (const link of links) {
                const href = await link.getAttribute('href');
                const linkText = await link.textContent();
                
                if (href) {
                    propertyLinks.push({
                        url: href,
                        text: linkText?.trim()
                    });
                }
            }
            
            if (propertyLinks.length > 0) {
                propertyData.links = propertyLinks;
            }
        } catch (e) {
            // Continue without links
        }
        
        // If we couldn't extract structured data, use text parsing
        if (!propertyData.address && elementText) {
            propertyData.address = parseAddressFromText(elementText);
        }
        
        if (!propertyData.price && elementText) {
            propertyData.price = parsePriceFromText(elementText);
        }
        
        return propertyData;
        
    } catch (error) {
        console.error(`Error extracting single property:`, error.message);
        return null;
    }
}

// Skip tracing function
async function performSkipTrace(page, property) {
    try {
        console.log('Performing skip trace...');
        
        const skipTraceData = {
            attempted_at: new Date().toISOString(),
            method: 'connected_investors_platform',
            results: {}
        };
        
        // Try to find owner information on the current page
        const ownerSelectors = [
            '.owner-info',
            '.property-owner',
            '[class*="owner"]',
            '.contact-info',
            '[class*="contact"]'
        ];
        
        for (const selector of ownerSelectors) {
            try {
                const ownerElement = await page.$(selector);
                if (ownerElement) {
                    const ownerText = await ownerElement.textContent();
                    skipTraceData.results.owner_info = ownerText;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        // Look for email patterns in page content
        const pageContent = await page.textContent('body');
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const emails = pageContent.match(emailRegex);
        
        if (emails && emails.length > 0) {
            skipTraceData.results.emails = [...new Set(emails)]; // Remove duplicates
        }
        
        // Look for phone patterns
        const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
        const phones = pageContent.match(phoneRegex);
        
        if (phones && phones.length > 0) {
            skipTraceData.results.phones = [...new Set(phones)]; // Remove duplicates
        }
        
        // If property has links, try to visit them for more owner info
        if (property.links && property.links.length > 0) {
            for (const link of property.links.slice(0, 3)) { // Limit to first 3 links
                try {
                    if (link.url && (link.url.startsWith('http') || link.url.startsWith('/'))) {
                        const fullUrl = link.url.startsWith('http') ? link.url : `${BASE_URL}${link.url}`;
                        
                        console.log(`Visiting property detail page: ${fullUrl}`);
                        await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
                        await page.waitForTimeout(2000);
                        
                        // Look for additional owner information
                        const detailOwnerInfo = await extractOwnerInfoFromDetailPage(page);
                        if (detailOwnerInfo) {
                            skipTraceData.results.detail_owner_info = detailOwnerInfo;
                        }
                        
                        break; // Only visit first valid link
                    }
                } catch (e) {
                    console.log(`Could not visit link ${link.url}:`, e.message);
                    continue;
                }
            }
        }
        
        return skipTraceData;
        
    } catch (error) {
        console.error('Error in skip trace:', error.message);
        return {
            attempted_at: new Date().toISOString(),
            method: 'connected_investors_platform',
            error: error.message,
            results: {}
        };
    }
}

// Extract owner info from property detail page
async function extractOwnerInfoFromDetailPage(page) {
    try {
        const ownerInfo = {};
        
        // Look for owner-specific elements
        const ownerSelectors = {
            name: ['.owner-name', '.property-owner', '[class*="owner-name"]'],
            email: ['.owner-email', '.contact-email', '[class*="email"]'],
            phone: ['.owner-phone', '.contact-phone', '[class*="phone"]'],
            address: ['.owner-address', '.mailing-address', '[class*="mailing"]']
        };
        
        for (const [field, selectors] of Object.entries(ownerSelectors)) {
            for (const selector of selectors) {
                try {
                    const element = await page.$(selector);
                    if (element) {
                        const value = await element.textContent();
                        if (value && value.trim()) {
                            ownerInfo[field] = value.trim();
                            break;
                        }
                    }
                } catch (e) {
                    continue;
                }
            }
        }
        
        return Object.keys(ownerInfo).length > 0 ? ownerInfo : null;
        
    } catch (error) {
        console.error('Error extracting owner info from detail page:', error.message);
        return null;
    }
}

// Helper function to parse address from text
function parseAddressFromText(text) {
    // Look for address patterns
    const addressRegex = /\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Circle|Cir|Court|Ct|Place|Pl)/i;
    const match = text.match(addressRegex);
    return match ? match[0].trim() : null;
}

// Helper function to parse price from text
function parsePriceFromText(text) {
    // Look for price patterns
    const priceRegex = /\$[\d,]+(?:\.\d{2})?/g;
    const matches = text.match(priceRegex);
    return matches ? matches[0] : null;
}

console.log('Connected Investors Actor loaded successfully');