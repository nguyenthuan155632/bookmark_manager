import 'dotenv/config';

if (!process.env.PGSSLMODE) {
  process.env.PGSSLMODE = 'require';
}
if (!process.env.PGSSLREJECT_UNAUTHORIZED) {
  process.env.PGSSLREJECT_UNAUTHORIZED = 'false';
}

import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Production deployment script for full-text search
 * This script is safe to run multiple times and handles existing installations
 *
 * Usage:
 * - Development: npx tsx server/scripts/deploy-fulltext-search.ts
 * - Production: Add to your deployment pipeline
 */
async function deployFullTextSearch() {
  try {
    console.log('🚀 Deploying full-text search to production...\n');

    // Check if we're in production
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.log('⚠️  Running in PRODUCTION mode');
    } else {
      console.log('ℹ️  Running in development mode');
    }

    // 1. Check if search_vector column exists, add if not
    console.log('1️⃣ Checking search_vector column...');
    const columnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnExists.rows.length === 0) {
      console.log('   Adding search_vector column...');
      await db.execute(sql`
        ALTER TABLE bookmarks 
        ADD COLUMN search_vector tsvector
      `);
      console.log('   ✅ Added search_vector column');
    } else {
      console.log('   ✅ search_vector column already exists');
    }

    // 2. Check column type and convert if needed
    console.log('2️⃣ Checking column type...');
    const columnType = await db.execute(sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnType.rows[0]?.data_type !== 'USER-DEFINED') {
      console.log('   Converting to tsvector type...');
      await db.execute(sql`
        ALTER TABLE bookmarks 
        ALTER COLUMN search_vector TYPE tsvector USING search_vector::tsvector
      `);
      console.log('   ✅ Converted to tsvector type');
    } else {
      console.log('   ✅ Column is already tsvector type');
    }

    // 3. Create custom search rank function
    console.log('3️⃣ Creating custom search rank function...');
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION custom_search_rank(
        search_vector tsvector,
        query tsquery
      ) RETURNS real AS $$
      BEGIN
        -- Try to use ts_rank if available
        BEGIN
          RETURN ts_rank(search_vector, query);
        EXCEPTION
          WHEN OTHERS THEN
            -- Fallback: simple scoring based on match count and position
            RETURN CASE 
              WHEN search_vector @@ query THEN 
                -- Simple scoring: 0.5 base + 0.1 per word match
                GREATEST(0.5, LEAST(1.0, 0.5 + (array_length(string_to_array(query::text, ' '), 1) * 0.1)))
              ELSE 0.0
            END;
        END;
      END;
      $$ LANGUAGE plpgsql
    `);
    console.log('   ✅ Custom search rank function created');

    // 4. Create or replace the search vector update function
    console.log('4️⃣ Creating search vector update function...');
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

    // 5. Create or replace the trigger
    console.log('5️⃣ Creating search vector update trigger...');
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

    // 6. Create GIN index for full-text search
    console.log('6️⃣ Creating GIN index for full-text search...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_search_idx ON bookmarks USING gin(search_vector)
    `);
    console.log('   ✅ GIN index created');

    // 7. Create user_id index for efficient filtering
    console.log('7️⃣ Creating user_id index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id)
    `);
    console.log('   ✅ User ID index created');

    // 8. Update existing records to populate search vectors
    console.log('8️⃣ Updating existing records...');
    const updateResult = await db.execute(sql`
      UPDATE bookmarks 
      SET search_vector = to_tsvector('english', 
        COALESCE(name, '') || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(url, '') || ' ' || 
        COALESCE(array_to_string(tags, ' '), '')
      )
      WHERE search_vector IS NULL
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount || 0} existing records`);

    // 9. Verify installation
    console.log('9️⃣ Verifying installation...');
    const verification = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM bookmarks WHERE search_vector IS NOT NULL) as records_with_search_vector,
        (SELECT COUNT(*) FROM bookmarks) as total_records
    `);

    const stats = verification.rows[0] as any;
    console.log(`   📊 Records with search vector: ${stats.records_with_search_vector}`);
    console.log(`   📊 Total records: ${stats.total_records}`);

    if (stats.records_with_search_vector === stats.total_records) {
      console.log('   ✅ All records have search vectors');
    } else {
      console.log('   ⚠️  Some records may need manual update');
    }

    console.log('\n🎉 Full-text search deployment completed successfully!');
    console.log('\n📋 Deployment Summary:');
    console.log('• ✅ Search vector column added/verified');
    console.log('• ✅ Automatic update trigger installed');
    console.log('• ✅ GIN index for fast searching created');
    console.log('• ✅ User ID index for efficient filtering created');
    console.log('• ✅ Existing data updated with search vectors');

    console.log('\n🔍 Search Features Available:');
    console.log('• Full-text search with relevance ranking');
    console.log('• Partial word matching for hyphenated tags');
    console.log('• Phrase searches and boolean operators');
    console.log('• Automatic stemming and language processing');

    if (isProduction) {
      console.log('\n🚀 Production deployment complete!');
      console.log('Your search functionality is now live and ready to use.');
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your DATABASE_URL is correct');
    console.error('2. Ensure you have proper database permissions');
    console.error('3. Verify PostgreSQL version supports tsvector (9.1+)');
    process.exit(1);
  }
}

// Run the deployment
deployFullTextSearch()
  .then(() => {
    console.log('\nDeployment completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
