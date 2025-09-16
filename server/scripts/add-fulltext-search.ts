import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Migration script to add full-text search capabilities to the bookmarks table
 * Run this with: npx tsx server/scripts/add-fulltext-search.ts
 */
async function addFullTextSearch() {
  try {
    console.log('Adding full-text search to bookmarks table...');

    // Check if search_vector column exists, add if not
    const columnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnExists.rows.length === 0) {
      await db.execute(sql`
        ALTER TABLE bookmarks 
        ADD COLUMN search_vector tsvector
      `);
      console.log('✓ Added search_vector column');
    } else {
      // Check if the column is the correct type
      const columnType = await db.execute(sql`
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
      `);

      if (columnType.rows[0]?.data_type !== 'USER-DEFINED') {
        console.log('⚠️  search_vector column exists but is not tsvector type, converting...');
        await db.execute(sql`
          ALTER TABLE bookmarks 
          ALTER COLUMN search_vector TYPE tsvector USING search_vector::tsvector
        `);
        console.log('✓ Converted search_vector column to tsvector type');
      } else {
        console.log('✓ search_vector column already exists with correct type');
      }
    }

    // Create a function to update the search vector
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

    console.log('✓ Created search vector update function');

    // Create trigger to automatically update search vector
    await db.execute(sql`
      DROP TRIGGER IF EXISTS update_bookmark_search_vector_trigger ON bookmarks
    `);

    await db.execute(sql`
      CREATE TRIGGER update_bookmark_search_vector_trigger
        BEFORE INSERT OR UPDATE ON bookmarks
        FOR EACH ROW
        EXECUTE FUNCTION update_bookmark_search_vector()
    `);

    console.log('✓ Created search vector update trigger');

    // Create GIN index for full-text search
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_search_idx ON bookmarks USING gin(search_vector)
    `);

    console.log('✓ Created GIN index for full-text search');

    // Create user_id index for efficient filtering
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS bookmarks_user_id_idx ON bookmarks(user_id)
    `);

    console.log('✓ Created user_id index');

    // Update existing records to populate the search vector
    await db.execute(sql`
      UPDATE bookmarks SET search_vector = to_tsvector('english', 
        coalesce(name, '') || ' ' || 
        coalesce(description, '') || ' ' || 
        coalesce(url, '') || ' ' || 
        coalesce(array_to_string(tags, ' '), '')
      )
    `);

    console.log('✓ Updated existing records with search vectors');

    console.log('🎉 Full-text search migration completed successfully!');
    console.log('');
    console.log('You can now use full-text search with:');
    console.log('- Plain text queries: "react tutorial"');
    console.log('- Phrase searches: "machine learning"');
    console.log('- Boolean operators: "react AND typescript"');
    console.log('- Prefix matching: "react*"');
    console.log('- Negation: "javascript NOT jquery"');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
addFullTextSearch()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
