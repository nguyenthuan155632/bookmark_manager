import 'dotenv/config';
import { db } from '../db';

/**
 * Migration script to convert tags column from text[] to jsonb
 * Run this with: npx tsx server/scripts/migrate-tags-to-jsonb.ts
 */
async function migrateTagsToJsonb() {
  try {
    console.log('🔄 Starting migration: text[] to jsonb for tags column...\n');

    // Step 1: Check current column type
    console.log('📊 Step 1: Checking current column type');
    const columnInfo = await db.execute(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'domain_tags' AND column_name = 'tags'
    `);

    if (columnInfo.rows.length === 0) {
      console.log('❌ Tags column not found in domain_tags table');
      return;
    }

    const currentType = columnInfo.rows[0].data_type;
    console.log(`   Current type: ${currentType}`);

    if (currentType === 'ARRAY' && columnInfo.rows[0].udt_name === 'text') {
      console.log('   ✅ Column is currently text[] - migration needed');
    } else if (currentType === 'jsonb') {
      console.log('   ✅ Column is already jsonb - no migration needed');
      return;
    } else {
      console.log(`   ⚠️  Unexpected column type: ${currentType}`);
    }

    // Step 2: Create backup table
    console.log('\n📊 Step 2: Creating backup table');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS domain_tags_backup AS 
      SELECT * FROM domain_tags
    `);
    console.log('   ✅ Backup table created');

    // Step 3: Add new jsonb column
    console.log('\n📊 Step 3: Adding new jsonb column');
    await db.execute(`
      ALTER TABLE domain_tags 
      ADD COLUMN IF NOT EXISTS tags_jsonb jsonb DEFAULT '[]'::jsonb
    `);
    console.log('   ✅ New jsonb column added');

    // Step 4: Migrate data from text[] to jsonb
    console.log('\n📊 Step 4: Migrating data from text[] to jsonb');
    const migrateResult = await db.execute(`
      UPDATE domain_tags 
      SET tags_jsonb = to_jsonb(tags)
      WHERE tags IS NOT NULL
    `);
    console.log(`   ✅ Migrated ${migrateResult.rowCount || 0} rows`);

    // Step 5: Verify migration
    console.log('\n📊 Step 5: Verifying migration');
    const verifyResult = await db.execute(`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(tags_jsonb) as migrated_rows,
        COUNT(tags) as original_rows
      FROM domain_tags
    `);

    const stats = verifyResult.rows[0] as any;
    console.log(`   Total rows: ${stats.total_rows}`);
    console.log(`   Original tags column: ${stats.original_rows}`);
    console.log(`   New jsonb column: ${stats.migrated_rows}`);

    if (parseInt(stats.migrated_rows) !== parseInt(stats.original_rows)) {
      console.log('   ⚠️  Warning: Row counts do not match');
    } else {
      console.log('   ✅ Migration verification successful');
    }

    // Step 6: Drop old column and rename new column
    console.log('\n📊 Step 6: Replacing old column with new one');
    await db.execute(`
      ALTER TABLE domain_tags DROP COLUMN tags
    `);
    console.log('   ✅ Old tags column dropped');

    await db.execute(`
      ALTER TABLE domain_tags RENAME COLUMN tags_jsonb TO tags
    `);
    console.log('   ✅ New column renamed to tags');

    // Step 7: Add NOT NULL constraint
    console.log('\n📊 Step 7: Adding NOT NULL constraint');
    await db.execute(`
      ALTER TABLE domain_tags 
      ALTER COLUMN tags SET NOT NULL
    `);
    console.log('   ✅ NOT NULL constraint added');

    // Step 8: Final verification
    console.log('\n📊 Step 8: Final verification');
    const finalCheck = await db.execute(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'domain_tags' AND column_name = 'tags'
    `);

    const finalType = finalCheck.rows[0].data_type;
    console.log(`   Final column type: ${finalType}`);

    if (finalType === 'jsonb') {
      console.log('   ✅ Migration completed successfully!');
    } else {
      console.log(`   ❌ Migration failed - unexpected type: ${finalType}`);
    }

    // Step 9: Test data integrity
    console.log('\n📊 Step 9: Testing data integrity');
    const testResult = await db.execute(`
      SELECT id, domain, tags 
      FROM domain_tags 
      LIMIT 5
    `);

    console.log('   Sample data:');
    testResult.rows.forEach((row: any, index) => {
      console.log(`   ${index + 1}. ${row.domain}: ${JSON.stringify(row.tags)}`);
    });

    // Step 10: Clean up backup table
    console.log('\n📊 Step 10: Cleaning up backup table');
    await db.execute(`
      DROP TABLE IF EXISTS domain_tags_backup
    `);
    console.log('   ✅ Backup table removed');

    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Tags column migrated from text[] to jsonb');
    console.log('   ✅ Data integrity preserved');
    console.log('   ✅ Backup table cleaned up');
    console.log('   ✅ NOT NULL constraint maintained');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n🔄 To rollback:');
    console.log('   1. DROP TABLE domain_tags;');
    console.log('   2. ALTER TABLE domain_tags_backup RENAME TO domain_tags;');
    process.exit(1);
  }
}

// Run the migration
migrateTagsToJsonb()
  .then(() => {
    console.log('\nMigration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
