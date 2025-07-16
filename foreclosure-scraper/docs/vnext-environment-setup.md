# vNext Environment Setup Guide

This guide covers the environment variables and feature flags introduced in the vNext normalization update.

## Quick Start

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your actual values for the required variables (see sections below)

3. Start with legacy mode to ensure no disruption:
   ```bash
   USE_LEGACY=1
   USE_VNEXT_FILTERS=0
   ENABLE_AI_ANALYSIS=0
   ```

## Feature Flags

### Core Feature Flags

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_LEGACY` | `1` | Use legacy `foreclosure_data` table instead of normalized schema |
| `USE_VNEXT_FILTERS` | `0` | Show separate Nashville/Mt. Juliet filters in dashboard |
| `ENABLE_AI_ANALYSIS` | `0` | Enable AI-powered property analysis (requires OpenAI API key) |

### vNext Features

| Variable | Default | Description |
|----------|---------|-------------|
| `VNEXT_SCORING_ENABLED` | `1` | Enable property scoring system |
| `VNEXT_DEBUG` | `0` | Enable verbose logging for vNext features |
| `VNEXT_MIGRATION_DRY_RUN` | `1` | Test migrations without making changes |

## Configuration Variables

### Target Counties and Geography

| Variable | Default | Description |
|----------|---------|-------------|
| `VNEXT_TARGET_COUNTIES` | `Davidson,Sumner,Wilson` | Counties to prioritize in scoring |
| `VNEXT_MAX_DRIVE_TIME_MIN` | `30` | Maximum drive time for proximity scoring |
| `VNEXT_NASHVILLE_LAT` | `36.1627` | Nashville latitude for distance calculations |
| `VNEXT_NASHVILLE_LON` | `-86.7816` | Nashville longitude for distance calculations |
| `VNEXT_MTJULIET_LAT` | `36.2009` | Mt. Juliet latitude for distance calculations |
| `VNEXT_MTJULIET_LON` | `-86.5186` | Mt. Juliet longitude for distance calculations |

### Performance and Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `API_RATE_LIMIT` | `100` | API requests per minute limit |
| `MAX_CONCURRENT_SKIP_TRACES` | `5` | Maximum concurrent skip trace operations |

## Required Variables

These must be set for the application to function:

### Database (Required)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### Apify Integration (Required)
```bash
APIFY_API_TOKEN=your_apify_api_token
```

### Connected Investors (Required for Skip Trace)
```bash
CONNECTED_INVESTORS_USERNAME=your_username
CONNECTED_INVESTORS_PASSWORD=your_password
```

## Optional Variables

### AI Analysis (Optional)
```bash
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini
```

### External Services (Optional)
```bash
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
POWERBI_RESOURCE_KEY=your_powerbi_key
```

### Monitoring (Optional)
```bash
ENABLE_MONITORING=0
WEBHOOK_URL=your_webhook_url
```

## Migration Strategy

### Phase 1: Deploy with Legacy Mode
```bash
USE_LEGACY=1
USE_VNEXT_FILTERS=0
ENABLE_AI_ANALYSIS=0
```

### Phase 2: Enable New Filters
```bash
USE_LEGACY=1
USE_VNEXT_FILTERS=1
ENABLE_AI_ANALYSIS=0
```

### Phase 3: Full vNext Cutover
```bash
USE_LEGACY=0
USE_VNEXT_FILTERS=1
ENABLE_AI_ANALYSIS=1  # Optional
```

## Troubleshooting

### Environment Validation

The system will validate environment variables on startup. Check the logs for:
- Missing required variables
- Invalid values
- Configuration warnings

### Feature Flag Issues

If you encounter issues with feature flags:

1. Check that the variable is set correctly (use `1` for true, `0` for false)
2. Restart the application after changing environment variables
3. Check the console for configuration debug output (when `VNEXT_DEBUG=1`)

### Common Issues

**"Missing required environment variable"**
- Ensure all required variables are set in your `.env.local` file
- Check that variable names match exactly (case-sensitive)

**"Invalid configuration"**
- Verify numeric values are valid numbers
- Check that county names don't have extra spaces
- Ensure coordinate values are valid decimal numbers

**Skip trace not working**
- Verify `CONNECTED_INVESTORS_USERNAME` and `CONNECTED_INVESTORS_PASSWORD` are correct
- Check that `APIFY_API_TOKEN` is valid and has permissions
- Ensure `APIFY_ACTOR_ID_SKIP_TRACE` points to the correct actor

## Development Tips

### Testing Configuration Changes

1. Set `VNEXT_DEBUG=1` to see detailed configuration logging
2. Use `VNEXT_MIGRATION_DRY_RUN=1` to test migrations safely
3. Monitor the console for validation warnings

### Performance Tuning

- Adjust `API_RATE_LIMIT` based on your usage patterns
- Increase `MAX_CONCURRENT_SKIP_TRACES` if you have high volume
- Monitor database performance when switching from legacy mode

### Rollback Strategy

If issues occur, immediately set:
```bash
USE_LEGACY=1
USE_VNEXT_FILTERS=0
```

This will revert to the original system behavior while you troubleshoot.

## Support

For issues with vNext configuration:
1. Check the validation output in the console
2. Verify all required variables are set
3. Review the feature flag settings
4. Check the application logs for detailed error messages

Remember: The system is designed to be backwards compatible. When in doubt, use legacy mode.