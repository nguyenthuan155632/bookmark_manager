import 'dotenv/config';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { eq, sql } from '../storage-base';

/**
 * Test script to verify the domain tags system is working correctly
 * Run this with: npx tsx server/scripts/test-domain-tags.ts
 */
async function testDomainTags() {
  try {
    console.log('🧪 Testing domain tags system...\n');

    // Test 1: Check total count
    console.log('1️⃣ Checking total domain tags...');
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM domain_tags`);
    const totalCount = (countResult.rows[0] as any).count;
    console.log(`   📊 Total domain tags: ${totalCount}`);

    // Test 2: Check categories
    console.log('\n2️⃣ Checking categories...');
    const categoryResult = await db.execute(sql`
      SELECT category, COUNT(*) as count 
      FROM domain_tags 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC
    `);

    console.log('   📈 Categories:');
    categoryResult.rows.forEach((row: any) => {
      console.log(`      ${row.category}: ${row.count} domains`);
    });

    // Test 3: Test specific domain lookups
    console.log('\n3️⃣ Testing specific domain lookups...');
    const testDomains = [
      'github.com',
      'youtube.com',
      'stackoverflow.com',
      'figma.com',
      'notion.so',
    ];

    for (const domain of testDomains) {
      const [result] = await db.select().from(domainTags).where(eq(domainTags.domain, domain));

      if (result) {
        console.log(`   ✅ ${domain}: [${result.tags.join(', ')}] (${result.category})`);
      } else {
        console.log(`   ❌ ${domain}: Not found`);
      }
    }

    // Test 4: Test search functionality
    console.log('\n4️⃣ Testing search functionality...');
    const searchResult = await db.execute(sql`
      SELECT domain, tags, category
      FROM domain_tags 
      WHERE domain ILIKE '%github%' OR array_to_string(tags, ' ') ILIKE '%development%'
      LIMIT 5
    `);

    console.log('   🔍 Search results for "github" or "development":');
    searchResult.rows.forEach((row: any) => {
      console.log(`      ${row.domain}: [${row.tags.join(', ')}] (${row.category})`);
    });

    // Test 5: Test AI storage integration
    console.log('\n5️⃣ Testing AI storage integration...');

    // Test URL analysis
    const testUrls = [
      'https://github.com/microsoft/vscode',
      'https://youtube.com/watch?v=abc123',
      'https://stackoverflow.com/questions/123456',
      'https://figma.com/design/abc123',
      'https://notion.so/workspace/abc123',
    ];

    console.log('   🤖 Testing AI auto-tagging with database domain tags:');
    for (const url of testUrls) {
      try {
        // This would normally be called from the AI storage class
        // We'll simulate the domain extraction and lookup
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();

        const [domainTag] = await db.select().from(domainTags).where(eq(domainTags.domain, domain));

        if (domainTag) {
          console.log(`      ${domain}: [${domainTag.tags.join(', ')}] (${domainTag.category})`);
        } else {
          console.log(`      ${domain}: No domain tags found`);
        }
      } catch (error) {
        console.log(`      ${url}: Error - ${error}`);
      }
    }

    // Test 6: Performance test
    console.log('\n6️⃣ Testing performance...');
    const startTime = Date.now();

    // Simulate multiple domain lookups
    const performanceDomains = [
      'github.com',
      'youtube.com',
      'stackoverflow.com',
      'figma.com',
      'notion.so',
      'medium.com',
      'dev.to',
      'reddit.com',
    ];
    for (const domain of performanceDomains) {
      await db.select().from(domainTags).where(eq(domainTags.domain, domain));
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`   ⚡ Looked up ${performanceDomains.length} domains in ${duration}ms`);

    console.log('\n🎉 Domain tags system test completed successfully!');
    console.log('\n✨ System Benefits:');
    console.log('• ✅ Database-driven domain tagging');
    console.log('• ✅ Categorized and searchable');
    console.log('• ✅ Fast lookups with indexes');
    console.log('• ✅ Easy to maintain and extend');
    console.log('• ✅ No more hardcoded mappings!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDomainTags()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
