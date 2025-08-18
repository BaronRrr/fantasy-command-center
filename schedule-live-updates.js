const cron = require('node-cron');
const LiveDataUpdater = require('./update-live-data');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/live-updates.log' })
  ]
});

class LiveDataScheduler {
  constructor() {
    this.updater = new LiveDataUpdater();
    this.isRunning = false;
    this.schedules = new Map();
  }

  start() {
    if (this.isRunning) {
      logger.info('Live data scheduler already running');
      return;
    }

    logger.info('🚀 STARTING AUTOMATED LIVE DATA UPDATES');
    
    // Schedule news updates every 30 minutes
    this.schedules.set('news', cron.schedule('*/30 * * * *', async () => {
      try {
        logger.info('⏰ Scheduled news update starting...');
        await this.updater.updateNews();
        logger.info('✅ Scheduled news update completed');
      } catch (error) {
        logger.error('❌ Scheduled news update failed:', error.message);
      }
    }));

    // Schedule scores updates every 15 minutes during game days (Sunday, Monday, Thursday)
    this.schedules.set('scores', cron.schedule('*/15 * * * 0,1,4', async () => {
      try {
        logger.info('⏰ Scheduled scores update starting...');
        await this.updater.updateScores();
        logger.info('✅ Scheduled scores update completed');
      } catch (error) {
        logger.error('❌ Scheduled scores update failed:', error.message);
      }
    }));

    // Schedule team data updates every 2 hours
    this.schedules.set('teams', cron.schedule('0 */2 * * *', async () => {
      try {
        logger.info('⏰ Scheduled teams update starting...');
        await this.updater.updateTeams();
        logger.info('✅ Scheduled teams update completed');
      } catch (error) {
        logger.error('❌ Scheduled teams update failed:', error.message);
      }
    }));

    // Schedule health check every hour
    this.schedules.set('health', cron.schedule('0 * * * *', async () => {
      try {
        await this.updater.testAPIs();
      } catch (error) {
        logger.error('❌ Health check failed:', error.message);
      }
    }));

    this.isRunning = true;
    
    console.log('\n🎯 LIVE DATA AUTOMATION ACTIVE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📰 News Updates: Every 30 minutes');
    console.log('🏈 Game Scores: Every 15 minutes (Game Days)');
    console.log('🏈 Team Data: Every 2 hours');
    console.log('🔍 Health Check: Every hour');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 Your Discord AI now auto-updates with live NFL data!');
    console.log('💡 Run this script to keep data fresh automatically');
    
    // Initial update
    this.runInitialUpdate();
  }

  async runInitialUpdate() {
    logger.info('🔄 Running initial data update...');
    try {
      await this.updater.runFullUpdate();
      logger.info('✅ Initial data update completed');
    } catch (error) {
      logger.error('❌ Initial data update failed:', error.message);
    }
  }

  stop() {
    if (!this.isRunning) {
      logger.info('Live data scheduler not running');
      return;
    }

    logger.info('🛑 Stopping automated live data updates');
    
    // Destroy all scheduled tasks
    for (const [name, schedule] of this.schedules) {
      schedule.destroy();
      logger.info(`Stopped ${name} updates`);
    }
    
    this.schedules.clear();
    this.isRunning = false;
    
    console.log('🛑 Live data automation stopped');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      schedulesActive: this.schedules.size,
      schedules: {
        news: 'Every 30 minutes',
        scores: 'Every 15 minutes (Game days: Sun, Mon, Thu)',
        teams: 'Every 2 hours',
        health: 'Every hour'
      }
    };
  }

  // Manual trigger methods
  async triggerNewsUpdate() {
    logger.info('📰 Manual news update triggered');
    await this.updater.updateNews();
  }

  async triggerScoresUpdate() {
    logger.info('🏈 Manual scores update triggered');
    await this.updater.updateScores();
  }

  async triggerTeamsUpdate() {
    logger.info('🏈 Manual teams update triggered');
    await this.updater.updateTeams();
  }

  async triggerFullUpdate() {
    logger.info('🚀 Manual full update triggered');
    await this.updater.runFullUpdate();
  }
}

// CLI interface
async function main() {
  const scheduler = new LiveDataScheduler();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--stop')) {
    scheduler.stop();
    process.exit(0);
  }
  
  if (args.includes('--status')) {
    const status = scheduler.getStatus();
    console.log('\n📊 LIVE DATA SCHEDULER STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🟢 Running: ${status.isRunning}`);
    console.log(`📋 Active Schedules: ${status.schedulesActive}`);
    console.log('\n⏰ SCHEDULE:');
    Object.entries(status.schedules).forEach(([name, schedule]) => {
      console.log(`   ${name}: ${schedule}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }
  
  if (args.includes('--news')) {
    await scheduler.triggerNewsUpdate();
    return;
  }
  
  if (args.includes('--scores')) {
    await scheduler.triggerScoresUpdate();
    return;
  }
  
  if (args.includes('--teams')) {
    await scheduler.triggerTeamsUpdate();
    return;
  }
  
  if (args.includes('--full')) {
    await scheduler.triggerFullUpdate();
    return;
  }
  
  // Default: start the scheduler
  scheduler.start();
  
  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Received interrupt signal, stopping scheduler...');
    scheduler.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Received terminate signal, stopping scheduler...');
    scheduler.stop();
    process.exit(0);
  });
  
  // Keep process alive
  setInterval(() => {
    // Keep alive - the cron jobs will handle the scheduling
  }, 60000);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LiveDataScheduler;