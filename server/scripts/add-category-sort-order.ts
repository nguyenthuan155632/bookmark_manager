import { db } from '../db';
import { sql } from 'drizzle-orm';

async function addCategorySortOrder() {
  try {
    console.log('Adding sortOrder column to categories table...');

    // Add the sortOrder column with default value 0
    await db.execute(sql`
      ALTER TABLE categories 
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0 NOT NULL
    `);

    console.log('Setting sortOrder for existing categories...');

    // Update existing categories to have sequential sortOrder based on creation time
    await db.execute(sql`
      UPDATE categories 
      SET sort_order = subquery.row_number - 1
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as row_number
        FROM categories
      ) as subquery
      WHERE categories.id = subquery.id
    `);

    console.log('Category sortOrder migration completed successfully!');
  } catch (error) {
    console.error('Error adding category sortOrder:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addCategorySortOrder()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { addCategorySortOrder };
