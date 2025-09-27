import cronService from './services/cron-service';

async function testCronJob() {
  console.log('🧪 Testing integrated cron job...');

  try {
    // Start the cron service
    cronService.start();

    // Manually trigger the cron job for testing
    console.log('⚡ Manually triggering cron job...');
    await cronService.triggerManually();

    console.log('✅ Cron job test completed successfully');

    // Stop the service
    cronService.stop();

    console.log('🛑 Cron service stopped');

  } catch (error) {
    console.error('❌ Cron job test failed:', error);
    process.exit(1);
  }
}

testCronJob();