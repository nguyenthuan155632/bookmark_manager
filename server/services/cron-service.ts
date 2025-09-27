import cron from 'node-cron';

class CronService {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor() {
    this.setupCronJob();
  }

  private setupCronJob(): void {
    // Run every 5 minutes
    const cronExpression = '*/1 * * * *';

    this.cronJob = cron.schedule(cronExpression, () => {
      this.executeCronJob();
    }, {
      scheduled: false,
      timezone: 'UTC'
    });

    // Log configuration during initialization, not in constructor
    console.log(`⏰ Cron job configured to run every 5 minutes with expression: ${cronExpression}`);
  }

  private async executeCronJob(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Cron job is already running, skipping this execution');
      return;
    }

    try {
      this.isRunning = true;
      const timestamp = new Date().toISOString();

      console.log(`🕒 Cron job executed at ${timestamp}`);

      // Execute the main cron tasks
      await this.performCronTasks();

      console.log(`✅ Cron job completed successfully at ${timestamp}`);
    } catch (error) {
      console.error(`❌ Cron job failed at ${new Date().toISOString()}:`, error);

      // Don't throw the error - we don't want to crash the main server
      // Just log it and continue
    } finally {
      this.isRunning = false;
    }
  }

  private async performCronTasks(): Promise<void> {
    // This is where you would add your actual cron job logic
    // For now, we'll just log a message as requested

    console.log('📋 Performing scheduled tasks...');

    // Example tasks you might want to add:
    // - Clean up expired sessions
    // - Check bookmark statuses
    // - Send notifications
    // - Generate reports
    // - Update caches
    // - Database maintenance
    // - Log rotation

    // Simulate some work (remove this in production)
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('✨ Scheduled tasks completed');
  }

  public start(): void {
    if (this.cronJob && !this.cronJob.running) {
      this.cronJob.start();
      console.log('🚀 Cron service started successfully');
    } else if (this.cronJob?.running) {
      console.log('ℹ️ Cron service is already running');
    } else {
      console.log('⚠️ Cannot start cron service - no cron job configured');
    }
  }

  public stop(): void {
    if (this.cronJob && this.cronJob.running) {
      this.cronJob.stop();
      console.log('🛑 Cron service stopped successfully');
    } else {
      console.log('ℹ️ Cron service is not running');
    }
  }

  public getStatus(): { isRunning: boolean; isScheduled: boolean; lastRun?: string } {
    return {
      isRunning: this.isRunning,
      isScheduled: this.cronJob ? this.cronJob.running : false,
      lastRun: this.isRunning ? 'Currently running' : undefined
    };
  }

  // Method to manually trigger the cron job for testing
  public async triggerManually(): Promise<void> {
    console.log('⚡ Manually triggering cron job...');
    await this.executeCronJob();
  }
}

// Create a singleton instance
const cronService = new CronService();

export default cronService;