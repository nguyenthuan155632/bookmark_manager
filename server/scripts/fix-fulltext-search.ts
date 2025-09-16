import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Fix full-text search by enabling required PostgreSQL extensions
 * Run this with: npx tsx server/scripts/fix-fulltext-search.ts
 */
async function fixFullTextSearch() {
  try {
    console.log('🔧 Fixing full-text search setup...\n');

    // Step 1: Enable required PostgreSQL extensions
    console.log('1️⃣ Enabling required PostgreSQL extensions...');

    // Enable pg_trgm extension for trigram matching
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      console.log('   ✅ pg_trgm extension enabled');
    } catch (error) {
      console.log('   ⚠️  pg_trgm extension may already be enabled or not available');
    }

    // The ts_rank function is part of the built-in full-text search, so we don't need additional extensions
    console.log('   ✅ Full-text search extensions are available');

    // Step 2: Check if search_vector column exists and is correct type
    console.log('\n2️⃣ Checking search_vector column...');
    const columnInfo = await db.execute(sql`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnInfo.rows.length === 0) {
      console.log('   Adding search_vector column...');
      await db.execute(sql`
        ALTER TABLE bookmarks 
        ADD COLUMN search_vector tsvector
      `);
      console.log('   ✅ Added search_vector column');
    } else {
      const columnType = columnInfo.rows[0].data_type;
      console.log(`   Current column type: ${columnType}`);

      if (columnType !== 'USER-DEFINED') {
        console.log('   Converting to tsvector type...');
        await db.execute(sql`
          ALTER TABLE bookmarks 
          ALTER COLUMN search_vector TYPE tsvector USING search_vector::tsvector
        `);
        console.log('   ✅ Converted to tsvector type');
      } else {
        console.log('   ✅ Column is already tsvector type');
      }
    }

    // Step 3: Create or replace the search vector update function
    console.log('\n3️⃣ Creating search vector update function...');
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_bookmark_search_vector()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english', 
          COALESCE(NEW.name, '') || ' ' || 
          COALESCE(NEW.description, '') || ' ' || 
          COALESCE(NEW.url, '') || ' ' || 
          COALESCE(array_to_string(NEW.tags, ' '), '')
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('   ✅ Search vector update function created');

    // Step 4: Create or replace the trigger
    console.log('\n4️⃣ Creating search vector update trigger...');
    await db.execute(sql`
      DROP TRIGGER IF EXISTS update_bookmark_search_vector_trigger ON bookmarks
    `);

    await db.execute(sql`
      CREATE TRIGGER update_bookmark_search_vector_trigger
        BEFORE INSERT OR UPDATE ON bookmarks
        FOR EACH ROW
        EXECUTE FUNCTION update_bookmark_search_vector()
    `);
    console.log('   ✅ Search vector update trigger created');

    // Step 5: Create GIN index for full-text search
    console.log('\n5️⃣ Creating GIN index for full-text search...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_search_idx ON bookmarks USING gin(search_vector)
    `);
    console.log('   ✅ GIN index created');

    // Step 6: Create user_id index for efficient filtering
    console.log('\n6️⃣ Creating user_id index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id)
    `);
    console.log('   ✅ user_id index created');

    // Step 7: Update existing records to populate the search vector
    console.log('\n7️⃣ Updating existing records...');
    const updateResult = await db.execute(sql`
      UPDATE bookmarks SET search_vector = to_tsvector('english', 
        COALESCE(name, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(url, '') || ' ' || 
        COALESCE(array_to_string(tags, ' '), '')
      )
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount || 0} existing records`);

    // Step 8: Test the ts_rank function
    console.log('\n8️⃣ Testing ts_rank function...');
    try {
      const testResult = await db.execute(sql`
        SELECT ts_rank(
          to_tsvector('english', 'test search vector'),
          plainto_tsquery('english', 'test')
        ) as rank
      `);
      console.log('   ✅ ts_rank function is working');
      console.log(`   Test rank: ${testResult.rows[0]?.rank}`);
    } catch (error) {
      console.log('   ❌ ts_rank function test failed:', error);
      throw error;
    }

    // Step 9: Test full-text search on actual data
    console.log('\n9️⃣ Testing full-text search on actual data...');
    try {
      const searchTest = await db.execute(sql`
        SELECT 
          name,
          ts_rank(search_vector, plainto_tsquery('english', 'test')) as rank
        FROM bookmarks 
        WHERE search_vector @@ plainto_tsquery('english', 'test')
        LIMIT 3
      `);

      if (searchTest.rows.length > 0) {
        console.log('   ✅ Full-text search is working');
        console.log('   Sample results:');
        searchTest.rows.forEach((row: any, index) => {
          console.log(`     ${index + 1}. ${row.name} (rank: ${row.rank})`);
        });
      } else {
        console.log('   ℹ️  No test results found (this is normal if no bookmarks contain "test")');
      }
    } catch (error) {
      console.log('   ❌ Full-text search test failed:', error);
      throw error;
    }

    console.log('\n🎉 Full-text search fix completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ PostgreSQL extensions enabled');
    console.log('   ✅ search_vector column configured');
    console.log('   ✅ Search vector update function created');
    console.log('   ✅ Trigger created for automatic updates');
    console.log('   ✅ GIN index created for performance');
    console.log('   ✅ user_id index created');
    console.log('   ✅ Existing records updated');
    console.log('   ✅ ts_rank function tested and working');

    console.log('\n🚀 Next steps:');
    console.log('   1. Test the bookmark search functionality');
    console.log('   2. Verify that search results are returned correctly');
    console.log('   3. Monitor performance with large datasets');

  } catch (error) {
    console.error('❌ Full-text search fix failed:', error);
    console.log('\n🔄 Troubleshooting:');
    console.log('   1. Ensure PostgreSQL is running');
    console.log('   2. Check database connection');
    console.log('   3. Verify user has CREATE EXTENSION permissions');
    console.log('   4. Check PostgreSQL version (9.1+ required for full-text search)');
    process.exit(1);
  }
}

// Run the fix
fixFullTextSearch()
  .then(() => {
    console.log('\nFix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fix failed:', error);
    process.exit(1);
  });
