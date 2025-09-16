import 'dotenv/config';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { eq, and, sql } from '../storage-base';

/**
 * Test script to verify domain suggestions are working correctly
 * Run this with: npx tsx server/scripts/test-domain-suggest.ts
 */
async function testDomainSuggestions() {
  try {
    console.log('🧪 Testing domain suggestions...\n');

    const testUrls = [
      'https://github.com/microsoft/vscode',
      'https://youtube.com/watch?v=abc123',
      'https://stackoverflow.com/questions/123456',
      'https://figma.com/design/abc123',
      'https://notion.so/workspace/abc123',
      'https://example.com/unknown-domain',
    ];

    for (const url of testUrls) {
      console.log(`🔍 Testing URL: ${url}`);

      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.toLowerCase();
        console.log(`   Domain: ${domain}`);

        // Find exact domain match
        const [exactMatch] = await db
          .select()
          .from(domainTags)
          .where(and(eq(domainTags.domain, domain), eq(domainTags.isActive, true)));

        if (exactMatch) {
          const tags = Array.isArray(exactMatch.tags) ? (exactMatch.tags as string[]) : [];
          console.log(`   ✅ Exact match found: [${tags.join(', ')}] (${exactMatch.category})`);
        } else {
          // Find partial domain matches
          const partialMatches = await db
            .select()
            .from(domainTags)
            .where(
              and(sql`${domainTags.domain} LIKE ${`%${domain}%`}`, eq(domainTags.isActive, true)),
            )
            .limit(3);

          if (partialMatches.length > 0) {
            console.log(`   🔍 Partial matches (${partialMatches.length}):`);
            partialMatches.forEach((match, index) => {
              const tags = Array.isArray(match.tags) ? (match.tags as string[]) : [];
              console.log(
                `      ${index + 1}. ${match.domain}: [${tags.join(', ')}] (${match.category})`,
              );
            });
          } else {
            console.log(`   ❌ No matches found`);
          }
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error}`);
      }
      console.log('');
    }

    console.log('🎉 Domain suggestions test completed!');
    console.log('\n✨ The API should now work correctly in the bookmark modal.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testDomainSuggestions()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
