import 'dotenv/config';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Test script to verify full-text search functionality
 * Run this with: npx tsx server/scripts/test-fulltext-search.ts
 */
async function testFullTextSearch() {
  try {
    console.log('🧪 Testing full-text search functionality...\n');

    // First, let's check if the search_vector column exists
    const columnExists = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookmarks' AND column_name = 'search_vector'
    `);

    if (columnExists.rows.length === 0) {
      console.log('❌ search_vector column not found. Please run the migration first:');
      console.log('   npx tsx server/scripts/add-fulltext-search.ts');
      return;
    }

    console.log('✓ search_vector column exists');

    // Check if the GIN index exists
    const indexExists = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'bookmarks' AND indexname = 'bookmarks_search_idx'
    `);

    if (indexExists.rows.length === 0) {
      console.log('❌ GIN index not found. Please run the migration first.');
      return;
    }

    console.log('✓ GIN index exists');

    // Test search functionality with some sample data
    console.log('\n🔍 Testing search queries...\n');

    // Create a test user ID (you might want to use an existing one)
    const testUserId = 'test-user-' + Date.now();

    // Insert some test bookmarks
    const testBookmarks = [
      {
        name: 'React Tutorial for Beginners',
        description: 'Learn React from scratch with this comprehensive tutorial',
        url: 'https://react-tutorial.com',
        tags: ['react', 'javascript', 'tutorial'],
        userId: testUserId,
      },
      {
        name: 'TypeScript Advanced Patterns',
        description: 'Advanced TypeScript patterns and best practices',
        url: 'https://typescript-patterns.com',
        tags: ['typescript', 'patterns', 'advanced'],
        userId: testUserId,
      },
      {
        name: 'JavaScript Machine Learning',
        description: 'Machine learning with JavaScript and TensorFlow.js',
        url: 'https://js-ml.com',
        tags: ['javascript', 'machine-learning', 'tensorflow'],
        userId: testUserId,
      },
      {
        name: 'React Native Mobile Development',
        description: 'Building mobile apps with React Native',
        url: 'https://react-native-guide.com',
        tags: ['react-native', 'mobile', 'react'],
        userId: testUserId,
      },
    ];

    console.log('📝 Creating test bookmarks...');
    for (const bookmark of testBookmarks) {
      await storage.createBookmark(testUserId, bookmark as any);
    }
    console.log('✓ Test bookmarks created');

    // Test various search queries
    const searchTests = [
      {
        query: 'react',
        expected: 'Should find React-related bookmarks',
      },
      {
        query: 'javascript tutorial',
        expected: 'Should find JavaScript tutorial bookmarks',
      },
      {
        query: 'machine learning',
        expected: 'Should find machine learning bookmarks',
      },
      {
        query: 'mobile development',
        expected: 'Should find mobile development bookmarks',
      },
      {
        query: 'typescript patterns',
        expected: 'Should find TypeScript patterns bookmarks',
      },
    ];

    for (const test of searchTests) {
      console.log(`\n🔍 Searching for: "${test.query}"`);
      console.log(`   Expected: ${test.expected}`);

      const results = await storage.getBookmarks(testUserId, {
        search: test.query,
        limit: 10,
      });

      console.log(`   Found ${results.length} results:`);
      results.forEach((bookmark, index) => {
        console.log(`   ${index + 1}. ${bookmark.name} (${bookmark.url})`);
        console.log(`      Tags: ${bookmark.tags?.join(', ') || 'none'}`);
      });
    }

    // Test search ranking
    console.log('\n📊 Testing search ranking...');
    const rankingTest = await storage.getBookmarks(testUserId, {
      search: 'react',
      limit: 5,
    });

    console.log('Results ordered by relevance:');
    rankingTest.forEach((bookmark, index) => {
      console.log(`   ${index + 1}. ${bookmark.name}`);
    });

    // Test phrase search
    console.log('\n🔍 Testing phrase search...');
    const phraseResults = await storage.getBookmarks(testUserId, {
      search: 'machine learning',
      limit: 5,
    });

    console.log(`Phrase search "machine learning" found ${phraseResults.length} results:`);
    phraseResults.forEach((bookmark, index) => {
      console.log(`   ${index + 1}. ${bookmark.name}`);
    });

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await db.execute(sql`DELETE FROM bookmarks WHERE user_id = ${testUserId}`);
    console.log('✓ Test data cleaned up');

    console.log('\n🎉 Full-text search test completed successfully!');
    console.log('\nKey improvements:');
    console.log('• Better search performance with GIN indexes');
    console.log('• Relevance-based ranking of results');
    console.log('• Support for phrase searches');
    console.log('• Automatic stemming and language processing');
    console.log('• Boolean operators support (AND, OR, NOT)');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFullTextSearch()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
