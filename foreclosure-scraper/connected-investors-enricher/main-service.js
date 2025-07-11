const { Actor } = require('apify');
const { chromium } = require('playwright');
const express = require('express');

// Constants
const BASE_URL = 'https://connectedinvestors.platlabs.com';
const LOGIN_URL = `${BASE_URL}/login`;
const PROPERTY_SEARCH_URL = `${BASE_URL}/find-deals/property-search`;

// Service configuration
const PORT = process.env.PORT || 3000;
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'your-secret-token';

// Global browser and page instance
let browser = null;
let page = null;
let isLoggedIn = false;

// Express app for receiving requests
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        isLoggedIn,
        ready: isLoggedIn && page !== null 
    });
});

// Skip trace endpoint
app.post('/skip-trace', async (req, res) => {
    try {
        // Verify token
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token !== SERVICE_TOKEN) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!isLoggedIn || !page) {
            return res.status(503).json({ error: 'Service not ready. Please wait for login.' });
        }

        const { propertyId, address } = req.body;
        
        if (!propertyId || !address) {
            return res.status(400).json({ error: 'Property ID and address are required' });
        }

        console.log(`Processing skip trace request for property ${propertyId}: ${address}`);
        
        // Perform skip trace
        const skipTraceData = await performSkipTrace(page, address);
        
        if (skipTraceData) {
            res.json({
                success: true,
                propertyId,
                data: skipTraceData
            });
        } else {
            res.json({
                success: false,
                propertyId,
                error: 'No skip trace data found'
            });
        }
        
    } catch (error) {
        console.error('Skip trace error:', error);
        res.status(500).json({ 
            error: 'Skip trace failed', 
            message: error.message 
        });
    }
});

// Main actor function
Actor.main(async () => {
    console.log('Starting Connected Investors Skip Trace Service...');
    
    const input = await Actor.getInput();
    const { username, password } = input;

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
        
        console.log('Login successful! Service is ready.');
        
        // Start Express server
        const server = app.listen(PORT, () => {
            console.log(`Skip trace service listening on port ${PORT}`);
        });
        
        // Keep the actor running
        await new Promise((resolve) => {
            // This will keep the actor running until it's stopped
            process.on('SIGTERM', () => {
                console.log('Received SIGTERM, shutting down...');
                server.close();
                resolve();
            });
        });
        
    } catch (error) {
        console.error('Service error:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed. Service stopped.');
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
        await page.goto(PROPERTY_SEARCH_URL, { waitUntil: 'load' });
        await page.waitForTimeout(3000);
        
        // Search for the property
        const skipTraceData = await searchAndEnrichProperty(page, address);
        
        return skipTraceData;
        
    } catch (error) {
        console.error(`Error performing skip trace for ${address}:`, error.message);
        return null;
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