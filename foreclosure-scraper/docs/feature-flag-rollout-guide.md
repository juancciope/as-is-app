# vNext Feature Flag Rollout Guide

This guide provides comprehensive instructions for safely rolling out the vNext normalization features using feature flags with zero downtime.

## Overview

The vNext rollout uses a phased approach with feature flags to ensure:
- **Zero downtime** during deployment
- **Instant rollback** capabilities 
- **Gradual user exposure** to new features
- **Comprehensive monitoring** at each phase
- **Data integrity** preservation

## Prerequisites

Before starting the rollout:

1. **Schema Migration Applied**: Run `npm run migration:verify` to ensure vNext tables exist
2. **Data Migration Complete**: Run `npm run backfill:apply` if migrating existing data
3. **Environment Variables**: Configure all required feature flags
4. **Monitoring Setup**: Prepare alerting and monitoring systems
5. **Staging Testing**: Test all phases in staging environment first

## Rollout Phases

### Phase 1: Safe Deployment 🟢

**Objective**: Deploy new code with legacy mode - no user impact

```bash
# Environment Configuration
USE_LEGACY=1
USE_VNEXT_FILTERS=0
ENABLE_AI_ANALYSIS=0
VNEXT_DEBUG=1

# Execute Phase 1
npm run rollout:phase1
```

**What This Does**:
- Deploys vNext code but keeps legacy system active
- Enables debug logging for monitoring
- No changes to user experience
- Validates that deployment was successful

**Validation Checks**:
- ✅ Legacy API still working
- ✅ Database connectivity maintained
- ✅ vNext tables accessible
- ✅ Configuration valid

**Success Criteria**: All validation checks pass, no errors in logs

---

### Phase 2: vNext APIs Testing 🟡

**Objective**: Validate new APIs work alongside legacy (internal testing)

```bash
# Environment Configuration (same as Phase 1)
USE_LEGACY=1
USE_VNEXT_FILTERS=0
ENABLE_AI_ANALYSIS=0
VNEXT_DEBUG=1

# Execute Phase 2
npm run rollout:phase2
```

**What This Does**:
- Tests that vNext APIs can be called internally
- Validates skip trace dual-write functionality  
- Ensures data consistency between systems
- No user-facing changes yet

**Validation Checks**:
- ✅ Legacy API still working
- ✅ vNext APIs responding correctly
- ✅ Skip trace dual-write working
- ✅ Data consistency maintained

**Manual Testing**:
```bash
# Test vNext APIs directly (internal)
curl http://localhost:3000/api/properties
curl http://localhost:3000/api/skip-trace -X POST -d '{"propertyId":"test"}'
```

---

### Phase 3: New Dashboard Filters 🟡

**Objective**: Enable new Nashville/Mt. Juliet filters in dashboard

```bash
# Environment Configuration
USE_LEGACY=1
USE_VNEXT_FILTERS=1  # 👈 NEW: Enable new filters
ENABLE_AI_ANALYSIS=0
VNEXT_DEBUG=0

# Execute Phase 3
npm run rollout:phase3
```

**What This Does**:
- Shows separate Nashville/Mt. Juliet filter checkboxes
- Data still comes from legacy table
- First user-visible change
- Easy rollback if issues occur

**Validation Checks**:
- ✅ Legacy API still working
- ✅ Dashboard loads without errors
- ✅ New filters appear and function
- ✅ User experience enhanced (not broken)

**Rollback Plan**:
```bash
# Immediate rollback if needed
USE_VNEXT_FILTERS=0
# Restart application
```

---

### Phase 4: Full vNext Cutover 🔴

**Objective**: Switch to vNext schema completely

```bash
# Environment Configuration
USE_LEGACY=0          # 👈 MAJOR: Switch to vNext
USE_VNEXT_FILTERS=1
ENABLE_AI_ANALYSIS=0
VNEXT_DEBUG=0

# Execute Phase 4
npm run rollout:phase4
```

**What This Does**:
- **Major change**: All data now comes from vNext tables
- Uses normalized property/distress event structure
- Skip trace writes to vNext schema
- Performance and functionality improvements

**Validation Checks**:
- ✅ vNext APIs working under load
- ✅ Skip trace functionality working
- ✅ Dashboard performance acceptable
- ✅ Data integrity maintained
- ✅ No errors in application logs

**Rollback Plan**:
```bash
# Emergency rollback
USE_LEGACY=1
USE_VNEXT_FILTERS=0
# Restart application immediately
```

**Critical Monitoring**: Watch for 30+ minutes after deployment

---

### Phase 5: AI Analysis (Optional) 🟦

**Objective**: Enable AI-powered property analysis

```bash
# Environment Configuration
USE_LEGACY=0
USE_VNEXT_FILTERS=1
ENABLE_AI_ANALYSIS=1  # 👈 NEW: Enable AI features
VNEXT_DEBUG=0

# Prerequisites
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o-mini

# Execute Phase 5
npm run rollout:phase5
```

**What This Does**:
- Enables AI analysis endpoints
- Adds property scoring and insights
- Optional enhancement feature
- Easy to disable if not needed

**Validation Checks**:
- ✅ AI analysis endpoints working
- ✅ OpenAI API key valid
- ✅ Analysis features functional

---

## Rollout Commands

### Quick Reference

```bash
# Show rollout strategy and guidance
npm run rollout:guide

# Execute specific phases
npm run rollout:phase1    # Safe deployment
npm run rollout:phase2    # API testing
npm run rollout:phase3    # New filters
npm run rollout:phase4    # Full cutover
npm run rollout:phase5    # AI analysis

# Monitoring
npm run monitor:start     # Continuous monitoring
npm run monitor:check     # Single health check
```

### Phase Execution

Each phase script will:
1. **Display configuration** - Show required environment variables
2. **Run validation checks** - Verify system health
3. **Provide recommendations** - Proceed, investigate, or rollback
4. **Show next steps** - Clear guidance for next phase

Example output:
```
🚀 Executing Phase 1: Safe Deployment
📋 Deploy with legacy mode - no user impact
🔧 Feature Flags:
   USE_LEGACY=1
   USE_VNEXT_FILTERS=0
   ENABLE_AI_ANALYSIS=0

🔍 Running validation checks...
✅ legacy_api_working: Legacy API accessible
✅ database_connectivity: Database connection established
✅ vnext_tables_accessible: All vNext tables accessible
✅ configuration_valid: Configuration valid

✅ Phase 1 completed successfully! (4/4 checks passed)
   Ready for Phase 2: npm run rollout:phase2
```

---

## Monitoring and Alerting

### Continuous Monitoring

Start monitoring before beginning rollout:

```bash
# Start continuous monitoring (5-minute intervals)
npm run monitor:start

# Custom interval monitoring
npm run monitor:start 2  # Check every 2 minutes
```

### Health Metrics Tracked

- **Database Performance**: Response times, connectivity
- **API Availability**: Legacy and vNext endpoint status  
- **Feature Flag Status**: Current rollout phase
- **Data Consistency**: Legacy vs vNext record counts
- **Error Rates**: Application and skip trace failures
- **Performance**: Query times and response latency

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Database Response Time | > 3 seconds | > 5 seconds |
| API Error Rate | > 5% | > 10% |
| Skip Trace Failures | > 10% | > 25% |
| Data Inconsistency | Any mismatch | Data corruption |

### Single Health Check

```bash
# One-time health check
npm run monitor:check

# Returns exit codes:
# 0 = Healthy
# 1 = Critical issues
# 2 = Warning issues
```

---

## Rollback Procedures

### Immediate Rollback

For any critical issues during rollout:

```bash
# Emergency rollback to legacy mode
USE_LEGACY=1
USE_VNEXT_FILTERS=0
ENABLE_AI_ANALYSIS=0

# Restart application
npm run dev  # or your deployment restart command
```

### Phase-Specific Rollbacks

#### Phase 3 Rollback (New Filters)
```bash
USE_VNEXT_FILTERS=0
# Restart application
```

#### Phase 4 Rollback (Full Cutover)
```bash
USE_LEGACY=1
USE_VNEXT_FILTERS=0
# Restart application
```

#### Phase 5 Rollback (AI Analysis)
```bash
ENABLE_AI_ANALYSIS=0
# Restart application
```

### Rollback Validation

After rollback:
```bash
# Verify rollback successful
npm run monitor:check
npm run migration:verify
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database credentials
npm run vnext:config

# Verify migration applied
npm run migration:verify
```

#### API Endpoint Not Found (404)
- Ensure application server is running: `npm run dev`
- Check that new endpoints are deployed
- Verify feature flags are set correctly

#### Performance Issues
```bash
# Check query performance
npm run monitor:check

# Review database indexes
npm run migration:verify
```

#### Data Consistency Issues
```bash
# Verify data integrity
npm run migration:verify

# Check backfill results
npm run backfill:dry-run
```

### Getting Help

1. **Check Logs**: Application and database logs for detailed errors
2. **Run Diagnostics**: `npm run migration:verify` for comprehensive validation
3. **Monitor Health**: `npm run monitor:check` for current system status
4. **Review Configuration**: `npm run vnext:config` for environment validation

---

## Best Practices

### Before Rollout

- [ ] Test all phases in staging environment
- [ ] Backup production database
- [ ] Prepare monitoring dashboards
- [ ] Schedule rollout during low-traffic periods
- [ ] Notify team of rollout schedule
- [ ] Prepare rollback instructions

### During Rollout

- [ ] Execute one phase at a time
- [ ] Wait for validation before proceeding
- [ ] Monitor system health continuously
- [ ] Keep rollback instructions ready
- [ ] Document any issues encountered

### After Rollout

- [ ] Monitor for 24+ hours after final phase
- [ ] Verify all functionality works correctly
- [ ] Update documentation with lessons learned
- [ ] Plan legacy system deprecation
- [ ] Celebrate successful migration! 🎉

---

## Support and Escalation

### Warning Signs (Investigate)
- API response times > 3 seconds
- Skip trace failure rate > 10%
- Any data consistency warnings
- User-reported issues

### Critical Issues (Rollback Immediately)
- Database connectivity failures
- API error rates > 10%
- Data corruption detected
- Application crashes/errors

### Emergency Contacts
- Development Team: [Configure your team contacts]
- Database Administrator: [Configure DBA contacts]  
- Infrastructure Team: [Configure infrastructure contacts]

---

## Post-Rollout Activities

### Phase 4 Complete Checklist
- [ ] Legacy system still functional (safety net)
- [ ] Performance monitoring shows acceptable metrics
- [ ] User feedback is positive
- [ ] Data integrity verified
- [ ] Error rates within normal limits

### Future Steps
1. **Monitor Performance**: Watch system for 1-2 weeks
2. **Gather Feedback**: Collect user experience feedback
3. **Optimize Performance**: Tune queries and indexes as needed
4. **Plan Legacy Deprecation**: Schedule legacy table removal
5. **Documentation Updates**: Update API docs and user guides

The vNext rollout provides a robust, zero-downtime path to the normalized schema with comprehensive monitoring, validation, and rollback capabilities at every step.