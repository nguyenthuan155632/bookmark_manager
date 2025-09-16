# Production Migration Guide

## Overview

This guide explains how to safely migrate database schema changes in production, specifically for the `tags` column migration from `text[]` to `jsonb` in the `domain_tags` table.

## 🎯 **Migration Strategy: Zero-Downtime Approach**

### Phase 1: Preparation

1. **Backup Production Database**

   ```bash
   # Create full database backup
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

   # Or use your cloud provider's backup feature
   # AWS RDS: Create manual snapshot
   # Google Cloud SQL: Create backup
   # Azure Database: Create backup
   ```

2. **Test Migration on Staging**
   ```bash
   # Run migration on staging environment first
   npm run db:push
   npx tsx server/scripts/migrate-tags-to-jsonb.ts
   ```

### Phase 2: Production Migration

#### Option A: Zero-Downtime Migration (Recommended)

```bash
# 1. Deploy new code with backward compatibility
npm run build
npm run deploy:full

# 2. Run migration script
npx tsx server/scripts/migrate-tags-to-jsonb.ts

# 3. Verify migration success
npx tsx server/scripts/test-domain-suggest.ts

# 4. Deploy updated code (if any breaking changes)
npm run build
npm run deploy:full
```

#### Option B: Maintenance Window Migration

```bash
# 1. Put application in maintenance mode
# (Update your load balancer/health check)

# 2. Run migration
npx tsx server/scripts/migrate-tags-to-jsonb.ts

# 3. Deploy new code
npm run build
npm run deploy:full

# 4. Verify and remove maintenance mode
```

## 🔧 **Migration Script Details**

### What the Script Does

1. **Creates Backup**: `domain_tags_backup` table
2. **Adds New Column**: `tags_jsonb` with `jsonb` type
3. **Migrates Data**: Converts `text[]` to `jsonb` format
4. **Verifies Data**: Ensures all rows migrated correctly
5. **Replaces Column**: Drops old column, renames new one
6. **Adds Constraints**: Applies `NOT NULL` constraint
7. **Cleans Up**: Removes backup table

### Safety Features

- ✅ **Backup Creation**: Full table backup before changes
- ✅ **Data Verification**: Row count and data integrity checks
- ✅ **Rollback Instructions**: Clear rollback steps if needed
- ✅ **Idempotent**: Can be run multiple times safely
- ✅ **Transaction Safety**: Each step is atomic

## 🚨 **Rollback Plan**

If migration fails, you can rollback:

```sql
-- 1. Restore from backup
DROP TABLE domain_tags;
ALTER TABLE domain_tags_backup RENAME TO domain_tags;

-- 2. Or restore from full database backup
psql $DATABASE_URL < backup_20241201_120000.sql
```

## 📊 **Monitoring During Migration**

### Key Metrics to Watch

1. **Database Performance**

   ```sql
   -- Check for long-running queries
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query
   FROM pg_stat_activity
   WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes';
   ```

2. **Table Locks**

   ```sql
   -- Check for table locks
   SELECT * FROM pg_locks WHERE relation = 'domain_tags'::regclass;
   ```

3. **Application Health**
   - Monitor error rates
   - Check response times
   - Verify domain suggestions still work

## 🔄 **CI/CD Integration**

### GitHub Actions Example

```yaml
name: Production Migration
on:
  workflow_dispatch:
    inputs:
      migration_type:
        description: 'Migration type'
        required: true
        default: 'tags-to-jsonb'

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migration
        run: npx tsx server/scripts/migrate-tags-to-jsonb.ts
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}

      - name: Verify migration
        run: npx tsx server/scripts/test-domain-suggest.ts
        env:
          DATABASE_URL: ${{ secrets.PRODUCTION_DATABASE_URL }}
```

## 🛡️ **Best Practices**

### Before Migration

1. **Test on Staging**: Always test migrations on staging first
2. **Backup Everything**: Create full database backup
3. **Monitor Resources**: Ensure sufficient disk space and memory
4. **Plan Rollback**: Have rollback plan ready
5. **Notify Team**: Inform team about maintenance window

### During Migration

1. **Monitor Progress**: Watch migration logs closely
2. **Check Performance**: Monitor database performance
3. **Verify Data**: Run verification scripts
4. **Test Application**: Ensure app still works

### After Migration

1. **Verify Data**: Run comprehensive tests
2. **Monitor Performance**: Watch for any performance issues
3. **Clean Up**: Remove backup tables after verification
4. **Update Documentation**: Update any relevant docs

## 📈 **Performance Considerations**

### JSONB Benefits

- **Better Performance**: JSONB is more efficient than text arrays
- **Rich Queries**: Can use PostgreSQL JSON operators
- **Indexing**: Can create GIN indexes on JSONB fields
- **Validation**: Better type safety at database level

### Index Recommendations

```sql
-- Create GIN index for better JSONB performance
CREATE INDEX CONCURRENTLY domain_tags_tags_gin_idx
ON domain_tags USING GIN (tags);

-- Create index for specific JSONB operations
CREATE INDEX CONCURRENTLY domain_tags_tags_array_idx
ON domain_tags USING GIN ((tags::text[]));
```

## 🔍 **Verification Checklist**

After migration, verify:

- [ ] All domain tags are accessible
- [ ] Domain suggestions work in bookmark modal
- [ ] API endpoints return correct data
- [ ] No TypeScript errors
- [ ] Performance is acceptable
- [ ] Backup table is cleaned up
- [ ] Application logs show no errors

## 📞 **Emergency Contacts**

- **Database Admin**: [Your DB admin contact]
- **DevOps Team**: [Your DevOps contact]
- **On-Call Engineer**: [Your on-call contact]

## 📝 **Migration Log Template**

```
Migration: tags column text[] to jsonb
Date: [DATE]
Duration: [DURATION]
Rows Migrated: [COUNT]
Issues: [ANY ISSUES]
Rollback Required: [YES/NO]
Verification: [PASS/FAIL]
```

---

**Remember**: Always test migrations on staging first and have a rollback plan ready!
