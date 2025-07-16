# vNext Backfill Guide

This guide covers the data migration process from the legacy `foreclosure_data` table to the new normalized vNext schema.

## Overview

The backfill process migrates existing foreclosure data into the new normalized structure:

- **Properties**: Deduplicated by normalized address
- **Distress Events**: One record per original foreclosure entry
- **Contacts**: Extracted from legacy contact columns into JSON arrays
- **Property-Contact Relationships**: Links contacts to properties with roles
- **Lead Pipeline**: Assigns stages based on contact enrichment status

## Migration Flow

```
Legacy foreclosure_data
        ↓
    Address Normalization & Deduplication
        ↓
    Properties (1 per unique address)
        ↓
    Distress Events (1 per legacy record)
        ↓
    Contacts (JSON arrays for phones/emails)
        ↓
    Property-Contact Relationships
        ↓
    Lead Pipeline (stage based on enrichment)
```

## Prerequisites

1. **Schema Migration**: Ensure the vNext schema is applied
2. **Environment Setup**: Configure `.env.local` with database credentials
3. **Dependencies**: Install required packages with `npm install`

## Testing the Migration

### Step 1: Run Migration Tests

```bash
# Test the migration logic with sample data
npm run backfill:test
```

This will:
- Create test data similar to your production data
- Test address normalization logic
- Verify distance calculations
- Test contact extraction
- Validate pipeline stage assignment

### Step 2: Verify Test Results

Expected test output:
```
✅ Address normalization working
✅ Distance calculation working  
✅ Contact extraction working
✅ Pipeline logic working
```

## Running the Migration

### Step 1: Dry Run (Recommended)

```bash
# Test migration without making changes
npm run backfill:dry-run
```

This will:
- Analyze your legacy data
- Show what would be migrated
- Display statistics and validation
- Report any potential issues

### Step 2: Review Dry Run Output

Look for:
- **Record counts**: Legacy vs. expected new records
- **Unique addresses**: Properties to be created
- **Contact information**: How many contacts will be extracted
- **Validation checks**: All should pass ✅
- **Error messages**: Review any issues

### Step 3: Apply Migration

```bash
# Perform actual migration
npm run backfill:apply
```

⚠️ **Important**: This will modify your database. Ensure you have backups!

## Migration Details

### Address Normalization

The script normalizes addresses to deduplicate properties:

```typescript
// These addresses are considered the same:
"123 Main Street, Nashville, TN 37201"
"123 Main St, Nashville, TN 37201"
"123 main street nashville tn 37201"
"123 Main St., Nashville, Tennessee 37201"

// Normalized to:
"123 main nashville tn 37201"
```

### Distance Calculations

For each property, the script calculates:

- **Nashville Distance**: Miles from Nashville hub (36.1627, -86.7816)
- **Mt. Juliet Distance**: Miles from Mt. Juliet hub (36.2009, -86.5186)
- **Proximity Flags**: Within 30 minutes drive time for each hub

### Contact Migration

Legacy individual columns are converted to JSON arrays:

```javascript
// Legacy columns:
owner_email_1: "john@example.com"
owner_email_2: "john.alt@example.com"
owner_phone_1: "615-555-0123"

// Becomes JSON array:
emails: [
  { email: "john@example.com", label: "primary", verified: false, source: "ci_legacy" },
  { email: "john.alt@example.com", label: "secondary", verified: false, source: "ci_legacy" }
]
phones: [
  { number: "615-555-0123", label: "primary", verified: false, source: "ci_legacy" }
]
```

### Pipeline Stages

Properties are assigned initial pipeline stages:

- **`enriched`**: Has at least one email or phone number
- **`new`**: No contact information available

## Validation

The migration includes comprehensive validation:

### Record Count Validation
- Legacy records == Distress events created
- Unique addresses == Properties created
- Properties == Lead pipeline entries

### Data Integrity
- All foreign key relationships are valid
- Contact information is properly formatted
- Distance calculations are reasonable
- Pipeline stages are assigned correctly

## Expected Results

Based on typical foreclosure data:

```
📊 Sample Migration Results:
   Legacy records: 1,547
   Unique addresses: 1,203
   Properties created: 1,203
   Distress events created: 1,547
   Contacts created: 892
   Property-contact relationships: 892
   Lead pipeline entries: 1,203

✅ Validation Checks:
   Legacy records == Distress events: ✅
   Unique addresses == Properties: ✅
   Properties == Lead pipeline: ✅
```

## Troubleshooting

### Common Issues

**"No legacy records found"**
- Check that the `foreclosure_data` table exists and has data
- Verify database connection and credentials
- Ensure the legacy table name is correct in configuration

**"Address normalization failed"**
- Check for null or empty address values
- Review address formats for unusual characters
- Some addresses may be skipped if they cannot be normalized

**"Distance calculation errors"**
- Ensure hub coordinates are correctly configured
- Check that latitude/longitude values are valid
- Distance calculations may fail for invalid coordinates

**"Contact extraction issues"**
- Verify that contact columns exist in the legacy table
- Check for data type mismatches
- Some contacts may be skipped if data is malformed

**"Foreign key constraint violations"**
- Ensure the vNext schema migration was applied successfully
- Check that all required tables exist
- Verify database permissions

### Error Recovery

If the migration fails partway through:

1. **Check the error message** - Usually indicates the specific issue
2. **Review validation output** - Shows what was processed successfully
3. **Fix the underlying issue** - Update configuration or data as needed
4. **Clean up partial migration** - Remove any partially created records
5. **Re-run the migration** - The script is designed to be idempotent

### Rolling Back

If you need to rollback the migration:

```sql
-- CAUTION: This will delete all migrated data
TRUNCATE TABLE property_contacts;
TRUNCATE TABLE skip_trace_runs;
TRUNCATE TABLE lead_pipeline;
TRUNCATE TABLE contacts;
TRUNCATE TABLE distress_events;
TRUNCATE TABLE properties;
```

The legacy `foreclosure_data` table is never modified during migration.

## Performance Considerations

### Large Datasets

For datasets with >10,000 records:

1. **Monitor memory usage** - The script loads all data into memory
2. **Consider batching** - Process data in smaller chunks if needed
3. **Database performance** - Ensure your database can handle the load
4. **Time allocation** - Large migrations may take 10-30 minutes

### Optimization Tips

- **Run during off-peak hours** - Reduces impact on live system
- **Increase database timeouts** - For large datasets
- **Monitor database logs** - Watch for performance issues
- **Test with subsets** - Verify logic with smaller data samples

## Post-Migration Steps

After successful migration:

1. **Verify data integrity** - Run spot checks on migrated data
2. **Test API endpoints** - Ensure they work with new schema
3. **Update feature flags** - Gradually enable vNext features
4. **Monitor performance** - Watch for any issues
5. **Document changes** - Update team on new data structure

## Next Steps

Once backfill is complete:

1. **Enable vNext APIs** - Start using the new property endpoints
2. **Update frontend** - Gradually migrate UI components
3. **Test skip trace** - Verify dual-write functionality
4. **Monitor metrics** - Track system performance
5. **Plan legacy deprecation** - Schedule removal of old table

## Support

For issues with the backfill process:

1. Check the validation output for specific errors
2. Review the troubleshooting section
3. Test with sample data using `npm run backfill:test`
4. Verify your environment configuration
5. Check database logs for detailed error messages

The backfill process is designed to be safe and reversible. Always test thoroughly before applying to production data.