# Railway Integrated Cron Job Setup Guide

This guide explains how to deploy and run the integrated cron job service on Railway.

## Overview

The cron job service is now integrated directly into your main application server. It executes scheduled tasks every 5 minutes automatically when the server is running. No separate service is needed.

## Railway Deployment

### 1. Use Your Existing Railway Service

The cron job runs within your main application, so you don't need to create a separate service. Simply deploy your main application as usual.

### 2. Configuration

Your existing Railway configuration works perfectly. The integrated cron job will:

- Start automatically when the server starts
- Run every 5 minutes
- Log all executions to your application logs
- Share the same environment variables and database connections

### 3. Environment Variables

No additional environment variables are needed. The cron job uses the same environment as your main application:

- `DATABASE_URL` - Available for database operations
- `SESSION_SECRET` - Available for session management
- All other application variables are accessible

### 4. Monitoring

- Check the logs in your Railway dashboard
- Look for these log messages:
  - `⏰ Cron job configured to run every 5 minutes`
  - `🚀 Cron service started successfully`
  - `🕒 Cron job executed at <timestamp>`
  - `✅ Cron job completed successfully`
  - `✨ Scheduled tasks completed`

## Local Development

### Running the Integrated Service Locally

```bash
# Development mode (includes cron job)
npm run dev

# Production mode (includes cron job)
npm run start

# Test the cron job functionality manually
npx tsx server/test-cron.ts
```

### Expected Output

When running, you should see logs like:
```
🚀 Starting cron server...
Cron job configured to run every 5 minutes with expression: */5 * * * *
🚀 Cron service started
✅ Cron server started successfully
📊 Cron service status: { isRunning: false, isScheduled: true }
```

Every 5 minutes, you'll see:
```
🕒 Cron job executed at 2025-09-27T03:19:14.428Z
📋 Performing scheduled tasks...
✨ Scheduled tasks completed
✅ Cron job completed successfully at 2025-09-27T03:19:14.428Z
```

## Cron Job Implementation

The cron job service includes:

- **CronService Class**: Handles the scheduling and execution of tasks
- **CronServer Class**: Manages the server lifecycle and graceful shutdown
- **Error Handling**: Comprehensive error handling and logging
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT

### Customizing Tasks

To modify what the cron job does, edit the `performCronTasks()` method in `server/services/cron-service.ts`:

```typescript
private async performCronTasks(): Promise<void> {
  console.log('📋 Performing scheduled tasks...');

  // Add your custom tasks here
  // Example:
  // - Clean up expired sessions
  // - Check bookmark statuses
  // - Send notifications
  // - Update caches

  console.log('✨ Scheduled tasks completed');
}
```

### Changing the Schedule

To change the execution frequency, modify the cron expression in `server/services/cron-service.ts`:

```typescript
// Current: Every 5 minutes
const cronExpression = '*/5 * * * *';

// Examples:
// Every hour: '0 * * * *'
// Every day at midnight: '0 0 * * *'
// Every Monday at 9 AM: '0 9 * * 1'
```

## Troubleshooting

### Common Issues

1. **Service not starting**: Check that all dependencies are installed
2. **Cron job not running**: Verify the cron expression is valid
3. **Permission errors**: Ensure Railway service has proper permissions
4. **Missing environment variables**: Check that all required env vars are set

### Debug Mode

For debugging, you can run in development mode with more verbose logging:

```bash
npm run cron:dev
```

### Health Checks

The cron service doesn't expose HTTP endpoints by default. If you need health checks, you can add an Express server to the cron service.

## Files Added

- `server/services/cron-service.ts` - Core cron job logic
- `server/cron-server.ts` - Standalone cron server
- `server/test-cron.ts` - Test script for manual execution
- `railway.cron.toml` - Railway configuration template
- Updated `package.json` with new scripts and dependencies