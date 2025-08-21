/**
 * Enhanced Environment Configuration
 * Type-safe configuration with validation
 */
require('dotenv').config();
const { Validator } = require('../utils/validation');
const createLogger = require('../utils/logger');

const logger = createLogger();

class EnvironmentConfig {
  constructor() {
    this.validateAndLoad();
  }

  validateAndLoad() {
    try {
      // Logging configuration
      this.logging = {
        level: process.env.LOG_LEVEL || 'info',
        file: process.env.LOG_FILE || null
      };

      // Server configuration
      this.server = {
        port: Validator.validateNumber(process.env.PORT || 3000, 'PORT', { 
          min: 1, 
          max: 65535, 
          integer: true 
        }),
        host: process.env.HOST || 'localhost',
        cors: {
          origin: process.env.CORS_ORIGIN || true,
          credentials: true
        }
      };

      // ESPN configuration
      this.espn = {
        leagueId: Validator.validateEnvVar('ESPN_LEAGUE_ID', { required: false }),
        seasonId: Validator.validateNumber(
          process.env.ESPN_SEASON || new Date().getFullYear(), 
          'ESPN_SEASON',
          { min: 2020, max: 2030, integer: true }
        ),
        s2Cookie: process.env.ESPN_S2_COOKIE || null,
        swidCookie: process.env.ESPN_SWID_COOKIE || null,
        baseURL: 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons',
        endpoints: {
          settings: '',
          draft: '?view=mDraftDetail',
          rosters: '?view=mRoster',
          matchups: '?view=mMatchup',
          transactions: '?view=mTransactions2'
        }
      };

      // League configuration
      this.league = {
        size: Validator.validateNumber(process.env.LEAGUE_SIZE || 12, 'LEAGUE_SIZE', { 
          min: 4, 
          max: 20, 
          integer: true 
        })
      };

      // AI configuration
      this.ai = {
        claude: {
          apiKey: Validator.validateEnvVar('CLAUDE_API_KEY', { 
            required: true,
            validator: (value, name) => Validator.validateAPIKey(value, name)
          }),
          model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
          maxTokens: Validator.validateNumber(process.env.CLAUDE_MAX_TOKENS || 2048, 'CLAUDE_MAX_TOKENS', {
            min: 100,
            max: 8192,
            integer: true
          }),
          temperature: Validator.validateNumber(process.env.CLAUDE_TEMPERATURE || 0.3, 'CLAUDE_TEMPERATURE', {
            min: 0,
            max: 1
          })
        }
      };

      // Discord configuration
      this.discord = {
        botToken: Validator.validateEnvVar('DISCORD_BOT_TOKEN', { 
          required: true,
          validator: (value, name) => Validator.validateString(value, name, { required: true, minLength: 50 })
        }),
        webhookUrl: process.env.DISCORD_WEBHOOK_URL ? 
          Validator.validateDiscordWebhook(process.env.DISCORD_WEBHOOK_URL, 'DISCORD_WEBHOOK_URL') : null,
        practiceWebhookUrl: process.env.PRACTICE_WEBHOOK_URL ?
          Validator.validateDiscordWebhook(process.env.PRACTICE_WEBHOOK_URL, 'PRACTICE_WEBHOOK_URL') : null,
        liveWebhookUrl: process.env.LIVE_WEBHOOK_URL ?
          Validator.validateDiscordWebhook(process.env.LIVE_WEBHOOK_URL, 'LIVE_WEBHOOK_URL') : null
      };

      // External APIs configuration
      this.externalAPIs = {
        sportsData: {
          apiKey: process.env.SPORTS_DATA_API_KEY || null,
          enabled: Boolean(process.env.SPORTS_DATA_API_KEY)
        },
        fantasyPros: {
          enabled: process.env.FANTASY_PROS_ENABLED === 'true'
        },
        weather: {
          apiKey: process.env.OPENWEATHER_API_KEY || null,
          enabled: Boolean(process.env.OPENWEATHER_API_KEY)
        },
        news: {
          enabled: true
        }
      };

      // Notification configuration
      this.notifications = {
        discord: {
          colors: {
            CRITICAL: 0xFF0000,
            HIGH: 0xFF8800,
            MEDIUM: 0x0099FF,
            INFO: 0x00FF00
          },
          urgencyLevels: ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']
        }
      };

      // Draft configuration
      this.draft = {
        monitorInterval: Validator.validateNumber(
          process.env.DRAFT_MONITOR_INTERVAL || 5000, 
          'DRAFT_MONITOR_INTERVAL',
          { min: 1000, max: 60000, integer: true }
        ),
        aiRecommendationEnabled: process.env.AI_RECOMMENDATION_ENABLED === 'true'
      };

      // Rate limiting configuration
      this.rateLimiting = {
        api: {
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 100 // limit each IP to 100 requests per windowMs
        },
        claude: {
          requests: 50,
          period: 60000 // 1 minute
        },
        espn: {
          requests: 30,
          period: 60000 // 1 minute
        }
      };

      logger.info('✅ Environment configuration loaded and validated successfully');
      
    } catch (error) {
      logger.error('❌ Environment configuration validation failed:', error.message);
      throw new Error(`Configuration error: ${error.message}`);
    }
  }

  /**
   * Get configuration for a specific service
   */
  getServiceConfig(serviceName) {
    if (!this[serviceName]) {
      throw new Error(`Unknown service configuration: ${serviceName}`);
    }
    return this[serviceName];
  }

  /**
   * Check if all required configurations are present
   */
  validateRequired() {
    const required = [
      { key: 'ai.claude.apiKey', name: 'Claude API Key' },
      { key: 'discord.botToken', name: 'Discord Bot Token' }
    ];

    const missing = [];
    
    for (const req of required) {
      const value = this.getNestedValue(req.key);
      if (!value) {
        missing.push(req.name);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Get nested configuration value
   */
  getNestedValue(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], this);
  }

  /**
   * Get all webhook URLs that are configured
   */
  getConfiguredWebhooks() {
    const webhooks = {};
    
    if (this.discord.webhookUrl) webhooks.main = this.discord.webhookUrl;
    if (this.discord.practiceWebhookUrl) webhooks.practice = this.discord.practiceWebhookUrl;
    if (this.discord.liveWebhookUrl) webhooks.live = this.discord.liveWebhookUrl;
    
    return webhooks;
  }
}

// Create singleton instance
const config = new EnvironmentConfig();

// Validate on startup
config.validateRequired();

module.exports = config;