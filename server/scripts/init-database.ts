import 'dotenv/config';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Complete database initialization
 * Sets up everything from scratch: schema, extensions, full-text search, etc.
 * 
 * Usage: npm run db:init
 */
async function initDatabase() {
  try {
    console.log('🚀 Initializing database from scratch...\n');

    // 1. Enable required extensions
    console.log('1️⃣ Enabling PostgreSQL extensions...');

    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
      console.log('   ✅ pg_trgm extension enabled');
    } catch (error) {
      console.log('   ⚠️  pg_trgm extension may not be available or already enabled');
    }

    // 2. Apply schema (this will be done by db:push)
    console.log('\n2️⃣ Schema setup...');
    console.log('   Run: npm run db:push');
    console.log('   This will create all tables with the current schema');

    // 3. Deploy full-text search
    console.log('\n3️⃣ Full-text search setup...');
    console.log('   Run: npm run deploy:search');
    console.log('   This will set up search vectors, functions, and indexes');

    // 4. Seed initial data
    console.log('\n4️⃣ Initial data setup...');
    console.log('   Run: npm run seed');
    console.log('   This will add sample users, categories, and bookmarks');

    // 5. Seed domain tags
    console.log('\n5️⃣ Domain tags setup...');
    console.log('   Run: npm run seed:domain-tags');
    console.log('   This will add domain-specific tag suggestions');

    console.log('\n🎉 Database initialization instructions completed!');
    console.log('\n📋 Complete Setup Process:');
    console.log('   1. npm run db:delete     # Clean everything');
    console.log('   2. npm run db:push       # Create schema');
    console.log('   3. npm run deploy:search # Setup full-text search');
    console.log('   4. npm run seed          # Add sample data');
    console.log('   5. npm run seed:domain-tags # Add domain tags');
    console.log('   6. npm run dev           # Start development');

    console.log('\n💡 Or run the complete setup:');
    console.log('   npm run db:delete && npm run db:push && npm run deploy:search && npm run seed && npm run seed:domain-tags');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initDatabase()
  .then(() => {
    console.log('\nInitialization completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
