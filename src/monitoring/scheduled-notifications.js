const cron = require('node-cron');
const winston = require('winston');
const AdvancedDataMonitor = require('./advanced-data-monitor');
const TwitterMonitor = require('./twitter-monitor');
const DiscordNotifier = require('../notifications/discord-notifier');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class ScheduledNotifications {
  constructor() {
    this.dataMonitor = new AdvancedDataMonitor();
    this.twitterMonitor = new TwitterMonitor();
    this.discordNotifier = new DiscordNotifier();
    this.isActive = false;
  }

  // Start all scheduled notifications
  start() {
    if (this.isActive) {
      logger.warn('Scheduled notifications already running');
      return;
    }

    this.isActive = true;
    logger.info('🔔 Starting scheduled notification system...');

    // DAILY MORNING REPORT (8:00 AM EST)
    cron.schedule('0 8 * * *', async () => {
      await this.sendMorningReport();
    }, {
      timezone: 'America/New_York'
    });

    // DAILY EVENING WRAP-UP (6:00 PM EST)
    cron.schedule('0 18 * * *', async () => {
      await this.sendEveningReport();
    }, {
      timezone: 'America/New_York'
    });

    // HOURLY CRITICAL MONITORING (during peak hours 8 AM - 10 PM)
    cron.schedule('0 8-22 * * *', async () => {
      await this.checkCriticalUpdates();
    }, {
      timezone: 'America/New_York'
    });

    // WEEKLY SUNDAY DIGEST (10:00 AM EST)
    cron.schedule('0 10 * * 0', async () => {
      await this.sendWeeklyDigest();
    }, {
      timezone: 'America/New_York'
    });

    // REAL-TIME MONITORING (every 5 minutes during active hours)
    cron.schedule('*/5 8-22 * * *', async () => {
      await this.monitorBreakingNews();
    }, {
      timezone: 'America/New_York'
    });

    logger.info('✅ All scheduled notifications active');
  }

  // MORNING INTELLIGENCE REPORT
  async sendMorningReport() {
    try {
      logger.info('🌅 Generating morning fantasy intelligence report...');

      const intelligence = await this.dataMonitor.getDraftIntelligence();
      const twitterInsights = this.twitterMonitor.getDraftRelevantInsights(null, 720); // Last 12 hours

      const embed = {
        title: '🌅 Daily Fantasy Intelligence Report',
        description: `Good morning! Here's your fantasy football intelligence briefing.`,
        color: 0x00FF00,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Morning Report'
        }
      };

      // Critical Alerts
      if (intelligence.critical_alerts.length > 0) {
        embed.fields.push({
          name: '🚨 Overnight Critical Updates',
          value: intelligence.critical_alerts.slice(0, 3).map(alert => 
            `• ${alert.player || alert.team}: ${alert.fantasy_impact || alert.change}`
          ).join('\n') || 'No critical updates',
          inline: false
        });
      }

      // Trending Players
      if (intelligence.trending_players.length > 0) {
        embed.fields.push({
          name: '📈 Trending Players (Reddit Buzz)',
          value: intelligence.trending_players.slice(0, 5).map(player => 
            `• ${player.name} (${player.mentions} mentions)`
          ).join('\n'),
          inline: true
        });
      }

      // Opportunities
      if (intelligence.opportunities.length > 0) {
        embed.fields.push({
          name: '💡 Fantasy Opportunities',
          value: intelligence.opportunities.slice(0, 3).map(opp => 
            `• ${opp.player}: ${opp.fantasy_impact}`
          ).join('\n'),
          inline: true
        });
      }

      // Twitter Breaking News
      if (twitterInsights && twitterInsights.critical_news.length > 0) {
        embed.fields.push({
          name: '🐦 Overnight Twitter News',
          value: twitterInsights.critical_news.slice(0, 2).map(news => 
            `• ${news.content.substring(0, 80)}...`
          ).join('\n'),
          inline: false
        });
      }

      if (embed.fields.length === 0) {
        embed.fields.push({
          name: '✅ All Quiet',
          value: 'No major overnight developments. Good news for your lineup!',
          inline: false
        });
      }

      await this.discordNotifier.sendEmbed(embed, 'INFO');
      logger.info('✅ Morning report sent');

    } catch (error) {
      logger.error('Failed to send morning report:', error.message);
    }
  }

  // EVENING WRAP-UP REPORT
  async sendEveningReport() {
    try {
      logger.info('🌆 Generating evening wrap-up report...');

      const intelligence = await this.dataMonitor.getDraftIntelligence();

      const embed = {
        title: '🌆 Evening Fantasy Wrap-Up',
        description: `Daily wrap-up of fantasy football developments.`,
        color: 0x0099FF,
        fields: [],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Evening Report'
        }
      };

      // Day's Key Updates
      if (intelligence.critical_alerts.length > 0) {
        embed.fields.push({
          name: '📰 Today\'s Key Developments',
          value: intelligence.critical_alerts.slice(0, 4).map(alert => 
            `• ${alert.player || alert.team}: ${alert.fantasy_impact || alert.change}`
          ).join('\n'),
          inline: false
        });
      }

      // Tomorrow's Focus
      embed.fields.push({
        name: '🎯 Tomorrow\'s Focus Areas',
        value: `• Monitor practice reports for injury updates\n• Check depth chart changes\n• Watch for breaking news alerts\n• Review waiver wire opportunities`,
        inline: false
      });

      await this.discordNotifier.sendEmbed(embed, 'INFO');
      logger.info('✅ Evening report sent');

    } catch (error) {
      logger.error('Failed to send evening report:', error.message);
    }
  }

  // CRITICAL UPDATES MONITORING
  async checkCriticalUpdates() {
    try {
      const intelligence = await this.dataMonitor.getDraftIntelligence();
      
      // Only send if there are critical alerts
      if (intelligence.critical_alerts.length > 0) {
        const recentAlerts = intelligence.critical_alerts.filter(alert => {
          const alertTime = new Date(alert.timestamp || Date.now());
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return alertTime > oneHourAgo;
        });

        if (recentAlerts.length > 0) {
          const embed = {
            title: '🚨 Fantasy Alert',
            description: 'Critical fantasy football update detected',
            color: 0xFF0000,
            fields: [{
              name: 'Breaking Update',
              value: recentAlerts.slice(0, 2).map(alert => 
                `• ${alert.player || alert.team}: ${alert.fantasy_impact || alert.change}`
              ).join('\n'),
              inline: false
            }],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Fantasy Command Center • Critical Alert'
            }
          };

          await this.discordNotifier.sendEmbed(embed, 'CRITICAL');
          logger.info(`🚨 Critical alert sent: ${recentAlerts.length} updates`);
        }
      }

    } catch (error) {
      logger.error('Failed to check critical updates:', error.message);
    }
  }

  // BREAKING NEWS MONITORING  
  async monitorBreakingNews() {
    try {
      const twitterInsights = this.twitterMonitor.getDraftRelevantInsights(null, 10); // Last 10 minutes
      
      if (twitterInsights && twitterInsights.critical_news.length > 0) {
        const breakingNews = twitterInsights.critical_news.filter(news => {
          const newsTime = new Date(news.timestamp);
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
          return newsTime > tenMinutesAgo;
        });

        if (breakingNews.length > 0) {
          const embed = {
            title: '⚡ Breaking Fantasy News',
            description: 'Real-time update from Twitter monitoring',
            color: 0xFF8800,
            fields: [{
              name: 'Just Reported',
              value: breakingNews[0].content,
              inline: false
            }, {
              name: 'Source',
              value: breakingNews[0].author,
              inline: true
            }],
            timestamp: new Date().toISOString(),
            footer: {
              text: 'Fantasy Command Center • Breaking News'
            }
          };

          await this.discordNotifier.sendEmbed(embed, 'HIGH');
          logger.info(`⚡ Breaking news alert sent: ${breakingNews[0].author}`);
        }
      }

    } catch (error) {
      logger.error('Failed to monitor breaking news:', error.message);
    }
  }

  // WEEKLY DIGEST
  async sendWeeklyDigest() {
    try {
      logger.info('📅 Generating weekly fantasy digest...');

      const embed = {
        title: '📅 Weekly Fantasy Football Digest',
        description: 'Your comprehensive weekly fantasy football summary',
        color: 0x9932CC,
        fields: [
          {
            name: '🏈 This Week\'s Key Themes',
            value: '• Monitor injury reports through Friday\n• Check for surprise inactive lists\n• Review matchup analysis\n• Plan waiver wire strategy',
            inline: false
          },
          {
            name: '🎯 Focus Areas',
            value: '• Practice participation trends\n• Depth chart changes\n• Weather impact on games\n• DFS value plays',
            inline: false
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Fantasy Command Center • Weekly Digest'
        }
      };

      await this.discordNotifier.sendEmbed(embed, 'INFO');
      logger.info('✅ Weekly digest sent');

    } catch (error) {
      logger.error('Failed to send weekly digest:', error.message);
    }
  }

  // Stop all notifications
  stop() {
    this.isActive = false;
    logger.info('⏹️ Scheduled notifications stopped');
  }

  // Get notification status
  getStatus() {
    return {
      active: this.isActive,
      next_reports: {
        morning: '8:00 AM EST daily',
        evening: '6:00 PM EST daily',
        weekly: '10:00 AM EST Sundays'
      },
      monitoring: {
        critical_checks: 'Hourly 8 AM - 10 PM EST',
        breaking_news: 'Every 5 minutes 8 AM - 10 PM EST'
      }
    };
  }
}

module.exports = ScheduledNotifications;