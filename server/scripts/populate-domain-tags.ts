import 'dotenv/config';
import { db } from '../db';
import { domainTags } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Migration script to populate domain_tags table with comprehensive domain mappings
 * Run this with: npx tsx server/scripts/populate-domain-tags.ts
 */
async function populateDomainTags() {
  try {
    console.log('🌐 Populating domain tags database...\n');

    // Comprehensive domain-to-tags mapping
    const domainTagData = [
      // Development & Programming
      { domain: 'github.com', tags: ['development', 'code', 'git', 'repository'], category: 'development', description: 'GitHub - Code repository hosting' },
      { domain: 'gitlab.com', tags: ['development', 'code', 'git', 'repository'], category: 'development', description: 'GitLab - DevOps platform' },
      { domain: 'bitbucket.org', tags: ['development', 'code', 'git', 'repository'], category: 'development', description: 'Bitbucket - Git repository hosting' },
      { domain: 'stackoverflow.com', tags: ['programming', 'help', 'q&a', 'development'], category: 'development', description: 'Stack Overflow - Programming Q&A' },
      { domain: 'stackexchange.com', tags: ['programming', 'help', 'q&a', 'development'], category: 'development', description: 'Stack Exchange - Q&A network' },
      { domain: 'dev.to', tags: ['development', 'blog', 'programming'], category: 'development', description: 'DEV Community - Developer blog platform' },
      { domain: 'hashnode.com', tags: ['development', 'blog', 'programming'], category: 'development', description: 'Hashnode - Developer blogging platform' },
      { domain: 'codepen.io', tags: ['development', 'demo', 'frontend'], category: 'development', description: 'CodePen - Frontend development playground' },
      { domain: 'jsfiddle.net', tags: ['development', 'demo', 'javascript'], category: 'development', description: 'JSFiddle - JavaScript playground' },
      { domain: 'codesandbox.io', tags: ['development', 'demo', 'react', 'vue'], category: 'development', description: 'CodeSandbox - Online IDE' },
      { domain: 'replit.com', tags: ['development', 'ide', 'programming'], category: 'development', description: 'Replit - Online coding environment' },
      { domain: 'glitch.com', tags: ['development', 'demo', 'web'], category: 'development', description: 'Glitch - Web app development platform' },

      // Package Managers & Libraries
      { domain: 'npmjs.com', tags: ['javascript', 'package', 'development'], category: 'development', description: 'npm - JavaScript package registry' },
      { domain: 'yarnpkg.com', tags: ['javascript', 'package', 'development'], category: 'development', description: 'Yarn - JavaScript package manager' },
      { domain: 'pypi.org', tags: ['python', 'package', 'development'], category: 'development', description: 'PyPI - Python package index' },
      { domain: 'crates.io', tags: ['rust', 'package', 'development'], category: 'development', description: 'Crates.io - Rust package registry' },
      { domain: 'packagist.org', tags: ['php', 'package', 'development'], category: 'development', description: 'Packagist - PHP package repository' },
      { domain: 'rubygems.org', tags: ['ruby', 'package', 'development'], category: 'development', description: 'RubyGems - Ruby package manager' },
      { domain: 'mvnrepository.com', tags: ['java', 'package', 'development'], category: 'development', description: 'Maven Repository - Java packages' },

      // Documentation & Learning
      { domain: 'mdn.mozilla.org', tags: ['documentation', 'web', 'development'], category: 'documentation', description: 'MDN - Web development documentation' },
      { domain: 'w3schools.com', tags: ['tutorial', 'web', 'development'], category: 'education', description: 'W3Schools - Web development tutorials' },
      { domain: 'developer.mozilla.org', tags: ['documentation', 'web', 'development'], category: 'documentation', description: 'MDN Developer Network' },
      { domain: 'docs.microsoft.com', tags: ['documentation', 'microsoft', 'development'], category: 'documentation', description: 'Microsoft Developer Documentation' },
      { domain: 'docs.aws.amazon.com', tags: ['documentation', 'aws', 'cloud'], category: 'documentation', description: 'AWS Documentation' },
      { domain: 'docs.azure.com', tags: ['documentation', 'azure', 'cloud'], category: 'documentation', description: 'Azure Documentation' },

      // Video & Media
      { domain: 'youtube.com', tags: ['video', 'entertainment', 'media'], category: 'media', description: 'YouTube - Video sharing platform' },
      { domain: 'youtu.be', tags: ['video', 'entertainment', 'media'], category: 'media', description: 'YouTube - Short URL' },
      { domain: 'vimeo.com', tags: ['video', 'creative', 'media'], category: 'media', description: 'Vimeo - Video hosting platform' },
      { domain: 'twitch.tv', tags: ['video', 'gaming', 'streaming'], category: 'media', description: 'Twitch - Live streaming platform' },
      { domain: 'netflix.com', tags: ['video', 'entertainment', 'streaming'], category: 'media', description: 'Netflix - Streaming service' },

      // Social & Community
      { domain: 'reddit.com', tags: ['social', 'community', 'discussion'], category: 'social', description: 'Reddit - Social news aggregation' },
      { domain: 'twitter.com', tags: ['social', 'microblog'], category: 'social', description: 'Twitter - Microblogging platform' },
      { domain: 'x.com', tags: ['social', 'microblog'], category: 'social', description: 'X (formerly Twitter)' },
      { domain: 'linkedin.com', tags: ['professional', 'networking', 'career'], category: 'social', description: 'LinkedIn - Professional networking' },
      { domain: 'facebook.com', tags: ['social', 'networking'], category: 'social', description: 'Facebook - Social networking' },
      { domain: 'instagram.com', tags: ['social', 'photo', 'visual'], category: 'social', description: 'Instagram - Photo sharing' },
      { domain: 'tiktok.com', tags: ['social', 'video', 'short-form'], category: 'social', description: 'TikTok - Short-form video' },

      // Design & Creative
      { domain: 'dribbble.com', tags: ['design', 'ui', 'portfolio'], category: 'design', description: 'Dribbble - Design portfolio platform' },
      { domain: 'behance.net', tags: ['design', 'portfolio', 'creative'], category: 'design', description: 'Behance - Creative portfolio platform' },
      { domain: 'figma.com', tags: ['design', 'ui', 'tool', 'collaboration'], category: 'design', description: 'Figma - Collaborative design tool' },
      { domain: 'sketch.com', tags: ['design', 'ui', 'tool'], category: 'design', description: 'Sketch - Digital design tool' },
      { domain: 'adobe.com', tags: ['design', 'creative', 'software'], category: 'design', description: 'Adobe - Creative software suite' },
      { domain: 'canva.com', tags: ['design', 'graphics', 'tool'], category: 'design', description: 'Canva - Graphic design platform' },
      { domain: 'unsplash.com', tags: ['photos', 'stock', 'images'], category: 'design', description: 'Unsplash - Free stock photos' },
      { domain: 'pexels.com', tags: ['photos', 'stock', 'images'], category: 'design', description: 'Pexels - Free stock photos' },
      { domain: 'fonts.google.com', tags: ['fonts', 'typography', 'design'], category: 'design', description: 'Google Fonts - Web fonts' },

      // Productivity & Tools
      { domain: 'notion.so', tags: ['productivity', 'notes', 'tool'], category: 'productivity', description: 'Notion - All-in-one workspace' },
      { domain: 'trello.com', tags: ['productivity', 'project-management', 'tool'], category: 'productivity', description: 'Trello - Project management' },
      { domain: 'asana.com', tags: ['productivity', 'project-management', 'tool'], category: 'productivity', description: 'Asana - Work management' },
      { domain: 'slack.com', tags: ['productivity', 'communication', 'tool'], category: 'productivity', description: 'Slack - Team communication' },
      { domain: 'discord.com', tags: ['communication', 'gaming', 'community'], category: 'productivity', description: 'Discord - Voice and text chat' },
      { domain: 'zoom.us', tags: ['communication', 'video', 'meeting'], category: 'productivity', description: 'Zoom - Video conferencing' },
      { domain: 'meet.google.com', tags: ['communication', 'video', 'meeting'], category: 'productivity', description: 'Google Meet - Video conferencing' },

      // Google Services
      { domain: 'google.com', tags: ['search', 'tool'], category: 'search', description: 'Google - Search engine' },
      { domain: 'docs.google.com', tags: ['document', 'collaboration', 'productivity'], category: 'productivity', description: 'Google Docs - Online document editor' },
      { domain: 'sheets.google.com', tags: ['spreadsheet', 'data', 'productivity'], category: 'productivity', description: 'Google Sheets - Online spreadsheet' },
      { domain: 'slides.google.com', tags: ['presentation', 'slides', 'productivity'], category: 'productivity', description: 'Google Slides - Online presentation' },
      { domain: 'drive.google.com', tags: ['storage', 'file-sharing', 'productivity'], category: 'productivity', description: 'Google Drive - Cloud storage' },
      { domain: 'gmail.com', tags: ['email', 'communication'], category: 'productivity', description: 'Gmail - Email service' },
      { domain: 'calendar.google.com', tags: ['calendar', 'scheduling', 'productivity'], category: 'productivity', description: 'Google Calendar - Online calendar' },

      // Cloud & Infrastructure
      { domain: 'aws.amazon.com', tags: ['cloud', 'infrastructure', 'aws'], category: 'cloud', description: 'Amazon Web Services - Cloud platform' },
      { domain: 'azure.microsoft.com', tags: ['cloud', 'infrastructure', 'azure'], category: 'cloud', description: 'Microsoft Azure - Cloud platform' },
      { domain: 'cloud.google.com', tags: ['cloud', 'infrastructure', 'gcp'], category: 'cloud', description: 'Google Cloud Platform - Cloud services' },
      { domain: 'digitalocean.com', tags: ['cloud', 'hosting', 'infrastructure'], category: 'cloud', description: 'DigitalOcean - Cloud infrastructure' },
      { domain: 'heroku.com', tags: ['cloud', 'hosting', 'paas'], category: 'cloud', description: 'Heroku - Platform as a Service' },
      { domain: 'vercel.com', tags: ['cloud', 'hosting', 'frontend'], category: 'cloud', description: 'Vercel - Frontend cloud platform' },
      { domain: 'netlify.com', tags: ['cloud', 'hosting', 'frontend'], category: 'cloud', description: 'Netlify - Web development platform' },

      // E-commerce & Business
      { domain: 'shopify.com', tags: ['ecommerce', 'store', 'business'], category: 'business', description: 'Shopify - E-commerce platform' },
      { domain: 'woocommerce.com', tags: ['ecommerce', 'wordpress', 'business'], category: 'business', description: 'WooCommerce - WordPress e-commerce' },
      { domain: 'stripe.com', tags: ['payment', 'api', 'fintech'], category: 'business', description: 'Stripe - Payment processing' },
      { domain: 'paypal.com', tags: ['payment', 'fintech'], category: 'business', description: 'PayPal - Online payment system' },
      { domain: 'squareup.com', tags: ['payment', 'pos', 'business'], category: 'business', description: 'Square - Payment and POS system' },

      // Content Management
      { domain: 'wordpress.com', tags: ['blog', 'cms', 'website'], category: 'cms', description: 'WordPress.com - Blog and website platform' },
      { domain: 'wordpress.org', tags: ['cms', 'open-source', 'website'], category: 'cms', description: 'WordPress.org - Open source CMS' },
      { domain: 'wix.com', tags: ['website', 'builder', 'tool'], category: 'cms', description: 'Wix - Website builder' },
      { domain: 'squarespace.com', tags: ['website', 'builder', 'design'], category: 'cms', description: 'Squarespace - Website builder' },
      { domain: 'webflow.com', tags: ['website', 'design', 'cms'], category: 'cms', description: 'Webflow - Visual web design platform' },

      // Education & Learning
      { domain: 'coursera.org', tags: ['education', 'course', 'learning'], category: 'education', description: 'Coursera - Online courses' },
      { domain: 'udemy.com', tags: ['education', 'course', 'learning'], category: 'education', description: 'Udemy - Online learning platform' },
      { domain: 'edx.org', tags: ['education', 'course', 'learning'], category: 'education', description: 'edX - Online courses' },
      { domain: 'khanacademy.org', tags: ['education', 'learning', 'free'], category: 'education', description: 'Khan Academy - Free online learning' },
      { domain: 'freecodecamp.org', tags: ['education', 'programming', 'free'], category: 'education', description: 'freeCodeCamp - Free programming education' },
      { domain: 'codecademy.com', tags: ['education', 'programming', 'interactive'], category: 'education', description: 'Codecademy - Interactive programming courses' },
      { domain: 'pluralsight.com', tags: ['education', 'technology', 'learning'], category: 'education', description: 'Pluralsight - Technology learning platform' },
      { domain: 'udacity.com', tags: ['education', 'programming', 'nanodegree'], category: 'education', description: 'Udacity - Technology education' },

      // News & Media
      { domain: 'hackernews.com', tags: ['tech', 'news', 'startup'], category: 'news', description: 'Hacker News - Tech news and discussion' },
      { domain: 'news.ycombinator.com', tags: ['tech', 'news', 'startup'], category: 'news', description: 'Hacker News - Tech news and discussion' },
      { domain: 'techcrunch.com', tags: ['tech', 'news', 'startup'], category: 'news', description: 'TechCrunch - Technology news' },
      { domain: 'arstechnica.com', tags: ['tech', 'news'], category: 'news', description: 'Ars Technica - Technology news' },
      { domain: 'theverge.com', tags: ['tech', 'news', 'culture'], category: 'news', description: 'The Verge - Technology and culture' },
      { domain: 'wired.com', tags: ['tech', 'news', 'culture'], category: 'news', description: 'Wired - Technology and culture magazine' },
      { domain: 'medium.com', tags: ['article', 'blog', 'writing'], category: 'media', description: 'Medium - Publishing platform' },
      { domain: 'substack.com', tags: ['newsletter', 'writing', 'subscription'], category: 'media', description: 'Substack - Newsletter platform' },

      // Reference & Knowledge
      { domain: 'wikipedia.org', tags: ['reference', 'encyclopedia', 'knowledge'], category: 'reference', description: 'Wikipedia - Free encyclopedia' },
      { domain: 'wikimedia.org', tags: ['reference', 'encyclopedia', 'knowledge'], category: 'reference', description: 'Wikimedia Foundation' },
      { domain: 'britannica.com', tags: ['reference', 'encyclopedia', 'knowledge'], category: 'reference', description: 'Encyclopedia Britannica' },
      { domain: 'dictionary.com', tags: ['reference', 'dictionary', 'language'], category: 'reference', description: 'Dictionary.com - Online dictionary' },
      { domain: 'merriam-webster.com', tags: ['reference', 'dictionary', 'language'], category: 'reference', description: 'Merriam-Webster - Dictionary' },

      // Communication & APIs
      { domain: 'twilio.com', tags: ['communication', 'api', 'sms'], category: 'api', description: 'Twilio - Communication platform API' },
      { domain: 'sendgrid.com', tags: ['email', 'api', 'communication'], category: 'api', description: 'SendGrid - Email API' },
      { domain: 'mailchimp.com', tags: ['email', 'marketing', 'communication'], category: 'api', description: 'Mailchimp - Email marketing platform' },
      { domain: 'hubspot.com', tags: ['marketing', 'crm', 'business'], category: 'business', description: 'HubSpot - Marketing and sales platform' },
      { domain: 'salesforce.com', tags: ['crm', 'business', 'sales'], category: 'business', description: 'Salesforce - Customer relationship management' },

      // Development Tools & Services
      { domain: 'travis-ci.com', tags: ['ci', 'testing', 'development'], category: 'development', description: 'Travis CI - Continuous integration' },
      { domain: 'circleci.com', tags: ['ci', 'testing', 'development'], category: 'development', description: 'CircleCI - Continuous integration' },
    ];

    console.log(`📝 Inserting ${domainTagData.length} domain tag mappings...`);

    // Clear existing data (optional - comment out if you want to keep existing data)
    console.log('🗑️  Clearing existing domain tags...');
    await db.delete(domainTags);
    console.log('✅ Existing domain tags cleared');

    // Insert all domain tag mappings
    let inserted = 0;
    for (const domainData of domainTagData) {
      try {
        await db.insert(domainTags).values(domainData);
        inserted++;
        if (inserted % 10 === 0) {
          console.log(`   📊 Inserted ${inserted}/${domainTagData.length} domains...`);
        }
      } catch (error) {
        console.warn(`   ⚠️  Failed to insert ${domainData.domain}:`, error);
      }
    }

    console.log(`✅ Successfully inserted ${inserted} domain tag mappings`);

    // Verify the data
    const count = await db.execute(sql`SELECT COUNT(*) as count FROM domain_tags`);
    const totalCount = (count.rows[0] as any).count;
    console.log(`📊 Total domain tags in database: ${totalCount}`);

    // Show some statistics
    const categoryStats = await db.execute(sql`
      SELECT category, COUNT(*) as count 
      FROM domain_tags 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC
    `);

    console.log('\n📈 Domain tags by category:');
    categoryStats.rows.forEach((row: any) => {
      console.log(`   ${row.category}: ${row.count} domains`);
    });

    console.log('\n🎉 Domain tags population completed successfully!');
    console.log('\n✨ Benefits:');
    console.log('• Dynamic domain-to-tags mapping');
    console.log('• Easy to add new domains via API');
    console.log('• Categorized for better organization');
    console.log('• Searchable and maintainable');
    console.log('• No more hardcoded mappings!');

  } catch (error) {
    console.error('❌ Population failed:', error);
    process.exit(1);
  }
}

// Run the population
populateDomainTags()
  .then(() => {
    console.log('\nPopulation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Population failed:', error);
    process.exit(1);
  });
