require('dotenv').config();

const config = {
  espn: {
    leagueId: process.env.ESPN_LEAGUE_ID,
    seasonId: process.env.ESPN_SEASON || 2025,
    s2Cookie: process.env.ESPN_S2_COOKIE,
    swidCookie: process.env.ESPN_SWID,
    baseURL: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons',
    endpoints: {
      draft: '?view=mDraftDetail',
      rosters: '?view=mRoster',
      matchups: '?view=mMatchup',
      players: '?view=kona_player_info',
      standings: '?view=mStandings',
      transactions: '?view=mTransactions2',
      settings: '?view=mSettings'
    }
  },

  ai: {
    claude: {
      apiKey: process.env.CLAUDE_API_KEY,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 2000,
      temperature: 0.7
    }
  },

  externalAPIs: {
    sportsData: {
      apiKey: process.env.SPORTSDATA_API_KEY,
      baseURL: 'https://api.sportsdata.io/v3/nfl',
      endpoints: {
        players: '/players',
        projections: '/playerprojections',
        injuries: '/injuries',
        depthCharts: '/depthcharts',
        stats: '/playerstats'
      }
    },
    fantasyPros: {
      apiKey: process.env.FANTASYPROS_API_KEY,
      baseURL: 'https://api.fantasypros.com/v2/nfl',
      endpoints: {
        rankings: '/rankings',
        projections: '/projections',
        adp: '/adp'
      }
    },
    weather: {
      apiKey: process.env.WEATHER_API_KEY,
      baseURL: 'https://api.weather.com/v1'
    },
    news: {
      apiKey: process.env.NEWS_API_KEY,
      baseURL: 'https://newsapi.org/v2'
    }
  },

  notifications: {
    discord: {
      webhookURL: process.env.DISCORD_WEBHOOK_URL,
      urgencyLevels: ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO'],
      colors: {
        CRITICAL: 0xFF0000,  // Red
        HIGH: 0xFF8C00,     // Orange
        MEDIUM: 0xFFFF00,   // Yellow
        INFO: 0x00FF00      // Green
      }
    },
    email: {
      service: 'gmail',
      user: process.env.EMAIL_SERVICE_USER,
      pass: process.env.EMAIL_SERVICE_PASS,
      urgencyFilter: ['CRITICAL', 'HIGH']
    }
  },

  database: {
    url: process.env.DATABASE_URL || 'sqlite:./database/fantasy.db',
    options: {
      logging: process.env.NODE_ENV === 'development'
    }
  },

  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.NODE_ENV === 'production' ? false : true
    }
  },

  draft: {
    monitorInterval: parseInt(process.env.DRAFT_MONITOR_INTERVAL) || 5000,
    aiRecommendationEnabled: process.env.AI_RECOMMENDATION_ENABLED === 'true',
    urgencyLevels: process.env.NOTIFICATION_URGENCY_LEVELS?.split(',') || ['CRITICAL', 'HIGH', 'MEDIUM', 'INFO']
  },

  league: {
    size: parseInt(process.env.LEAGUE_SIZE) || 12,
    type: process.env.LEAGUE_TYPE || 'PPR',
    rosterPositions: process.env.ROSTER_POSITIONS?.split(',') || ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DST'],
    benchSize: parseInt(process.env.BENCH_SIZE) || 6
  },

  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    file: process.env.NODE_ENV === 'production' ? './logs/app.log' : false
  }
};

module.exports = config;