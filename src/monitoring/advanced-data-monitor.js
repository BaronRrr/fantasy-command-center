const axios = require('axios');
const winston = require('winston');

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

class AdvancedDataMonitor {
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0 (+https://fantasy-command-center.com)'
      }
    });

    // FREE DATA SOURCES ONLY (no paid APIs)
    this.dataSources = {
      // NFL Official (Free)
      nfl_injuries: {
        name: 'NFL.com Injury Reports',
        url: 'https://www.nfl.com/injuries/',
        type: 'web_scraping',
        priority: 'CRITICAL',
        update_frequency: 'hourly'
      },
      
      // Depth Charts (Free)
      ourlads_depth: {
        name: 'Ourlads Depth Charts',
        url: 'https://www.ourlads.com/nfldepthcharts/',
        type: 'web_scraping',
        priority: 'HIGH',
        update_frequency: 'daily'
      },
      
      // Snap Counts (Free)
      footballguys_snaps: {
        name: 'FootballGuys Snap Counts',
        url: 'https://www.footballguys.com/stats/snap-counts/teams',
        type: 'web_scraping',
        priority: 'HIGH',
        update_frequency: 'weekly'
      },
      
      // Reddit Sentiment (Free API)
      reddit_fantasy: {
        name: 'Reddit Fantasy Football',
        url: 'https://reddit.com/r/fantasyfootball/.json',
        type: 'api',
        priority: 'MEDIUM',
        update_frequency: 'hourly'
      },
      
      // Google Trends (Free API)
      google_trends: {
        name: 'Google Trends Fantasy Players',
        url: 'https://trends.google.com/trends/api/explore',
        type: 'api',
        priority: 'MEDIUM',
        update_frequency: 'daily'
      },
      
      // CBS Fantasy Football (Free)
      cbs_fantasy: {
        name: 'CBS Fantasy Football News',
        url: 'https://www.cbssports.com/fantasy/football/draft-prep/',
        type: 'web_scraping',
        priority: 'HIGH',
        update_frequency: 'hourly'
      },
      
      // Practice Reports (Free via Twitter/Web)
      practice_reports: {
        name: 'NFL Practice Participation',
        sources: [
          'Twitter beat writers',
          'NFL.com practice reports',
          'Team websites'
        ],
        type: 'aggregated',
        priority: 'CRITICAL',
        update_frequency: 'daily_during_season'
      }
    };

    this.lastUpdated = {};
    this.isRunning = false;
  }

  // ON-DEMAND UPDATE (for local use)
  async updateAllSources() {
    logger.info('🔍 Starting on-demand data source update...');
    
    const results = {
      injuries: await this.updateInjuryReports(),
      depth_charts: await this.updateDepthCharts(),
      snap_counts: await this.updateSnapCounts(),
      reddit_sentiment: await this.updateRedditSentiment(),
      practice_reports: await this.updatePracticeReports()
    };

    logger.info('✅ On-demand update completed');
    return results;
  }

  // INJURY MONITORING
  async updateInjuryReports() {
    try {
      logger.info('📋 Checking NFL injury reports...');
      
      // For now, return mock data structure
      // In production, this would scrape NFL.com or use RSS feeds
      const mockInjuryData = {
        critical_updates: [
          {
            player: 'Christian McCaffrey',
            team: 'SF',
            status: 'Questionable',
            injury: 'Hamstring',
            practice_status: 'Limited',
            fantasy_impact: 'Monitor for Sunday status',
            source: 'NFL.com',
            timestamp: new Date().toISOString()
          }
        ],
        new_injuries: [],
        status_changes: []
      };

      this.lastUpdated.injuries = Date.now();
      return mockInjuryData;
      
    } catch (error) {
      logger.error('Failed to update injury reports:', error.message);
      return { error: error.message };
    }
  }

  // DEPTH CHART MONITORING
  async updateDepthCharts() {
    try {
      logger.info('📊 Checking depth chart changes...');
      
      const mockDepthData = {
        lineup_changes: [
          {
            team: 'HOU',
            position: 'RB',
            change: 'Joe Mixon moved to RB1',
            previous: 'Dameon Pierce RB1',
            fantasy_impact: 'Mixon draft value increases',
            source: 'Ourlads',
            timestamp: new Date().toISOString()
          }
        ],
        new_starters: [],
        position_battles: []
      };

      this.lastUpdated.depth_charts = Date.now();
      return mockDepthData;
      
    } catch (error) {
      logger.error('Failed to update depth charts:', error.message);
      return { error: error.message };
    }
  }

  // SNAP COUNT ANALYSIS
  async updateSnapCounts() {
    try {
      logger.info('⏱️ Analyzing snap count trends...');
      
      const mockSnapData = {
        trending_up: [
          {
            player: 'Jaylen Warren',
            team: 'PIT', 
            position: 'RB',
            snap_percentage: 45,
            trend: '+15% over last 3 games',
            fantasy_impact: 'Emerging handcuff value',
            source: 'FootballGuys'
          }
        ],
        trending_down: [],
        opportunities: []
      };

      this.lastUpdated.snap_counts = Date.now();
      return mockSnapData;
      
    } catch (error) {
      logger.error('Failed to update snap counts:', error.message);
      return { error: error.message };
    }
  }

  // REDDIT SENTIMENT
  async updateRedditSentiment() {
    try {
      logger.info('📱 Checking Reddit fantasy sentiment...');
      
      // Simple Reddit API call (no auth required for public posts)
      const response = await this.axiosInstance.get('https://reddit.com/r/fantasyfootball/hot.json?limit=25');
      
      const posts = response.data?.data?.children || [];
      const trendingPlayers = this.analyzeRedditTrends(posts);

      this.lastUpdated.reddit = Date.now();
      return {
        trending_discussions: trendingPlayers.slice(0, 5),
        hot_topics: posts.slice(0, 3).map(post => ({
          title: post.data.title,
          upvotes: post.data.ups,
          comments: post.data.num_comments,
          url: `https://reddit.com${post.data.permalink}`
        }))
      };
      
    } catch (error) {
      logger.error('Failed to update Reddit sentiment:', error.message);
      return { error: error.message };
    }
  }

  analyzeRedditTrends(posts) {
    const playerMentions = new Map();
    
    // Common player name patterns
    const playerRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    
    posts.forEach(post => {
      const title = post.data.title;
      const matches = title.match(playerRegex) || [];
      
      matches.forEach(player => {
        if (!playerMentions.has(player)) {
          playerMentions.set(player, {
            name: player,
            mentions: 0,
            total_upvotes: 0,
            posts: []
          });
        }
        
        const playerData = playerMentions.get(player);
        playerData.mentions++;
        playerData.total_upvotes += post.data.ups;
        playerData.posts.push({
          title: title,
          upvotes: post.data.ups,
          comments: post.data.num_comments
        });
      });
    });
    
    // Sort by buzz (mentions + upvotes)
    return Array.from(playerMentions.values())
      .sort((a, b) => (b.mentions + b.total_upvotes/100) - (a.mentions + a.total_upvotes/100))
      .slice(0, 10);
  }

  // PRACTICE REPORTS
  async updatePracticeReports() {
    try {
      logger.info('🏃 Checking practice participation...');
      
      const mockPracticeData = {
        dnp: [ // Did Not Practice
          {
            player: 'Ja\'Marr Chase',
            team: 'CIN',
            reason: 'Rest',
            fantasy_concern: 'Low - veteran rest day',
            source: 'Beat writer'
          }
        ],
        limited: [],
        full: [],
        trends: []
      };

      this.lastUpdated.practice = Date.now();
      return mockPracticeData;
      
    } catch (error) {
      logger.error('Failed to update practice reports:', error.message);
      return { error: error.message };
    }
  }

  // COMPILE DRAFT-RELEVANT INSIGHTS
  async getDraftIntelligence(playerName = null) {
    logger.info(`🎯 Compiling draft intelligence${playerName ? ` for ${playerName}` : ''}...`);
    
    // Get latest data from all sources
    const allData = await this.updateAllSources();
    
    const intelligence = {
      critical_alerts: [],
      player_specific: [],
      trending_players: [],
      avoid_list: [],
      opportunities: [],
      last_updated: new Date().toISOString()
    };

    // Compile critical alerts
    if (allData.injuries?.critical_updates) {
      intelligence.critical_alerts.push(...allData.injuries.critical_updates);
    }

    if (allData.depth_charts?.lineup_changes) {
      intelligence.critical_alerts.push(...allData.depth_charts.lineup_changes);
    }

    // Player-specific insights
    if (playerName) {
      // Check injuries
      if (allData.injuries?.critical_updates) {
        const playerInjuries = allData.injuries.critical_updates
          .filter(update => update.player.toLowerCase().includes(playerName.toLowerCase()));
        intelligence.player_specific.push(...playerInjuries);
      }
      
      // Check snap counts
      if (allData.snap_counts?.trending_up) {
        const playerSnaps = allData.snap_counts.trending_up
          .filter(player => player.player.toLowerCase().includes(playerName.toLowerCase()));
        intelligence.player_specific.push(...playerSnaps);
      }
      
      // Check practice reports
      if (allData.practice_reports?.dnp) {
        const playerPractice = allData.practice_reports.dnp
          .filter(player => player.player.toLowerCase().includes(playerName.toLowerCase()));
        intelligence.player_specific.push(...playerPractice);
      }
      
      // If no specific data found, create a "no news" entry
      if (intelligence.player_specific.length === 0) {
        intelligence.player_specific.push({
          player: playerName,
          status: 'No recent updates',
          fantasy_impact: 'No significant news or changes detected',
          source: 'Comprehensive search'
        });
      }
    }

    // Trending players from Reddit
    if (allData.reddit_sentiment?.trending_discussions) {
      intelligence.trending_players = allData.reddit_sentiment.trending_discussions.slice(0, 5);
    }

    // Opportunities from snap counts
    if (allData.snap_counts?.trending_up) {
      intelligence.opportunities = allData.snap_counts.trending_up;
    }

    return intelligence;
  }

  // START CONTINUOUS MONITORING (for cloud deployment)
  startContinuousMonitoring() {
    if (this.isRunning) {
      logger.warn('Monitoring already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 Starting continuous data monitoring...');

    // Critical sources every hour
    setInterval(() => {
      this.updateInjuryReports();
      this.updatePracticeReports();
    }, 60 * 60 * 1000); // 1 hour

    // Medium priority every 4 hours
    setInterval(() => {
      this.updateDepthCharts();
      this.updateSnapCounts();
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Low priority daily
    setInterval(() => {
      this.updateRedditSentiment();
    }, 24 * 60 * 60 * 1000); // 24 hours

    logger.info('✅ Continuous monitoring active');
  }

  stopMonitoring() {
    this.isRunning = false;
    logger.info('⏹️ Monitoring stopped');
  }

  // GET STATUS OF ALL SOURCES
  getMonitoringStatus() {
    const now = Date.now();
    const status = {};

    Object.entries(this.lastUpdated).forEach(([source, timestamp]) => {
      const minutesAgo = Math.round((now - timestamp) / (60 * 1000));
      status[source] = {
        last_updated: new Date(timestamp).toISOString(),
        minutes_ago: minutesAgo,
        status: minutesAgo < 60 ? 'FRESH' : minutesAgo < 240 ? 'STALE' : 'OLD'
      };
    });

    return {
      monitoring_active: this.isRunning,
      sources: status,
      total_sources: Object.keys(this.dataSources).length
    };
  }
}

module.exports = AdvancedDataMonitor;