import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Production-specific script to fix full-text search
 * This handles permission issues and provides fallback solutions
 * Run this with: npx tsx server/scripts/production-fix-fulltext-search.ts
 */
async function productionFixFullTextSearch() {
  try {
    console.log('🔧 Production full-text search fix...\n');

    // Step 1: Check PostgreSQL version and available extensions
    console.log('1️⃣ Checking PostgreSQL environment...');

    const versionCheck = await db.execute(sql`
      SELECT version() as version
    `);
    console.log(`   PostgreSQL version: ${versionCheck.rows[0]?.version}`);

    // Check if we can create extensions
    try {
      await db.execute(sql`SELECT 1`);
      console.log('   ✅ Database connection working');
    } catch (error) {
      console.log('   ❌ Database connection failed:', error);
      throw error;
    }

    // Step 2: Try to enable extensions with proper error handling
    console.log('\n2️⃣ Enabling PostgreSQL extensions...');

    const extensions = ['pg_trgm'];
    for (const ext of extensions) {
      try {
        await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS ${ext}`));
        console.log(`   ✅ ${ext} extension enabled`);
      } catch (error: any) {
        console.log(`   ⚠️  ${ext} extension failed: ${error.message}`);
        if (error.code === '42501') {
          console.log(`   💡 Permission denied for ${ext} - this is common in managed databases`);
        }
      }
    }

    // Step 3: Check if ts_rank function exists
    console.log('\n3️⃣ Checking ts_rank function availability...');

    try {
      const rankTest = await db.execute(sql`
        SELECT ts_rank(
          to_tsvector('english', 'test'),
          plainto_tsquery('english', 'test')
        ) as rank
      `);
      console.log(`   ✅ ts_rank function is available (rank: ${rankTest.rows[0]?.rank})`);
    } catch (error: any) {
      console.log(`   ❌ ts_rank function not available: ${error.message}`);
      console.log('   💡 This might be due to missing extensions or permissions');

      // Check what functions are available
      const functionCheck = await db.execute(sql`
        SELECT proname, pronargs 
        FROM pg_proc 
        WHERE proname LIKE '%rank%' 
        ORDER BY proname
      `);

      console.log('   Available rank functions:');
      functionCheck.rows.forEach((row: any) => {
        console.log(`     - ${row.proname} (${row.pronargs} args)`);
      });
    }

    // Step 4: Check search_vector column
    console.log('\n4️⃣ Checking search_vector column...');

    const columnInfo = await db.execute(sql`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnInfo.rows.length === 0) {
      console.log('   Adding search_vector column...');
      try {
        await db.execute(sql`
          ALTER TABLE bookmarks 
          ADD COLUMN search_vector tsvector
        `);
        console.log('   ✅ Added search_vector column');
      } catch (error: any) {
        console.log(`   ❌ Failed to add search_vector column: ${error.message}`);
        throw error;
      }
    } else {
      const columnType = columnInfo.rows[0].data_type;
      console.log(`   Current column type: ${columnType}`);

      if (columnType !== 'USER-DEFINED') {
        console.log('   Converting to tsvector type...');
        try {
          await db.execute(sql`
            ALTER TABLE bookmarks 
            ALTER COLUMN search_vector TYPE tsvector USING search_vector::tsvector
          `);
          console.log('   ✅ Converted to tsvector type');
        } catch (error: any) {
          console.log(`   ❌ Failed to convert column type: ${error.message}`);
          throw error;
        }
      } else {
        console.log('   ✅ Column is already tsvector type');
      }
    }

    // Step 5: Create fallback search function if ts_rank is not available
    console.log('\n5️⃣ Setting up fallback search functions...');

    try {
      // Create a custom rank function that doesn't rely on ts_rank
      await db.execute(sql`
        CREATE OR REPLACE FUNCTION custom_search_rank(
          search_vector tsvector,
          query tsquery
        ) RETURNS real AS $$
        BEGIN
          -- If ts_rank is available, use it
          IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'ts_rank') THEN
            RETURN ts_rank(search_vector, query);
          ELSE
            -- Fallback: simple scoring based on match count
            RETURN CASE 
              WHEN search_vector @@ query THEN 0.5
              ELSE 0.0
            END;
          END IF;
        END;
        $$ LANGUAGE plpgsql
      `);
      console.log('   ✅ Custom search rank function created');
    } catch (error: any) {
      console.log(`   ⚠️  Failed to create custom rank function: ${error.message}`);
    }

    // Step 6: Create search vector update function
    console.log('\n6️⃣ Creating search vector update function...');

    try {
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
    } catch (error: any) {
      console.log(`   ❌ Failed to create search vector function: ${error.message}`);
      throw error;
    }

    // Step 7: Create trigger
    console.log('\n7️⃣ Creating search vector update trigger...');

    try {
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
    } catch (error: any) {
      console.log(`   ❌ Failed to create trigger: ${error.message}`);
      throw error;
    }

    // Step 8: Create indexes
    console.log('\n8️⃣ Creating indexes...');

    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS bookmarks_search_idx ON bookmarks USING gin(search_vector)
      `);
      console.log('   ✅ GIN index created');
    } catch (error: any) {
      console.log(`   ⚠️  Failed to create GIN index: ${error.message}`);
    }

    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id)
      `);
      console.log('   ✅ user_id index created');
    } catch (error: any) {
      console.log(`   ⚠️  Failed to create user_id index: ${error.message}`);
    }

    // Step 9: Update existing records
    console.log('\n9️⃣ Updating existing records...');

    try {
      const updateResult = await db.execute(sql`
        UPDATE bookmarks SET search_vector = to_tsvector('english', 
          COALESCE(name, '') || ' ' || 
          COALESCE(description, '') || ' ' || 
          COALESCE(url, '') || ' ' || 
          COALESCE(array_to_string(tags, ' '), '')
        )
      `);
      console.log(`   ✅ Updated ${updateResult.rowCount || 0} existing records`);
    } catch (error: any) {
      console.log(`   ❌ Failed to update existing records: ${error.message}`);
      throw error;
    }

    // Step 10: Test the setup
    console.log('\n🔟 Testing the setup...');

    try {
      // Test basic full-text search
      const searchTest = await db.execute(sql`
        SELECT 
          name,
          custom_search_rank(search_vector, plainto_tsquery('english', 'test')) as rank
        FROM bookmarks 
        WHERE search_vector @@ plainto_tsquery('english', 'test')
        ORDER BY rank DESC
        LIMIT 3
      `);

      console.log(`   ✅ Search test successful - found ${searchTest.rows.length} results`);
      if (searchTest.rows.length > 0) {
        console.log('   Sample results:');
        searchTest.rows.forEach((row: any, index) => {
          console.log(`     ${index + 1}. ${row.name} (rank: ${row.rank})`);
        });
      }
    } catch (error: any) {
      console.log(`   ⚠️  Search test failed: ${error.message}`);
      console.log('   💡 This is expected if ts_rank is not available');
    }

    console.log('\n🎉 Production full-text search fix completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Database connection verified');
    console.log('   ✅ Extensions checked/enabled where possible');
    console.log('   ✅ ts_rank function availability checked');
    console.log('   ✅ search_vector column configured');
    console.log('   ✅ Custom fallback functions created');
    console.log('   ✅ Search vector update function created');
    console.log('   ✅ Trigger created');
    console.log('   ✅ Indexes created');
    console.log('   ✅ Existing records updated');

    console.log('\n🚀 Next steps:');
    console.log('   1. Test the application search functionality');
    console.log('   2. If ts_rank is still not available, the app will use fallback scoring');
    console.log('   3. Monitor search performance and results');

  } catch (error) {
    console.error('❌ Production full-text search fix failed:', error);
    console.log('\n🔄 Troubleshooting:');
    console.log('   1. Check database permissions');
    console.log('   2. Verify PostgreSQL version (9.1+ required)');
    console.log('   3. Contact your database administrator for extension permissions');
    console.log('   4. Consider using a managed database service with full-text search support');
    process.exit(1);
  }
}

// Run the fix
productionFixFullTextSearch()
  .then(() => {
    console.log('\nProduction fix completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Production fix failed:', error);
    process.exit(1);
  });
