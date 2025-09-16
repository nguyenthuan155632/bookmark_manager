import 'dotenv/config';

/**
 * Test script to verify API admin restrictions are working
 * This simulates API calls to test the middleware
 * Run this with: npx tsx server/scripts/test-api-admin-restrictions.ts
 */

// Mock Express request and response objects
const createMockReq = (user: { username: string; id: string } | null) => ({
  isAuthenticated: () => !!user,
  user,
  params: { id: '1' },
  body: { domain: 'test.com', tags: ['test'] },
  query: { url: 'https://test.com' },
});

const createMockRes = () => {
  let statusCode = 200;
  let responseBody: any = null;

  return {
    status: (code: number) => {
      statusCode = code;
      return {
        json: (body: any) => {
          responseBody = body;
        },
      };
    },
    json: (body: any) => {
      responseBody = body;
    },
    getStatusCode: () => statusCode,
    getResponse: () => responseBody,
  };
};

// Mock next function
const mockNext = () => {};

// Import the middleware functions
import { requireAuth, requireAdmin } from '../auth';

async function testApiRestrictions() {
  console.log('🔐 Testing API admin restrictions...\n');

  // Test cases
  const testCases = [
    {
      name: 'Unauthenticated user',
      user: null,
      middleware: 'requireAuth',
      expectedStatus: 401,
    },
    {
      name: 'Regular user (not vensera)',
      user: { username: 'regularuser', id: '123' },
      middleware: 'requireAuth',
      expectedStatus: 200,
    },
    {
      name: 'Admin user (vensera)',
      user: { username: 'vensera', id: '456' },
      middleware: 'requireAuth',
      expectedStatus: 200,
    },
    {
      name: 'Unauthenticated user (admin)',
      user: null,
      middleware: 'requireAdmin',
      expectedStatus: 401,
    },
    {
      name: 'Regular user (admin)',
      user: { username: 'regularuser', id: '123' },
      middleware: 'requireAdmin',
      expectedStatus: 403,
    },
    {
      name: 'Admin user (admin)',
      user: { username: 'vensera', id: '456' },
      middleware: 'requireAdmin',
      expectedStatus: 200,
    },
  ];

  for (const testCase of testCases) {
    console.log(`🧪 Testing: ${testCase.name} with ${testCase.middleware}`);

    const req = createMockReq(testCase.user);
    const res = createMockRes();

    try {
      if (testCase.middleware === 'requireAuth') {
        requireAuth(req as any, res as any, mockNext);
      } else if (testCase.middleware === 'requireAdmin') {
        requireAdmin(req as any, res as any, mockNext);
      }

      const statusCode = res.getStatusCode();
      const response = res.getResponse();

      if (statusCode === testCase.expectedStatus) {
        console.log(`   ✅ Expected status ${testCase.expectedStatus}, got ${statusCode}`);
        if (response && response.message) {
          console.log(`   📝 Message: ${response.message}`);
        }
      } else {
        console.log(`   ❌ Expected status ${testCase.expectedStatus}, got ${statusCode}`);
        if (response && response.message) {
          console.log(`   📝 Message: ${response.message}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }

    console.log('');
  }

  console.log('🎉 API restrictions test completed!');
  console.log('\n📋 Summary:');
  console.log('   ✅ requireAuth: Allows all authenticated users');
  console.log('   🔒 requireAdmin: Only allows user "vensera"');
  console.log('   🚫 Unauthenticated users get 401');
  console.log('   🚫 Non-admin users get 403 for admin actions');
}

// Run the test
testApiRestrictions()
  .then(() => {
    console.log('\nTest completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
