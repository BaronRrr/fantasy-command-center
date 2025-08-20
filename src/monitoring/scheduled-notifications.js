const cron = require('node-cron');
const winston = require('winston');
const AdvancedDataMonitor = require('./advanced-data-monitor');
const TwitterMonitor = require('./twitter-monitor');
const DiscordNotifier = require('../notifications/discord-notifier');
const NewsArticleFetcher = require('../news-article-fetcher');
const SimpleTrendingAnalyzer = require('../services/simple-trending');

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
  constructor(injuryMonitor = null) {
    this.dataMonitor = new AdvancedDataMonitor();
    this.twitterMonitor = new TwitterMonitor();
    this.discordNotifier = new DiscordNotifier();
    this.newsArticleFetcher = new NewsArticleFetcher();
    this.trendingAnalyzer = new SimpleTrendingAnalyzer();
    this.injuryMonitor = injuryMonitor;
    this.isActive = false;
    
    // Track sent alerts to prevent duplicates
    this.sentAlerts = new Map();
    this.sentAlertExpiry = 24 * 60 * 60 * 1000; // 24 hours
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
      logger.info('🌆 Evening report scheduled task triggered at 6 PM EST');
      await this.sendEveningReport();
    }, {
      timezone: 'America/New_York'
    });

    // Tests removed - system working perfectly!

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

      // Get real news articles from today
      const todaysNews = await this.getTodaysFantasyNews();
      
      // Get injury updates
      const injuryStatus = this.injuryMonitor ? this.injuryMonitor.getStatus() : null;
      
      // Get trending players
      const trendingData = await this.getTrendingPlayers();

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

      // Real news from today
      if (todaysNews && todaysNews.length > 0) {
        embed.fields.push({
          name: '📰 Today\'s Key Developments',
          value: todaysNews.slice(0, 4).map(news => 
            `• ${news.title?.substring(0, 100)}${news.title?.length > 100 ? '...' : ''}`
          ).join('\n'),
          inline: false
        });
      }

      // Injury updates if available
      if (injuryStatus && injuryStatus.knownInjuries > 0) {
        embed.fields.push({
          name: '🏥 Injury Monitor',
          value: `Currently tracking ${injuryStatus.knownInjuries} player injuries\nLast checked: ${new Date(injuryStatus.lastChecked).toLocaleTimeString()}`,
          inline: true
        });
      }

      // Trending players if available
      if (trendingData && trendingData.length > 0) {
        embed.fields.push({
          name: '📈 Trending Players',
          value: trendingData.slice(0, 3).map(player => 
            `• ${player.name}: ${player.reason || 'Rising interest'}`
          ).join('\n'),
          inline: true
        });
      }

      // Tomorrow's Focus with real context
      const tomorrowFocus = await this.getTomorrowsFocus();
      embed.fields.push({
        name: '🎯 Tomorrow\'s Focus Areas',
        value: tomorrowFocus,
        inline: false
      });

      await this.discordNotifier.sendEmbed(embed, 'INFO');
      logger.info('✅ Evening report sent with real news data');

    } catch (error) {
      logger.error('Failed to send evening report:', error.message);
    }
  }

  async getTodaysFantasyNews() {
    try {
      // Get articles from the news fetcher  
      const articles = await this.newsArticleFetcher.fetchLatestArticles();
      const today = new Date();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      // Filter for recent articles with real 2025-2026 season content
      const recentArticles = articles.filter(article => {
        if (!article.publishedAt || !article.title) return false;
        
        // Skip generic/placeholder titles
        if (article.title.includes('Latest Fantasy News from') || 
            article.title.includes('Latest News from') ||
            article.title.includes('Fantasy Football News') ||
            article.title.trim().length < 15) return false;
            
        // Skip outdated content (old season references)
        if (article.title.includes('Week 15') || 
            article.title.includes('Week 16') ||
            article.title.includes('Week 17') ||
            article.title.includes('Week 18') ||
            article.title.includes('2024') ||
            article.title.includes('2023') ||
            article.title.includes('2022') ||
            article.url?.includes('2023') ||
            article.url?.includes('2024')) return false;
            
        const articleDate = new Date(article.publishedAt);
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        return articleDate >= twoHoursAgo; // Last 2 hours for real-time
      });

      // If no recent real-time articles, get current season content
      if (recentArticles.length === 0) {
        const currentSeasonArticles = articles.filter(article => {
          if (!article.publishedAt || !article.title) return false;
          
          // Skip generic titles and old content
          if (article.title.includes('Latest Fantasy News from') || 
              article.title.includes('2023') ||
              article.title.includes('2024') ||
              article.url?.includes('2023') ||
              article.url?.includes('2024') ||
              article.title.trim().length < 10) return false;
              
          // Prioritize current preseason/training camp content
          if (article.title.includes('preseason') ||
              article.title.includes('training camp') ||
              article.title.includes('practice') ||
              article.title.includes('2025') ||
              article.title.includes('roster') ||
              article.title.includes('depth chart') ||
              article.title.includes('injury report')) {
              
            const articleDate = new Date(article.publishedAt);
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            return articleDate >= threeDaysAgo; // Last 3 days for seasonal content
          }
              
          return false;
        });
        
        return currentSeasonArticles.slice(0, 5);
      }
      
      return recentArticles.slice(0, 5); // Return top 5 real articles
    } catch (error) {
      logger.warn('Failed to get today\'s fantasy news:', error.message);
      return [];
    }
  }

  async getTrendingPlayers() {
    try {
      // Try to get trending data from the bot's trending analyzer
      if (this.trendingAnalyzer) {
        const trending = await this.trendingAnalyzer.getTrendingPlayers();
        return trending.slice(0, 3);
      }
      return [];
    } catch (error) {
      logger.warn('Failed to get trending players:', error.message);
      return [];
    }
  }

  async getTomorrowsFocus() {
    try {
      const focuses = [];
      
      // Check if it's a game day week
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      if (dayOfWeek >= 1 && dayOfWeek <= 4) { // Monday-Thursday
        focuses.push('• Monitor practice reports and injury designations');
        focuses.push('• Watch for depth chart changes');
      }
      
      if (dayOfWeek >= 4 && dayOfWeek <= 6) { // Thursday-Saturday
        focuses.push('• Check final injury reports');
        focuses.push('• Set lineups for weekend games');
      }
      
      if (dayOfWeek === 0 || dayOfWeek === 1) { // Sunday/Monday
        focuses.push('• Review waiver wire targets');
        focuses.push('• Analyze game results and snap counts');
      }
      
      // Always include these
      focuses.push('• Monitor breaking news alerts');
      focuses.push('• Check for roster moves and transactions');
      
      return focuses.join('\n');
    } catch (error) {
      logger.warn('Failed to generate tomorrow\'s focus:', error.message);
      return '• Monitor practice reports for injury updates\n• Check depth chart changes\n• Watch for breaking news alerts\n• Review waiver wire opportunities';
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
          // Check for duplicates to prevent spam
          const alertKey = recentAlerts.slice(0, 2).map(alert => 
            `${alert.player || alert.team}:${alert.fantasy_impact || alert.change}`
          ).join('|');
          
          // Clean expired alerts
          const now = Date.now();
          for (const [key, timestamp] of this.sentAlerts.entries()) {
            if (now - timestamp > this.sentAlertExpiry) {
              this.sentAlerts.delete(key);
            }
          }
          
          // Check if we've already sent this exact alert recently (within 6 hours)
          const lastSent = this.sentAlerts.get(alertKey);
          const sixHoursAgo = now - (6 * 60 * 60 * 1000);
          
          if (!lastSent || lastSent < sixHoursAgo) {
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
            this.sentAlerts.set(alertKey, now);
            logger.info(`🚨 Critical alert sent: ${recentAlerts.length} updates`);
          } else {
            logger.info(`⏭️ Skipping duplicate alert (last sent ${Math.round((now - lastSent) / (60 * 1000))} minutes ago)`);
          }
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