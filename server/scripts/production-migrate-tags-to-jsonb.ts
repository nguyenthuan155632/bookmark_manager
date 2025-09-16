import 'dotenv/config';
import { db } from '../db';

/**
 * Production-ready migration script to convert tags column from text[] to jsonb
 *
 * Features:
 * - Comprehensive logging
 * - Progress tracking
 * - Rollback instructions
 * - Data verification
 * - Performance monitoring
 *
 * Run this with: npx tsx server/scripts/production-migrate-tags-to-jsonb.ts
 */
async function productionMigrateTagsToJsonb() {
  const startTime = Date.now();
  const logPrefix = '[MIGRATION]';

  try {
    console.log(`${logPrefix} 🚀 Starting production migration: text[] to jsonb for tags column`);
    console.log(`${logPrefix} ⏰ Started at: ${new Date().toISOString()}`);
    console.log(
      `${logPrefix} 🔗 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown'}\n`,
    );

    // Step 1: Pre-migration checks
    console.log(`${logPrefix} 📊 Step 1: Pre-migration checks`);

    // Check if migration is already done
    const columnCheck = await db.execute(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'domain_tags' AND column_name = 'tags'
    `);

    if (columnCheck.rows.length === 0) {
      console.log(`${logPrefix} ❌ Tags column not found in domain_tags table`);
      process.exit(1);
    }

    const currentType = columnCheck.rows[0].data_type;
    console.log(`${logPrefix}    Current column type: ${currentType}`);

    if (currentType === 'jsonb') {
      console.log(`${logPrefix} ✅ Column is already jsonb - migration not needed`);
      process.exit(0);
    }

    if (currentType !== 'ARRAY' || columnCheck.rows[0].udt_name !== 'text') {
      console.log(
        `${logPrefix} ⚠️  Unexpected column type: ${currentType} (${columnCheck.rows[0].udt_name})`,
      );
      console.log(`${logPrefix}    Proceeding with migration anyway...`);
    }

    // Check table size
    const sizeCheck = await db.execute(`
      SELECT COUNT(*) as row_count, 
             pg_size_pretty(pg_total_relation_size('domain_tags')) as table_size
      FROM domain_tags
    `);

    const stats = sizeCheck.rows[0] as any;
    console.log(`${logPrefix}    Table size: ${stats.table_size} (${stats.row_count} rows)`);

    if (parseInt(stats.row_count) > 100000) {
      console.log(
        `${logPrefix} ⚠️  Large table detected - consider running during maintenance window`,
      );
    }

    // Step 2: Create comprehensive backup
    console.log(`\n${logPrefix} 📊 Step 2: Creating comprehensive backup`);

    const backupTableName = `domain_tags_backup_${Date.now()}`;
    await db.execute(`
      CREATE TABLE ${backupTableName} AS 
      SELECT * FROM domain_tags
    `);
    console.log(`${logPrefix}    ✅ Backup table created: ${backupTableName}`);

    // Step 3: Add new jsonb column
    console.log(`\n${logPrefix} 📊 Step 3: Adding new jsonb column`);

    await db.execute(`
      ALTER TABLE domain_tags 
      ADD COLUMN IF NOT EXISTS tags_jsonb jsonb DEFAULT '[]'::jsonb
    `);
    console.log(`${logPrefix}    ✅ New jsonb column added`);

    // Step 4: Migrate data in batches (for large tables)
    console.log(`\n${logPrefix} 📊 Step 4: Migrating data`);

    const batchSize = 1000;
    let totalMigrated = 0;
    let hasMoreRows = true;

    while (hasMoreRows) {
      const batchResult = await db.execute(`
        UPDATE domain_tags 
        SET tags_jsonb = to_jsonb(tags)
        WHERE id IN (
          SELECT id FROM domain_tags 
          WHERE tags_jsonb = '[]'::jsonb
          ORDER BY id 
          LIMIT ${batchSize}
        )
      `);

      const batchCount = batchResult.rowCount || 0;
      totalMigrated += batchCount;

      console.log(
        `${logPrefix}    📦 Migrated batch: ${batchCount} rows (total: ${totalMigrated})`,
      );

      if (batchCount < batchSize) {
        hasMoreRows = false; // No more rows to migrate
      }

      // Small delay to prevent overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`${logPrefix}    ✅ Data migration completed: ${totalMigrated} rows`);

    // Step 5: Comprehensive verification
    console.log(`\n${logPrefix} 📊 Step 5: Comprehensive verification`);

    // Check row counts
    const verifyResult = await db.execute(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(tags_jsonb) as migrated_rows,
        COUNT(tags) as original_rows,
        COUNT(CASE WHEN tags_jsonb = '[]'::jsonb THEN 1 END) as empty_jsonb_rows
      FROM domain_tags
    `);

    const verifyStats = verifyResult.rows[0] as any;
    console.log(`${logPrefix}    Total rows: ${verifyStats.total_rows}`);
    console.log(`${logPrefix}    Original tags column: ${verifyStats.original_rows}`);
    console.log(`${logPrefix}    New jsonb column: ${verifyStats.migrated_rows}`);
    console.log(`${logPrefix}    Empty jsonb rows: ${verifyStats.empty_jsonb_rows}`);

    if (parseInt(verifyStats.migrated_rows) !== parseInt(verifyStats.original_rows)) {
      console.log(`${logPrefix} ❌ Row count mismatch - migration may have failed`);
      throw new Error('Row count mismatch during verification');
    }

    if (parseInt(verifyStats.empty_jsonb_rows) > 0) {
      console.log(
        `${logPrefix} ⚠️  Warning: ${verifyStats.empty_jsonb_rows} rows have empty jsonb arrays`,
      );
    }

    // Sample data verification
    const sampleResult = await db.execute(`
      SELECT id, domain, tags, tags_jsonb 
      FROM domain_tags 
      WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
      LIMIT 5
    `);

    console.log(`${logPrefix}    Sample data verification:`);
    let verificationPassed = true;

    for (const row of sampleResult.rows) {
      const originalTags = row.tags as string[];
      const jsonbTags = row.tags_jsonb as string[];

      const tagsMatch = JSON.stringify(originalTags.sort()) === JSON.stringify(jsonbTags.sort());
      console.log(
        `${logPrefix}      ${row.domain}: ${tagsMatch ? '✅' : '❌'} [${originalTags.join(', ')}]`,
      );

      if (!tagsMatch) {
        verificationPassed = false;
      }
    }

    if (!verificationPassed) {
      console.log(`${logPrefix} ❌ Data verification failed - tags don't match`);
      throw new Error('Data verification failed');
    }

    console.log(`${logPrefix}    ✅ Data verification passed`);

    // Step 6: Replace old column with new one
    console.log(`\n${logPrefix} 📊 Step 6: Replacing old column with new one`);

    await db.execute(`ALTER TABLE domain_tags DROP COLUMN tags`);
    console.log(`${logPrefix}    ✅ Old tags column dropped`);

    await db.execute(`ALTER TABLE domain_tags RENAME COLUMN tags_jsonb TO tags`);
    console.log(`${logPrefix}    ✅ New column renamed to tags`);

    // Step 7: Add constraints and indexes
    console.log(`\n${logPrefix} 📊 Step 7: Adding constraints and indexes`);

    await db.execute(`ALTER TABLE domain_tags ALTER COLUMN tags SET NOT NULL`);
    console.log(`${logPrefix}    ✅ NOT NULL constraint added`);

    // Create GIN index for better JSONB performance
    await db.execute(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS domain_tags_tags_gin_idx 
      ON domain_tags USING GIN (tags)
    `);
    console.log(`${logPrefix}    ✅ GIN index created for JSONB performance`);

    // Step 8: Final verification
    console.log(`\n${logPrefix} 📊 Step 8: Final verification`);

    const finalCheck = await db.execute(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'domain_tags' AND column_name = 'tags'
    `);

    const finalType = finalCheck.rows[0].data_type;
    console.log(`${logPrefix}    Final column type: ${finalType}`);

    if (finalType !== 'jsonb') {
      console.log(`${logPrefix} ❌ Migration failed - unexpected final type: ${finalType}`);
      throw new Error('Migration failed - incorrect final column type');
    }

    // Test API functionality
    console.log(`${logPrefix}    Testing API functionality...`);
    const apiTest = await db.execute(`
      SELECT domain, tags 
      FROM domain_tags 
      WHERE is_active = true 
      LIMIT 3
    `);

    console.log(`${logPrefix}    API test results:`);
    for (const row of apiTest.rows) {
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
      console.log(`${logPrefix}      ${row.domain}: [${tags.join(', ')}]`);
    }

    // Step 9: Clean up backup table
    console.log(`\n${logPrefix} 📊 Step 9: Cleaning up backup table`);

    await db.execute(`DROP TABLE ${backupTableName}`);
    console.log(`${logPrefix}    ✅ Backup table removed: ${backupTableName}`);

    // Migration completed
    const duration = Date.now() - startTime;
    const durationMinutes = Math.round((duration / 1000 / 60) * 100) / 100;

    console.log(`\n${logPrefix} 🎉 Migration completed successfully!`);
    console.log(`${logPrefix} ⏰ Duration: ${durationMinutes} minutes`);
    console.log(`${logPrefix} 📊 Rows migrated: ${totalMigrated}`);
    console.log(
      `${logPrefix} 🔗 Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Unknown'}`,
    );

    console.log(`\n${logPrefix} 📋 Summary:`);
    console.log(`${logPrefix}    ✅ Tags column migrated from text[] to jsonb`);
    console.log(`${logPrefix}    ✅ Data integrity preserved (${totalMigrated} rows)`);
    console.log(`${logPrefix}    ✅ Performance indexes created`);
    console.log(`${logPrefix}    ✅ Backup table cleaned up`);
    console.log(`${logPrefix}    ✅ NOT NULL constraint maintained`);

    console.log(`\n${logPrefix} 🚀 Next steps:`);
    console.log(`${logPrefix}    1. Deploy updated application code`);
    console.log(`${logPrefix}    2. Monitor application performance`);
    console.log(`${logPrefix}    3. Verify domain suggestions work`);
    console.log(`${logPrefix}    4. Run comprehensive tests`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const durationMinutes = Math.round((duration / 1000 / 60) * 100) / 100;

    console.error(`\n${logPrefix} ❌ Migration failed after ${durationMinutes} minutes`);
    console.error(`${logPrefix} Error: ${error}`);

    console.log(`\n${logPrefix} 🔄 Rollback instructions:`);
    console.log(`${logPrefix}    1. Check if backup table exists:`);
    console.log(
      `${logPrefix}       SELECT tablename FROM pg_tables WHERE tablename LIKE 'domain_tags_backup%';`,
    );
    console.log(`${logPrefix}    2. If backup exists, restore:`);
    console.log(`${logPrefix}       DROP TABLE domain_tags;`);
    console.log(`${logPrefix}       ALTER TABLE domain_tags_backup_XXXXX RENAME TO domain_tags;`);
    console.log(`${logPrefix}    3. Or restore from full database backup`);

    process.exit(1);
  }
}

// Run the migration
productionMigrateTagsToJsonb()
  .then(() => {
    console.log('\n[MIGRATION] Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[MIGRATION] Migration failed:', error);
    process.exit(1);
  });
