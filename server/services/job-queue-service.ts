import {
  aiCrawlerSettings,
  aiFeedJobs,
  aiFeedSources,
  userPreferences,
  type AiFeedJob,
  type AiFeedSource,
} from '@shared/schema.js';
import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '../db';

export class JobQueueService {
  private isProcessing = false;
  private processingInterval?: NodeJS.Timeout;

  constructor() {
    this.startJobProcessor();
  }

  /**
   * Create a new feed processing job
   */
  async createJob(sourceId: number, userId: string, priority: number = 0): Promise<AiFeedJob> {
    // Get user settings for AI processing
    const settings = await db
      .select()
      .from(aiCrawlerSettings)
      .where(eq(aiCrawlerSettings.userId, userId));

    if (settings.length === 0) {
      throw new Error('AI crawler settings not found');
    }

    // Get user preferences for language settings
    const userPrefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    // Merge crawler settings with user preferences
    const jobSettings = {
      ...settings[0],
      defaultAiLanguage: userPrefs[0]?.defaultAiLanguage || 'auto'
    };

    // Create the job
    const job = await db.insert(aiFeedJobs).values({
      sourceId,
      userId,
      status: 'pending',
      priority,
      settings: jobSettings,
      scheduledAt: new Date(),
    }).returning();

    console.log(`📝 Created job ${job[0].id} for source ${sourceId}`);
    return job[0];
  }

  /**
   * Start the job processor to check for pending jobs
   */
  private startJobProcessor(): void {
    // Check for pending jobs every 30 seconds
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processPendingJobs();
      }
    }, 30000);

    console.log('🔄 Job queue processor started (checking every 30 seconds)');
  }

  /**
   * Process pending jobs
   */
  private async processPendingJobs(): Promise<void> {
    if (this.isProcessing) {
      console.log('⚠️ Job processor already running, skipping this cycle');
      return;
    }

    try {
      this.isProcessing = true;

      // Find pending jobs that are scheduled to run now AND running jobs that have been running for more than 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      const pendingJobs = await db
        .select()
        .from(aiFeedJobs)
        .leftJoin(aiFeedSources, eq(aiFeedJobs.sourceId, aiFeedSources.id))
        .where(
          or(
            and(
              eq(aiFeedJobs.status, 'pending'),
              or(
                lt(aiFeedJobs.scheduledAt, new Date()),
                isNull(aiFeedJobs.scheduledAt)
              )
            ),
            and(
              eq(aiFeedJobs.status, 'running'),
              lt(aiFeedJobs.startedAt, fiveMinutesAgo)
            )
          )
        )
        .orderBy(desc(aiFeedJobs.priority), asc(aiFeedJobs.scheduledAt))
        .limit(5); // Process up to 5 jobs at once

      if (pendingJobs.length === 0) {
        return; // No pending jobs
      }

      console.log(`📋 Found ${pendingJobs.length} pending jobs to process`);

      // Process each job
      for (const jobRow of pendingJobs) {
        const job = jobRow.ai_feed_jobs;
        const source = jobRow.ai_feed_sources;

        if (!source) {
          console.error(`❌ Source not found for job ${job.id}`);
          await this.updateJobStatus(job.id, 'failed', 'Source not found');
          continue;
        }

        // Log if we're reprocessing a stuck running job
        if (job.status === 'running') {
          const runningDuration = Date.now() - new Date(job.startedAt!).getTime();
          console.log(`🔄 Reprocessing stuck job ${job.id} (running for ${Math.round(runningDuration / 1000 / 60)} minutes)`);
        }

        await this.processJob(job, source);
      }
    } catch (error) {
      console.error('❌ Error processing pending jobs:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: AiFeedJob, source: AiFeedSource): Promise<void> {
    try {
      console.log(`🚀 Processing job ${job.id} for source ${source.url}`);

      // Update job status to running
      await this.updateJobStatus(job.id, 'running');

      // Update source status to running
      await db
        .update(aiFeedSources)
        .set({ status: 'running' })
        .where(eq(aiFeedSources.id, source.id));

      // Process the feed using cron service logic
      const { default: cronService } = await import('./cron-service.js');
      await cronService.processSingleFeed(source, job.settings as any);

      // Update job status to completed
      await this.updateJobStatus(job.id, 'completed');

      console.log(`✅ Job ${job.id} completed successfully`);
    } catch (error) {
      console.error(`❌ Error processing job ${job.id}:`, error);

      const newRetryCount = (job.retryCount || 0) + 1;

      if (newRetryCount >= (job.maxRetries || 3)) {
        // Max retries reached, mark as failed
        await this.updateJobStatus(job.id, 'failed', error instanceof Error ? error.message : 'Unknown error');

        // Update source status to failed
        await db
          .update(aiFeedSources)
          .set({ status: 'failed' })
          .where(eq(aiFeedSources.id, source.id));
      } else {
        // Retry the job
        const retryDelay = Math.pow(2, newRetryCount) * 60000; // Exponential backoff: 1min, 2min, 4min
        const retryAt = new Date(Date.now() + retryDelay);

        await db
          .update(aiFeedJobs)
          .set({
            status: 'pending',
            retryCount: newRetryCount,
            scheduledAt: retryAt,
          })
          .where(eq(aiFeedJobs.id, job.id));

        console.log(`🔄 Job ${job.id} scheduled for retry at ${retryAt.toISOString()} (attempt ${newRetryCount}/${job.maxRetries})`);
      }
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(jobId: number, status: string, errorMessage?: string): Promise<void> {
    const updates: any = { status };

    if (status === 'running') {
      updates.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      updates.completedAt = new Date();
    }

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    await db
      .update(aiFeedJobs)
      .set(updates)
      .where(eq(aiFeedJobs.id, jobId));
  }

  /**
   * Get job status for a user
   */
  async getUserJobs(userId: string): Promise<AiFeedJob[]> {
    return await db
      .select()
      .from(aiFeedJobs)
      .where(eq(aiFeedJobs.userId, userId))
      .orderBy(desc(aiFeedJobs.scheduledAt))
      .limit(50);
  }

  /**
   * Get job statistics
   */
  async getJobStats(userId: string): Promise<{
    pending: number;
    running: number;
    completed: number;
    failed: number;
  }> {
    const stats = await db
      .select({
        status: aiFeedJobs.status,
        count: sql`count(*)`.mapWith(Number),
      })
      .from(aiFeedJobs)
      .where(eq(aiFeedJobs.userId, userId))
      .groupBy(aiFeedJobs.status);

    const result = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    stats.forEach(stat => {
      result[stat.status as keyof typeof result] = stat.count;
    });

    return result;
  }

  /**
   * Clean up old completed jobs (older than 7 days)
   */
  async cleanupOldJobs(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const result = await db
      .delete(aiFeedJobs)
      .where(
        and(
          eq(aiFeedJobs.status, 'completed'),
          lt(aiFeedJobs.completedAt, cutoffDate)
        )
      )
      .returning();

    console.log(`🧹 Cleaned up ${result.length} old completed jobs`);
  }

  /**
   * Stop the job processor
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
      console.log('🛑 Job queue processor stopped');
    }
  }

  /**
   * Manually trigger job processing
   */
  async triggerProcessing(): Promise<void> {
    if (!this.isProcessing) {
      await this.processPendingJobs();
    } else {
      console.log('⚠️ Job processor is already running');
    }
  }
}

// Create a singleton instance
export const jobQueueService = new JobQueueService();