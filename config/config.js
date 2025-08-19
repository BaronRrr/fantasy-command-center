const dotenv = require('dotenv');
dotenv.config();

// Required environment variables
const required = [
  'CLAUDE_API_KEY',
  'DISCORD_BOT_TOKEN',
  'DISCORD_WEBHOOK_URL'
];

// Optional but recommended environment variables
const optional = [
  'ESPN_LEAGUE_ID',
  'ESPN_S2_COOKIE', 
  'ESPN_SWID_COOKIE',
  'DISCORD_NEWS_WEBHOOK'
];

// Validate required environment variables
function validateEnvironment() {
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`❌ STARTUP FAILED: Missing required environment variables:`);
    missing.forEach(key => console.error(`   - ${key}`));
    console.error(`\n💡 Please check your .env file or Railway environment variables.`);
    console.error(`📖 See .env.example for reference.`);
    process.exit(1);
  }

  // Warn about missing optional variables
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(`⚠️  Missing optional environment variables (some features may be limited):`);
    missingOptional.forEach(key => console.warn(`   - ${key}`));
  }

  console.log(`✅ Environment validation passed`);
}

// Centralized configuration object
const config = {
  // Core API Configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 1000,
    timeout: 15000
  },

  // Discord Configuration
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    newsWebhookUrl: process.env.DISCORD_NEWS_WEBHOOK,
    commandPrefix: '!coach',
    allowedChannels: ['draft-central', 'ai-analysis', 'newsarticles'],
    colors: {
      INFO: 0x4A90E2,
      SUCCESS: 0x00FF00,
      WARNING: 0xFF8800,
      ERROR: 0xFF0000,
      DRAFT: 0xFF6B35
    }
  },

  // ESPN Configuration (optional)
  espn: {
    leagueId: process.env.ESPN_LEAGUE_ID,
    s2Cookie: process.env.ESPN_S2_COOKIE,
    swidCookie: process.env.ESPN_SWID_COOKIE,
    timeout: 10000,
    retryAttempts: 3
  },

  // Application Configuration
  app: {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // News and Monitoring Configuration
  monitoring: {
    newsUpdateInterval: 30 * 60 * 1000, // 30 minutes
    healthCheckInterval: 5 * 60 * 1000,  // 5 minutes
    maxArticles: 8,
    maxRetries: 3
  },

  // Notifications Configuration
  notifications: {
    discord: {
      webhookURL: process.env.DISCORD_WEBHOOK_URL,
      newsWebhookURL: process.env.DISCORD_NEWS_WEBHOOK,
      colors: {
        INFO: 0x4A90E2,
        SUCCESS: 0x00FF00,
        WARNING: 0xFF8800,
        ERROR: 0xFF0000,
        DRAFT: 0xFF6B35
      }
    }
  }
};

// Export validation function and config
module.exports = {
  validateEnvironment,
  config
};