const { Actor } = require('apify');
const { chromium } = require('playwright');

// Constants
const BASE_URL = 'https://connectedinvestors.platlabs.com';
const LOGIN_URL = `${BASE_URL}/login`;
const PROPERTY_SEARCH_URL = `${BASE_URL}/find-deals/property-search`;

// API configuration
const API_BASE_URL = process.env.API_BASE_URL || 'https://as-is-app.vercel.app';
const API_KEY = process.env.API_KEY; // Optional API key for security

// Main enrichment actor
Actor.main(async () => {
    console.log('Starting Connected Investors Property Enricher...');
    
    const input = await Actor.getInput();
    const {
        username,
        password,
        batchSize = 10,
        maxRetries = 3,
        skipAlreadyEnriched = true
    } = input;

    if (!username || !password) {
        throw new Error('Username and password are required!');
    }

    if (!API_BASE_URL) {
        throw new Error('API configuration missing!');
    }

    // Launch browser
    const browser = await chromium.launch({
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

    const page = await context.newPage();
    
    try {
        // Step 1: Login to Connected Investors
        console.log('Logging in to Connected Investors...');
        const loginSuccess = await loginToConnectedInvestors(page, username, password);
        
        if (!loginSuccess) {
            throw new Error('Login failed. Please check your credentials.');
        }
        
        console.log('Login successful!');
        
        // Step 2: Fetch properties from Supabase that need enrichment
        console.log('Fetching properties from database...');
        const propertiesToEnrich = await fetchPropertiesForEnrichment(skipAlreadyEnriched);
        
        if (propertiesToEnrich.length === 0) {
            console.log('No properties found that need enrichment.');
            return;
        }
        
        console.log(`Found ${propertiesToEnrich.length} properties to enrich`);
        
        // Step 3: Process properties in batches
        const enrichedCount = await processPropertiesInBatches(
            page, 
            propertiesToEnrich, 
            batchSize, 
            maxRetries
        );
        
        console.log(`Enrichment complete! Successfully enriched ${enrichedCount} properties.`);
        
    } catch (error) {
        console.error('Error in enrichment process:', error);
        throw error;
    } finally {
        await browser.close();
        console.log('Browser closed. Enrichment completed.');
    }
});

// Login function (reused from original scraper)
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
        
        // Wait for OAuth redirect
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const oauthUrl = page.url();
        console.log(`Current URL after login: ${oauthUrl}`);
        
        if (oauthUrl.includes('login.firstam.com') || oauthUrl.includes('firstamericanidentity.onmicrosoft.com')) {
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
            
            const finalUrl = page.url();
            console.log(`Final URL: ${finalUrl}`);
            
            return finalUrl.includes('connectedinvestors.platlabs.com') && !finalUrl.includes('/login');
        }
        
        return false;
        
    } catch (error) {
        console.error('Login error:', error.message);
        return false;
    }
}

// Fetch properties from API that need enrichment
async function fetchPropertiesForEnrichment(skipAlreadyEnriched = true) {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (API_KEY) {
            headers['Authorization'] = `Bearer ${API_KEY}`;
        }
        
        // Fetch properties from the API
        const response = await fetch(`${API_BASE_URL}/api/data?needsEnrichment=true`, { 
            headers,
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error(`API query failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        let properties = data.data || [];
        
        // Filter properties that need enrichment if requested
        if (skipAlreadyEnriched) {
            properties = properties.filter(p => !p.owner_emails && !p.owner_phones);
        }
        
        // Filter to recent properties (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        properties = properties.filter(p => new Date(p.created_at) >= thirtyDaysAgo);
        
        console.log(`Fetched ${properties.length} properties from API that need enrichment`);
        
        return properties;
        
    } catch (error) {
        console.error('Error fetching properties:', error);
        throw error;
    }
}

// Process properties in batches
async function processPropertiesInBatches(page, properties, batchSize, maxRetries) {
    let enrichedCount = 0;
    
    for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(properties.length / batchSize)}`);
        
        for (const property of batch) {
            let retries = 0;
            let success = false;
            
            while (retries < maxRetries && !success) {
                try {
                    const enriched = await enrichSingleProperty(page, property);
                    if (enriched) {
                        enrichedCount++;
                        success = true;
                    } else {
                        retries++;
                    }
                } catch (error) {
                    console.error(`Error enriching property ${property.id}:`, error.message);
                    retries++;
                    
                    if (retries < maxRetries) {
                        console.log(`Retrying... (${retries}/${maxRetries})`);
                        await page.waitForTimeout(2000);
                    }
                }
            }
            
            if (!success) {
                console.log(`Failed to enrich property ${property.id} after ${maxRetries} retries`);
            }
        }
        
        // Wait between batches to avoid overwhelming the server
        if (i + batchSize < properties.length) {
            console.log('Waiting between batches...');
            await page.waitForTimeout(5000);
        }
    }
    
    return enrichedCount;
}

// Enrich a single property
async function enrichSingleProperty(page, property) {
    try {
        console.log(`Enriching property: ${property.address}`);
        
        // Navigate to property search page
        await page.goto(PROPERTY_SEARCH_URL, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        
        // Search for the property
        const skipTraceData = await searchAndEnrichProperty(page, property.address);
        
        if (skipTraceData) {
            // Update the property in the database
            await updatePropertyInDatabase(property.id, skipTraceData);
            console.log(`Successfully enriched property ${property.id}`);
            return true;
        } else {
            console.log(`No skip trace data found for property ${property.id}`);
            return false;
        }
        
    } catch (error) {
        console.error(`Error enriching property ${property.id}:`, error.message);
        return false;
    }
}

// Search and enrich property (reused from original scraper)
async function searchAndEnrichProperty(page, address) {
    try {
        // Find search input
        const searchSelectors = [
            'input[placeholder="Address, city, ZIP, metro area, county, state, APN, or MLS#"]',
            '.search-wrapper input',
            'input[type="text"]'
        ];
        
        let searchInput = null;
        for (const selector of searchSelectors) {
            try {
                searchInput = await page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
                if (searchInput) {
                    console.log(`Found search input using selector: ${selector}`);
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!searchInput) {
            throw new Error('Could not find search input');
        }
        
        // Clear and enter address
        await page.waitForTimeout(2000);
        await page.click(searchSelectors[0]);
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.type(searchSelectors[0], address);
        console.log(`Entered address: ${address}`);
        
        // Wait for search suggestions
        await page.waitForTimeout(10000);
        
        // Look for search results dropdown
        try {
            await page.waitForSelector('.search-results', { timeout: 5000 });
            console.log('Search results dropdown appeared');
            
            // Find and click on matching address
            const addressOptions = await page.$$('.search-results li p');
            for (const option of addressOptions) {
                const text = await option.textContent();
                if (text && text.toLowerCase().includes(address.toLowerCase().split(',')[0])) {
                    await option.click();
                    console.log(`Clicked on matching address: ${text}`);
                    break;
                }
            }
        } catch (e) {
            console.log('No dropdown appeared, pressing Enter');
            await page.keyboard.press('Enter');
        }
        
        // Wait for property results
        await page.waitForTimeout(5000);
        
        // Look for property cards
        const propertyCards = await page.$$('[class*="property-card"]');
        
        if (propertyCards.length > 0) {
            console.log(`Found ${propertyCards.length} property cards`);
            
            // Click on first property card
            await propertyCards[0].click();
            console.log('Clicked on property card');
            await page.waitForTimeout(3000);
            
            // Save to list and skip trace
            const skipTraceData = await saveAndSkipTrace(page, "Foreclousure Scraping");
            
            return skipTraceData;
        } else {
            console.log('No property cards found');
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
        
        // Click dropdown
        const dropdownButton = await page.waitForSelector('main button', { timeout: 3000 });
        await dropdownButton.click();
        console.log('Clicked dropdown');
        await page.waitForTimeout(1000);
        
        // Select list
        const listOption = await page.waitForSelector(`[aria-label="${listName}"]`, { timeout: 3000 });
        await listOption.click();
        console.log(`Selected list: ${listName}`);
        await page.waitForTimeout(1000);
        
        // Click Save Property
        const savePropertyButton = await page.waitForSelector('button:has-text("Save Property")', { timeout: 3000 });
        await savePropertyButton.click();
        console.log('Clicked Save Property');
        await page.waitForTimeout(2000);
        
        // Click Skip Trace This Property
        const skipTraceButton = await page.waitForSelector('button:has-text("Skip Trace This Property")', { timeout: 3000 });
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

// Extract contact information from skip trace results
async function extractContactInfo(page) {
    try {
        const contactInfo = {
            emails: [],
            phones: [],
            owners: []
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
        
        console.log('Extracted contact info:', contactInfo);
        return contactInfo;
        
    } catch (error) {
        console.error('Error extracting contact info:', error.message);
        return null;
    }
}

// Update property in database with skip trace data via API
async function updatePropertyInDatabase(propertyId, skipTraceData) {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (API_KEY) {
            headers['Authorization'] = `Bearer ${API_KEY}`;
        }
        
        const updateData = {
            id: propertyId,
            owner_emails: skipTraceData.emails.join(','),
            owner_phones: skipTraceData.phones.join(','),
            owner_info: skipTraceData.owners.join(' | '),
            skip_trace: {
                attempted_at: new Date().toISOString(),
                method: 'connected_investors_enricher',
                results: skipTraceData
            }
        };
        
        const response = await fetch(`${API_BASE_URL}/api/data/enrich`, {
            method: 'POST',
            headers,
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            throw new Error(`API update failed: ${response.status} ${response.statusText}`);
        }
        
        console.log(`Updated property ${propertyId} via API`);
        
    } catch (error) {
        console.error('Error updating via API:', error);
        throw error;
    }
}