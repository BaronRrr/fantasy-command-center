require('dotenv').config();

module.exports = {
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost'
  },
  espn: {
    leagueId: process.env.ESPN_LEAGUE_ID,
    seasonId: process.env.ESPN_SEASON || new Date().getFullYear(),
    s2Cookie: process.env.ESPN_S2_COOKIE,
    swidCookie: process.env.ESPN_SWID_COOKIE,
    baseURL: 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons',
    endpoints: {
      settings: '',
      draft: '?view=mDraftDetail',
      rosters: '?view=mRoster',
      matchups: '?view=mMatchup',
      transactions: '?view=mTransactions2'
    }
  },
  league: {
    size: parseInt(process.env.LEAGUE_SIZE) || 8
  },
  ai: {
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 2048,
      temperature: 0.3
    }
  },
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL,
    botToken: process.env.DISCORD_BOT_TOKEN
  },
  externalAPIs: {
    sportsData: {
      apiKey: process.env.SPORTS_DATA_API_KEY || null,
      enabled: false
    },
    fantasyPros: {
      enabled: false
    },
    weather: {
      apiKey: process.env.OPENWEATHER_API_KEY,
      enabled: true
    },
    news: {
      enabled: true
    }
  },
  notifications: {
    discord: {
      webhookURL: process.env.DISCORD_WEBHOOK_URL,
      colors: {
        CRITICAL: 0xFF0000,
        HIGH: 0xFF8800,
        MEDIUM: 0x0099FF,
        INFO: 0x00FF00
      },
      urgencyLevels: ["CRITICAL", "HIGH", "MEDIUM", "INFO"]
    }
  },
  draft: {
    monitorInterval: parseInt(process.env.DRAFT_MONITOR_INTERVAL) || 5000,
    aiRecommendationEnabled: process.env.AI_RECOMMENDATION_ENABLED === 'true'
  }
};