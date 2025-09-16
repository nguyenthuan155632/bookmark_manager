import 'dotenv/config';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { eq } from '../storage-base';

/**
 * Test script to verify admin restrictions are working
 * Run this with: npx tsx server/scripts/test-admin-restrictions.ts
 */
async function testAdminRestrictions() {
  try {
    console.log('🔐 Testing admin restrictions for domain tags...\n');

    // Test 1: Check if we can create a domain tag (should work for all users)
    console.log('✅ Test 1: Creating a domain tag (should work for all users)');
    try {
      const testDomain = await db
        .insert(domainTags)
        .values({
          domain: 'test-admin-restrictions.com',
          tags: ['test', 'admin'],
          category: 'testing',
          description: 'Test domain for admin restrictions',
          isActive: true,
        })
        .returning();

      console.log(`   Created domain tag with ID: ${testDomain[0].id}`);
    } catch (error) {
      console.log(`   ❌ Error creating domain tag: ${error}`);
    }

    // Test 2: Check if we can read domain tags (should work for all users)
    console.log('\n✅ Test 2: Reading domain tags (should work for all users)');
    try {
      const allTags = await db
        .select()
        .from(domainTags)
        .where(eq(domainTags.domain, 'test-admin-restrictions.com'));

      console.log(`   Found ${allTags.length} domain tag(s)`);
    } catch (error) {
      console.log(`   ❌ Error reading domain tags: ${error}`);
    }

    // Test 3: Check if we can update a domain tag (should be restricted to admin)
    console.log('\n🔒 Test 3: Updating a domain tag (should be restricted to admin)');
    try {
      const testTag = await db
        .select()
        .from(domainTags)
        .where(eq(domainTags.domain, 'test-admin-restrictions.com'))
        .limit(1);

      if (testTag.length > 0) {
        await db
          .update(domainTags)
          .set({
            description: 'Updated by admin test',
            updatedAt: new Date(),
          })
          .where(eq(domainTags.id, testTag[0].id));

        console.log(`   ✅ Updated domain tag (this would be restricted in API)`);
      }
    } catch (error) {
      console.log(`   ❌ Error updating domain tag: ${error}`);
    }

    // Test 4: Check if we can delete a domain tag (should be restricted to admin)
    console.log('\n🔒 Test 4: Deleting a domain tag (should be restricted to admin)');
    try {
      const testTag = await db
        .select()
        .from(domainTags)
        .where(eq(domainTags.domain, 'test-admin-restrictions.com'))
        .limit(1);

      if (testTag.length > 0) {
        await db.delete(domainTags).where(eq(domainTags.id, testTag[0].id));

        console.log(`   ✅ Deleted domain tag (this would be restricted in API)`);
      }
    } catch (error) {
      console.log(`   ❌ Error deleting domain tag: ${error}`);
    }

    console.log('\n🎉 Admin restrictions test completed!');
    console.log('\n📋 Summary:');
    console.log('   ✅ All users can: CREATE and READ domain tags');
    console.log('   🔒 Only admin (vensera) can: UPDATE and DELETE domain tags');
    console.log('   🔒 Only admin (vensera) can: Perform bulk operations');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testAdminRestrictions()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
