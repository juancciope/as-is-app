# Connected Investors - Manual Credentials Setup

## ✅ Deployment Complete!

Your Connected Investors actor has been successfully deployed to Apify!

**Actor ID**: `QwVKg29Os3heUZdOa`  
**Actor URL**: https://console.apify.com/actors/QwVKg29Os3heUZdOa

## 🔑 Setting Up Credentials in Apify Console

### Step 1: Access Your Actor
1. Go to https://console.apify.com/actors/QwVKg29Os3heUZdOa
2. Click on the "Input" tab

### Step 2: Configure Input Parameters
Enter the following configuration in the Input JSON:

```json
{
  "username": "your_username_or_email",
  "password": "your_connected_investors_password",
  "addresses": [
    "522 Acorn Way, Mt Juliet",
    "123 Main Street, Nashville"
  ],
  "skipTrace": true,
  "maxProperties": 10,
  "headless": true
}
```

### Step 3: Replace Credentials
- **username**: Your Connected Investors username or email
- **password**: Your Connected Investors login password
- **addresses**: List of property addresses you want to search

### Step 4: Test the Actor
1. Click "Start" to run a test
2. Monitor the run in the "Runs" tab
3. Check the "Dataset" tab for extracted property data
4. Review "Log" tab for any errors

## 📋 Input Parameters Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | ✅ Yes | Your Connected Investors username or email |
| `password` | string | ✅ Yes | Your Connected Investors login password |
| `addresses` | array | ✅ Yes | Property addresses to search for |
| `skipTrace` | boolean | No | Enable contact info extraction (default: true) |
| `maxProperties` | integer | No | Max properties per address (default: 10, max: 100) |
| `headless` | boolean | No | Run browser in headless mode (default: true) |

## 🎯 Dashboard Integration

The Connected Investors scraper is now available in your dashboard:
- Visit: https://as-is-app.vercel.app/
- Look for the "Connected Investors" button with the Search icon
- It's included in "Run All Scrapers" functionality

## 🔍 What Data is Extracted

### Property Information
- Property address and location details
- Price, beds, baths, square footage
- Lot size, year built, property type
- Property links and additional details

### Skip Tracing Results
- Owner names and contact information
- Email addresses found
- Phone numbers discovered
- Mailing addresses when available

## 📊 Data Storage

All extracted data is automatically stored in your Supabase database with:
- Standard property fields (address, city, county)
- Enhanced property details in JSON format
- Complete skip trace results
- Owner contact information in separate fields

## 🚨 Important Notes

1. **Security**: Since this is a private actor, your credentials are secure
2. **Rate Limiting**: The actor includes delays to respect platform limits
3. **Error Handling**: Failed searches don't stop the entire run
4. **Debugging**: Screenshots are captured for troubleshooting

## 🐛 Troubleshooting

If you encounter issues:

1. **Login Problems**: 
   - Verify credentials are correct
   - Check if account requires 2FA or captcha
   - Review login screenshots in actor logs

2. **No Results**: 
   - Verify address format is correct
   - Check if property exists in Connected Investors
   - Try different address variations

3. **Skip Trace Issues**:
   - Normal behavior - not all properties have contact info
   - Check individual property pages manually
   - Review skipTrace error messages in results

## ✨ Ready to Use!

Your Connected Investors integration is now live and ready to use. You can:
- Run it directly from Apify Console for testing
- Use the dashboard button for integrated workflows
- Include it in batch operations with other scrapers

The actor will extract property data and perform skip tracing to find owner contact information, making it perfect for real estate investment research! 🏠📞