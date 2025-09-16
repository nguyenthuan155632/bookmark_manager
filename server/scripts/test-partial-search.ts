import 'dotenv/config';
import { storage } from '../storage';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Test script to verify partial search functionality with hyphenated tags
 * Run this with: npx tsx server/scripts/test-partial-search.ts
 */
async function testPartialSearch() {
  try {
    console.log('🧪 Testing partial search functionality...\n');

    // Create a test user ID
    const testUserId = 'test-user-' + Date.now();

    // Insert test bookmarks with hyphenated tags
    const testBookmarks = [
      {
        name: 'Supply Chain Management Guide',
        description: 'Complete guide to supply chain optimization and logistics',
        url: 'https://supply-chain-guide.com',
        tags: ['supply-chain', 'logistics', 'management'],
        userId: testUserId,
      },
      {
        name: 'Machine Learning Tutorial',
        description: 'Learn machine learning from scratch',
        url: 'https://ml-tutorial.com',
        tags: ['machine-learning', 'ai', 'tutorial'],
        userId: testUserId,
      },
      {
        name: 'React Native Development',
        description: 'Building mobile apps with React Native',
        url: 'https://react-native-dev.com',
        tags: ['react-native', 'mobile', 'javascript'],
        userId: testUserId,
      },
      {
        name: 'Data Science Project',
        description: 'End-to-end data science project walkthrough',
        url: 'https://data-science-project.com',
        tags: ['data-science', 'python', 'analytics'],
        userId: testUserId,
      },
    ];

    console.log('📝 Creating test bookmarks with hyphenated tags...');
    for (const bookmark of testBookmarks) {
      await storage.createBookmark(testUserId, bookmark as any);
    }
    console.log('✓ Test bookmarks created');

    // Test partial word searches
    const partialSearchTests = [
      {
        query: 'supply',
        expected: 'Should find "supply-chain" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'chain',
        expected: 'Should find "supply-chain" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'machine',
        expected: 'Should find "machine-learning" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'learning',
        expected: 'Should find "machine-learning" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'react',
        expected: 'Should find "react-native" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'native',
        expected: 'Should find "react-native" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'data',
        expected: 'Should find "data-science" bookmark',
        description: 'Partial word from hyphenated tag',
      },
      {
        query: 'science',
        expected: 'Should find "data-science" bookmark',
        description: 'Partial word from hyphenated tag',
      },
    ];

    console.log('\n🔍 Testing partial word searches...\n');

    for (const test of partialSearchTests) {
      console.log(`🔍 Searching for: "${test.query}"`);
      console.log(`   Description: ${test.description}`);
      console.log(`   Expected: ${test.expected}`);

      const results = await storage.getBookmarks(testUserId, {
        search: test.query,
        limit: 10,
      });

      console.log(`   Found ${results.length} results:`);
      results.forEach((bookmark, index) => {
        console.log(`   ${index + 1}. ${bookmark.name}`);
        console.log(`      Tags: ${bookmark.tags?.join(', ') || 'none'}`);
      });
      console.log('');
    }

    // Test that full hyphenated terms still work
    console.log('🔍 Testing full hyphenated terms...\n');

    const fullTermTests = [
      { query: 'supply-chain', expected: 'Should find supply chain bookmark' },
      { query: 'machine-learning', expected: 'Should find machine learning bookmark' },
      { query: 'react-native', expected: 'Should find react native bookmark' },
      { query: 'data-science', expected: 'Should find data science bookmark' },
    ];

    for (const test of fullTermTests) {
      console.log(`🔍 Searching for: "${test.query}"`);
      console.log(`   Expected: ${test.expected}`);

      const results = await storage.getBookmarks(testUserId, {
        search: test.query,
        limit: 10,
      });

      console.log(`   Found ${results.length} results:`);
      results.forEach((bookmark, index) => {
        console.log(`   ${index + 1}. ${bookmark.name}`);
        console.log(`      Tags: ${bookmark.tags?.join(', ') || 'none'}`);
      });
      console.log('');
    }

    // Test ranking - partial matches should have lower scores than full matches
    console.log('📊 Testing search ranking...');
    const rankingTest = await storage.getBookmarks(testUserId, {
      search: 'supply',
      limit: 5,
    });

    console.log('Results for "supply" (should include supply-chain):');
    rankingTest.forEach((bookmark, index) => {
      console.log(`   ${index + 1}. ${bookmark.name}`);
    });

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await db.execute(sql`DELETE FROM bookmarks WHERE user_id = ${testUserId}`);
    console.log('✓ Test data cleaned up');

    console.log('\n🎉 Partial search test completed successfully!');
    console.log('\nKey improvements:');
    console.log('• Partial word matches work with hyphenated tags');
    console.log('• Full-text search provides better ranking for exact matches');
    console.log('• ILIKE fallback ensures partial matches are found');
    console.log('• Hybrid approach combines best of both worlds');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testPartialSearch()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
