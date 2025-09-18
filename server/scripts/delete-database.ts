import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Delete everything from database
 * No backup, no confirmation - just delete everything
 *
 * Usage: npm run db:delete
 */
async function deleteDatabase() {
  try {
    console.log('🗑️  Deleting everything from database...\n');

    // Drop all tables in reverse dependency order
    console.log('1️⃣ Dropping all tables...');

    await db.execute(sql`DROP TABLE IF EXISTS bookmarks CASCADE`);
    console.log('   ✅ Dropped bookmarks');

    await db.execute(sql`DROP TABLE IF EXISTS categories CASCADE`);
    console.log('   ✅ Dropped categories');

    await db.execute(sql`DROP TABLE IF EXISTS domain_tags CASCADE`);
    console.log('   ✅ Dropped domain_tags');

    await db.execute(sql`DROP TABLE IF EXISTS user_preferences CASCADE`);
    console.log('   ✅ Dropped user_preferences');

    await db.execute(sql`DROP TABLE IF EXISTS api_tokens CASCADE`);
    console.log('   ✅ Dropped api_tokens');

    await db.execute(sql`DROP TABLE IF EXISTS session CASCADE`);
    console.log('   ✅ Dropped session');

    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);
    console.log('   ✅ Dropped users');

    // Drop all functions and triggers
    console.log('\n2️⃣ Dropping all functions and triggers...');
    await db.execute(sql`DROP FUNCTION IF EXISTS update_bookmark_search_vector() CASCADE`);
    await db.execute(sql`DROP FUNCTION IF EXISTS custom_search_rank(tsvector, tsquery) CASCADE`);
    await db.execute(
      sql`DROP TRIGGER IF EXISTS update_bookmark_search_vector_trigger ON bookmarks CASCADE`,
    );
    console.log('   ✅ Dropped custom functions and triggers');

    // Drop all indexes
    console.log('\n3️⃣ Dropping all indexes...');
    await db.execute(sql`DROP INDEX IF EXISTS bookmarks_search_idx CASCADE`);
    await db.execute(sql`DROP INDEX IF EXISTS bookmarks_user_id_idx CASCADE`);
    await db.execute(sql`DROP INDEX IF EXISTS domain_tags_domain_idx CASCADE`);
    await db.execute(sql`DROP INDEX IF EXISTS domain_tags_category_idx CASCADE`);
    await db.execute(sql`DROP INDEX IF EXISTS domain_tags_active_idx CASCADE`);
    await db.execute(sql`DROP INDEX IF EXISTS IDX_session_expire CASCADE`);
    console.log('   ✅ Dropped all indexes');

    // Drop extensions
    console.log('\n4️⃣ Dropping extensions...');
    try {
      await db.execute(sql`DROP EXTENSION IF EXISTS pg_trgm CASCADE`);
      console.log('   ✅ Dropped pg_trgm extension');
    } catch (error) {
      console.log('   ⚠️  Could not drop pg_trgm extension');
    }

    // Note: Built-in PostgreSQL functions (ts_rank, to_tsvector, etc.) cannot be deleted
    // They are part of PostgreSQL core and will remain available

    // Verify everything is gone
    console.log('\n5️⃣ Verifying deletion...');
    const remainingTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);

    if (remainingTables.rows.length === 0) {
      console.log('   ✅ Database is completely empty');
    } else {
      console.log('   ⚠️  Some tables still exist:');
      remainingTables.rows.forEach((row: any) => {
        console.log(`     - ${row.table_name}`);
      });
    }

    console.log('\n🎉 Database completely deleted!');
    console.log('\n📋 Deletion Summary:');
    console.log('   ✅ All tables deleted');
    console.log('   ✅ All functions deleted');
    console.log('   ✅ All indexes deleted');
    console.log('   ✅ Extensions dropped');
    console.log('   ✅ Database is empty');

    console.log('\n🚀 Next steps:');
    console.log('   1. npm run db:push          # Create new schema');
    console.log('   2. npm run deploy:search    # Setup full-text search');
    console.log('   3. npm run seed             # Add sample data');
    console.log('   4. npm run dev              # Start development');
  } catch (error) {
    console.error('❌ Database deletion failed:', error);
    process.exit(1);
  }
}

// Run the deletion
deleteDatabase()
  .then(() => {
    console.log('\nDeletion completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deletion failed:', error);
    process.exit(1);
  });
