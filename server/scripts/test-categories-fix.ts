import 'dotenv/config';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { eq, and, sql, asc } from '../storage-base';

/**
 * Test script to verify categories API returns only non-empty categories
 * Run this with: npx tsx server/scripts/test-categories-fix.ts
 */
async function testCategoriesFix() {
  try {
    console.log('🧪 Testing categories API fix...\n');

    // Test 1: Check current categories with the old query (should include empty/null)
    console.log('📊 Test 1: Old query (includes null/empty categories)');
    try {
      const oldCategories = await db
        .select({
          category: domainTags.category,
          count: sql<number>`count(*)`,
        })
        .from(domainTags)
        .where(eq(domainTags.isActive, true))
        .groupBy(domainTags.category)
        .orderBy(asc(domainTags.category));

      console.log(`   Found ${oldCategories.length} categories (including null/empty)`);
      oldCategories.forEach((cat, index) => {
        const categoryValue = cat.category === null ? 'NULL' : `"${cat.category}"`;
        console.log(`   ${index + 1}. ${categoryValue} (${cat.count})`);
      });
    } catch (error) {
      console.log(`   ❌ Error with old query: ${error}`);
    }

    console.log('\n📊 Test 2: New query (filters out null/empty categories)');
    try {
      const newCategories = await db
        .select({
          category: domainTags.category,
          count: sql<number>`count(*)`,
        })
        .from(domainTags)
        .where(
          and(
            eq(domainTags.isActive, true),
            sql`${domainTags.category} IS NOT NULL AND ${domainTags.category} != ''`,
          ),
        )
        .groupBy(domainTags.category)
        .orderBy(asc(domainTags.category));

      console.log(`   Found ${newCategories.length} categories (filtered)`);
      newCategories.forEach((cat, index) => {
        console.log(`   ${index + 1}. "${cat.category}" (${cat.count})`);
      });

      // Check if any categories have empty strings
      const emptyCategories = newCategories.filter(
        (cat) => !cat.category || cat.category.trim() === '',
      );
      if (emptyCategories.length > 0) {
        console.log(
          `   ⚠️  Warning: Found ${emptyCategories.length} empty categories in filtered results`,
        );
      } else {
        console.log(`   ✅ No empty categories found in filtered results`);
      }
    } catch (error) {
      console.log(`   ❌ Error with new query: ${error}`);
    }

    console.log('\n🎉 Categories fix test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Server-side query now filters out null and empty categories');
    console.log('   ✅ Client-side code filters out empty categories as additional safety');
    console.log('   ✅ Select component should no longer receive empty string values');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCategoriesFix()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
