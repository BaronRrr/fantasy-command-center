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

class TrendingAnalyzer {
  constructor(playerDatabase = null) {
    this.playerDB = playerDatabase;
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes cache to reduce API calls
    
    // Cost-effective update frequencies
    this.updateIntervals = {
      reddit: 2 * 60 * 60 * 1000,    // Every 2 hours (12 calls/day)
      rss: 4 * 60 * 60 * 1000,       // Every 4 hours (6 calls/day)
      database: 60 * 60 * 1000       // Every hour (24 calls/day)
    };

    this.lastUpdated = {
      reddit: 0,
      rss: 0,
      database: 0
    };

    // Known player names for better extraction
    this.playerNames = this.loadPlayerNames();
  }

  loadPlayerNames() {
    try {
      // Load from comprehensive NFL player database
      const fs = require('fs');
      const path = require('path');
      
      const databasePath = path.join(__dirname, '../../data/nfl-players-complete.json');
      const playersData = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
      
      // Extract player names from the comprehensive database
      const playerNames = [];
      
      if (Array.isArray(playersData)) {
        // If it's an array of player objects
        for (const player of playersData) {
          if (player.name) {
            playerNames.push(player.name);
          } else if (player.full_name) {
            playerNames.push(player.full_name);
          } else if (player.firstName && player.lastName) {
            playerNames.push(`${player.firstName} ${player.lastName}`);
          }
        }
      } else if (typeof playersData === 'object') {
        // If it's an object with player data
        for (const key in playersData) {
          const player = playersData[key];
          if (typeof player === 'object' && (player.name || player.full_name)) {
            playerNames.push(player.name || player.full_name);
          }
        }
      }
      
      logger.info(`📊 Loaded ${playerNames.length} player names from comprehensive database`);
      
      // Store full player data for later reference
      this.playerData = playersData;
      
      return playerNames.filter(name => name && name.length > 2); // Filter out empty/short names
      
    } catch (error) {
      logger.warn('Failed to load comprehensive player database, using fallback list:', error.message);
      
      // Fallback to a smaller but reliable list
      return [
        'Josh Allen', 'Lamar Jackson', 'Patrick Mahomes', 'Justin Herbert', 'Joe Burrow',
        'Christian McCaffrey', 'Austin Ekeler', 'Derrick Henry', 'Nick Chubb',
        'Cooper Kupp', 'Davante Adams', 'Tyreek Hill', 'Stefon Diggs',
        'Travis Kelce', 'Mark Andrews', 'George Kittle', 'T.J. Hockenson',
        'Justin Jefferson', 'Ja\'Marr Chase', 'A.J. Brown', 'CeeDee Lamb',
        'Saquon Barkley', 'Jonathan Taylor', 'Tony Pollard', 'Kenneth Walker III',
        'Brian Robinson Jr.', 'Jaylen Warren', 'Joe Mixon', 'Alvin Kamara'
      ];
    }
  }

  async generateTrendingAnalysis() {
    try {
      logger.info('🔍 Generating cost-effective trending analysis...');
      
      // Check cache first
      const cached = this.getCachedAnalysis();
      if (cached) {
        logger.info('📊 Using cached trending analysis');
        return cached;
      }

      // Gather data from multiple sources with rate limiting
      const trendingData = await this.gatherTrendingData();
      
      if (!trendingData || trendingData.length === 0) {
        logger.info('No trending data available, using manual analysis');
        return this.getManualTrendingAnalysis();
      }

      const analysis = this.processTrendingData(trendingData);
      
      // Cache the result
      this.cacheAnalysis(analysis);
      
      return analysis;

    } catch (error) {
      logger.error('Failed to generate trending analysis:', error.message);
      return this.getManualTrendingAnalysis();
    }
  }

  getCachedAnalysis() {
    const cached = this.cache.get('trending_analysis');
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  cacheAnalysis(analysis) {
    this.cache.set('trending_analysis', {
      data: analysis,
      timestamp: Date.now()
    });
  }

  async gatherTrendingData() {
    const dataSources = [];
    const now = Date.now();

    // Reddit trending (every 2 hours)
    if ((now - this.lastUpdated.reddit) > this.updateIntervals.reddit) {
      try {
        logger.info('📱 Fetching Reddit trending data...');
        const redditData = await this.getRedditTrending();
        if (redditData && redditData.length > 0) {
          dataSources.push(...redditData);
          this.lastUpdated.reddit = now;
          logger.info(`✅ Found ${redditData.length} Reddit trends`);
        }
      } catch (error) {
        logger.warn('Reddit trending failed:', error.message);
      }
    }

    // RSS feed analysis (every 4 hours)
    if ((now - this.lastUpdated.rss) > this.updateIntervals.rss) {
      try {
        logger.info('📰 Analyzing RSS feeds for trends...');
        const rssData = await this.getRSSTrending();
        if (rssData && rssData.length > 0) {
          dataSources.push(...rssData);
          this.lastUpdated.rss = now;
          logger.info(`✅ Found ${rssData.length} RSS trends`);
        }
      } catch (error) {
        logger.warn('RSS trending failed:', error.message);
      }
    }

    // Database analysis (every hour)
    if ((now - this.lastUpdated.database) > this.updateIntervals.database) {
      try {
        logger.info('🗄️ Analyzing database for trends...');
        const dbData = await this.getDatabaseTrending();
        if (dbData && dbData.length > 0) {
          dataSources.push(...dbData);
          this.lastUpdated.database = now;
          logger.info(`✅ Found ${dbData.length} database trends`);
        }
      } catch (error) {
        logger.warn('Database trending failed:', error.message);
      }
    }

    return dataSources;
  }

  async getRedditTrending() {
    try {
      // No API key needed for Reddit JSON - completely free
      const url = 'https://www.reddit.com/r/fantasyfootball/hot.json?limit=25';
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'FantasyCommandCenter/1.0.0'
        },
        timeout: 15000
      });

      return this.parseRedditData(response.data);

    } catch (error) {
      throw new Error(`Reddit API error: ${error.message}`);
    }
  }

  parseRedditData(redditResponse) {
    const trending = [];
    
    try {
      const posts = redditResponse.data.children;
      
      for (const post of posts) {
        const title = post.data.title;
        const score = post.data.score;
        const comments = post.data.num_comments;
        const created = post.data.created_utc;
        
        // Only consider recent posts (last 24 hours) with decent engagement
        const hoursOld = (Date.now() / 1000 - created) / 3600;
        if (hoursOld > 24 || score < 10) continue;
        
        // Extract player names from titles
        const players = this.extractPlayerNames(title);
        
        for (const player of players) {
          trending.push({
            player: player,
            source: 'reddit',
            score: score,
            comments: comments,
            title: title,
            trend_type: this.categorizeTrend(title.toLowerCase()),
            hours_old: hoursOld,
            engagement: score + (comments * 2) // Weight comments higher
          });
        }
      }
      
      return trending;
    } catch (error) {
      logger.error('Error parsing Reddit data:', error.message);
      return [];
    }
  }

  async getRSSTrending() {
    // Use existing RSS feeds - no additional cost
    const trending = [];
    
    try {
      // This would integrate with your existing RSS system
      // For now, return placeholder that mimics the structure
      const mockRSSData = [
        {
          player: 'Travis Kelce',
          source: 'rss',
          trend_type: 'opportunity',
          title: 'Kelce targets trending up in practice reports',
          engagement: 15
        },
        {
          player: 'Ja\'Maar Chase',
          source: 'rss', 
          trend_type: 'breakout',
          title: 'Chase showing elite route running in camp',
          engagement: 12
        }
      ];
      
      return mockRSSData;
    } catch (error) {
      logger.warn('RSS trending failed:', error.message);
      return [];
    }
  }

  async getDatabaseTrending() {
    try {
      // Analyze your existing player database for trends
      // This is free since it uses your existing data
      
      const trending = [];
      
      // Mock database trending - replace with actual database analysis
      const recentActivity = [
        {
          player: 'Brock Purdy',
          source: 'database',
          trend_type: 'rising_adp',
          title: 'ADP rising in recent drafts',
          engagement: 8
        },
        {
          player: 'Kenneth Walker',
          source: 'database',
          trend_type: 'opportunity',
          title: 'Increased target share in depth chart',
          engagement: 10
        }
      ];

      return recentActivity;
    } catch (error) {
      logger.warn('Database trending failed:', error.message);
      return [];
    }
  }

  extractPlayerNames(text) {
    const players = [];
    const lowerText = text.toLowerCase();
    
    // Filter out common words that might accidentally match
    const excludeWords = ['will', 'not', 'play', 'tonight', 'amidst', 'uncertain', 'future', 'with', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'as', 'by', 'jones', 'smith', 'brown', 'johnson', 'williams', 'davis', 'miller'];
    
    for (const playerName of this.playerNames) {
      const lowerPlayer = playerName.toLowerCase();
      
      // Skip if player name is just a common word or very common surname
      if (excludeWords.includes(lowerPlayer)) {
        continue;
      }
      
      // Check for full name match with word boundaries (most accurate)
      const fullNameRegex = new RegExp(`\\b${lowerPlayer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (fullNameRegex.test(text)) {
        players.push(playerName);
        continue;
      }
      
      // Only match last names for fantasy-relevant players (not practice squad)
      const nameParts = playerName.split(' ');
      if (nameParts.length > 1) {
        const lastName = nameParts[nameParts.length - 1];
        
        // Only match distinctive last names that aren't super common
        if (lastName.length >= 5 && !excludeWords.includes(lastName.toLowerCase())) {
          // Additional check: only if it's likely a starter/relevant player
          const playerInfo = this.getPlayerInfo(playerName);
          if (playerInfo && this.isFantasyRelevant(playerInfo)) {
            const lastNameRegex = new RegExp(`\\b${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (lastNameRegex.test(text)) {
              players.push(playerName);
            }
          }
        }
      }
    }

    return [...new Set(players)]; // Remove duplicates
  }

  getPlayerInfo(playerName) {
    if (!this.playerData) return null;
    
    if (Array.isArray(this.playerData)) {
      return this.playerData.find(p => 
        p.name === playerName || 
        p.full_name === playerName ||
        `${p.firstName} ${p.lastName}` === playerName
      );
    } else if (typeof this.playerData === 'object') {
      for (const key in this.playerData) {
        const player = this.playerData[key];
        if ((player.name || player.full_name) === playerName) {
          return player;
        }
      }
    }
    return null;
  }

  isFantasyRelevant(player) {
    // Check if player is likely fantasy relevant
    if (!player) return false;
    
    // Check position - prioritize skill positions
    const position = player.position || player.pos || '';
    const relevantPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    if (!relevantPositions.includes(position)) return false;
    
    // Check if they're on an active roster (not practice squad)
    const status = player.status || player.roster_status || '';
    if (status.includes('Practice Squad') || status.includes('PS')) return false;
    
    // If we have depth chart info, prioritize starters
    const depth = player.depth_chart_order || player.depth || 0;
    if (depth > 3) return false; // Only top 3 on depth chart
    
    return true;
  }

  createPlayerSummary(playerName, rawText, trendTypes) {
    // Clean up the raw text and create a meaningful summary
    let text = rawText.trim();
    
    // Remove common truncation indicators
    text = text.replace(/\.\.\.$/, '');
    
    // Fix common parsing issues
    text = text.replace(/([a-z])([A-Z])/g, '$1 $2'); // Add spaces between words
    text = text.replace(/\s+/g, ' '); // Normalize spaces
    
    // If it's a mangled sentence, try to create a better summary
    if (text.includes('Will Not Play Tonight') || text.includes('Amidst Uncertain')) {
      // This looks like a title/headline that got parsed poorly
      if (trendTypes.includes('injury')) {
        return `${playerName} has injury concerns affecting his availability`;
      } else if (trendTypes.includes('opportunity')) {
        return `${playerName} seeing increased opportunity or role change`;
      } else {
        return `${playerName} generating discussion in fantasy community`;
      }
    }
    
    // For injury-related trends
    if (text.toLowerCase().includes('placed on ir') || text.toLowerCase().includes('injured reserve')) {
      return `${playerName} placed on injured reserve, impacting fantasy value`;
    }
    
    if (text.toLowerCase().includes('questionable') || text.toLowerCase().includes('doubtful')) {
      return `${playerName} has uncertain game status due to injury`;
    }
    
    // For general news, try to extract key info
    if (text.length > 100) {
      // Try to get the first complete sentence
      const sentences = text.split(/[.!?]+/);
      if (sentences.length > 0 && sentences[0].length > 20) {
        return sentences[0].trim() + (sentences[0].endsWith('.') ? '' : '.');
      }
    }
    
    // If all else fails, truncate cleanly
    if (text.length > 80) {
      const truncated = text.substring(0, 77);
      const lastSpace = truncated.lastIndexOf(' ');
      return lastSpace > 40 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
    }
    
    return text;
  }

  categorizeTrend(text) {
    const categories = {
      'breakout': ['breakout', 'emerging', 'rising', 'sleeper', 'diamond', 'target', 'opportunity'],
      'injury': ['injury', 'hurt', 'out', 'ir', 'questionable', 'doubtful', 'injured'],
      'opportunity': ['starter', 'promoted', 'depth chart', 'backup', 'role', 'touches'],
      'trade': ['trade', 'traded', 'rumors', 'speculation', 'move', 'signing'],
      'waiver': ['waiver', 'pickup', 'add', 'claim', 'available'],
      'rising_adp': ['adp', 'draft', 'round', 'value', 'climbing']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  processTrendingData(rawData) {
    // Aggregate and rank trending players
    const playerCounts = new Map();

    for (const item of rawData) {
      const player = item.player;
      
      if (!playerCounts.has(player)) {
        playerCounts.set(player, {
          name: player,
          mentions: 0,
          totalScore: 0,
          sources: new Set(),
          trendTypes: new Set(),
          reasons: [],
          latestActivity: 0
        });
      }

      const playerData = playerCounts.get(player);
      playerData.mentions += 1;
      playerData.totalScore += (item.engagement || item.score || 1);
      playerData.sources.add(item.source);
      playerData.trendTypes.add(item.trend_type);
      playerData.latestActivity = Math.max(playerData.latestActivity, Date.now());
      
      if (item.title) {
        playerData.reasons.push(item.title.substring(0, 80) + '...');
      }
    }

    // Convert to sorted array with fantasy impact scoring
    const trending = Array.from(playerCounts.values())
      .map(player => ({
        ...player,
        fantasyImpact: this.calculateFantasyImpact(player),
        recommendation: this.getRecommendation(player)
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 8); // Top 8 to keep it focused

    return {
      trending: trending,
      categories: this.createTrendingCategories(trending),
      generated: new Date().toISOString(),
      source: 'multi-source-analysis',
      nextUpdate: this.getNextUpdateTime()
    };
  }

  calculateFantasyImpact(player) {
    let impact = 5; // Base score
    
    // Boost for multiple sources
    impact += player.sources.size * 1.5;
    
    // Boost for certain trend types
    if (player.trendTypes.has('breakout')) impact += 2;
    if (player.trendTypes.has('opportunity')) impact += 1.5;
    if (player.trendTypes.has('injury')) impact += 1;
    
    // Boost for engagement
    impact += Math.min(player.totalScore / 20, 3);
    
    return Math.min(Math.round(impact), 10);
  }

  getRecommendation(player) {
    if (player.trendTypes.has('injury')) return 'MONITOR';
    if (player.trendTypes.has('breakout')) return 'BUY';
    if (player.trendTypes.has('opportunity')) return 'ADD';
    if (player.trendTypes.has('waiver')) return 'CLAIM';
    if (player.trendTypes.has('trade')) return 'HOLD';
    return 'WATCH';
  }

  createTrendingCategories(trendingPlayers) {
    const categories = {
      breakout: trendingPlayers.filter(p => p.trendTypes.has('breakout')),
      injury: trendingPlayers.filter(p => p.trendTypes.has('injury')),
      opportunity: trendingPlayers.filter(p => p.trendTypes.has('opportunity')),
      waiver: trendingPlayers.filter(p => p.trendTypes.has('waiver'))
    };

    return {
      'Breakout Watch': categories.breakout.map(p => p.name).slice(0, 3).join(', ') || 'Monitor emerging players',
      'Injury Updates': categories.injury.map(p => p.name).slice(0, 3).join(', ') || 'Track player health status',
      'Opportunity Risers': categories.opportunity.map(p => p.name).slice(0, 3).join(', ') || 'Watch depth chart changes',
      'Waiver Targets': categories.waiver.map(p => p.name).slice(0, 3).join(', ') || 'Check available players'
    };
  }

  getNextUpdateTime() {
    const nextUpdates = [];
    const now = Date.now();
    
    if (this.lastUpdated.reddit > 0) {
      nextUpdates.push(this.lastUpdated.reddit + this.updateIntervals.reddit);
    }
    if (this.lastUpdated.rss > 0) {
      nextUpdates.push(this.lastUpdated.rss + this.updateIntervals.rss);
    }
    if (this.lastUpdated.database > 0) {
      nextUpdates.push(this.lastUpdated.database + this.updateIntervals.database);
    }
    
    const nextUpdate = Math.min(...nextUpdates);
    const minutesUntil = Math.round((nextUpdate - now) / (1000 * 60));
    
    return `Next update in ${minutesUntil} minutes`;
  }

  getManualTrendingAnalysis() {
    return {
      trending: [],
      categories: {
        'Breakout Watch': 'Monitor emerging players with increased usage',
        'Injury Updates': 'Track player health status and recovery timelines',
        'Opportunity Risers': 'Watch for depth chart changes and new roles',
        'Waiver Targets': 'Check high-upside players on waiver wire'
      },
      tip: 'Monitor Reddit r/fantasyfootball and waiver wire for trends!',
      source: 'manual-categories',
      generated: new Date().toISOString(),
      nextUpdate: 'Real-time updates when data sources are available'
    };
  }

  // Format for Discord display
  formatForDiscord(analysis) {
    let response = `**Trending Players Analysis**\n\n`;
    
    if (analysis.trending && analysis.trending.length > 0) {
      response += `**Top Trending Players:**\n`;
      analysis.trending.slice(0, 5).forEach((player, index) => {
        // Get player info for context
        const playerInfo = this.getPlayerInfo ? this.getPlayerInfo(player.name) : null;
        const position = playerInfo?.position || playerInfo?.pos || '';
        const team = playerInfo?.team || playerInfo?.current_team || '';
        const playerDetails = position && team ? ` (${position}, ${team})` : '';
        
        // Get trending reason and clean summary
        const trendTypes = Array.from(player.trendTypes || []).join(', ');
        const rawReason = player.reasons && player.reasons.length > 0 ? player.reasons[0] : '';
        
        // Create clean summary from the raw reason
        let summary = '';
        if (rawReason) {
          summary = this.createPlayerSummary(player.name, rawReason, trendTypes);
        }
        
        response += `**${index + 1}. ${player.name}**${playerDetails}\n`;
        response += `Impact: ${player.fantasyImpact}/10 | Recommendation: ${player.recommendation}\n`;
        
        if (trendTypes) {
          response += `Trending: ${trendTypes}\n`;
        }
        
        if (summary) {
          response += `Summary: ${summary}\n`;
        }
        
        response += `Sources: ${player.mentions} mentions across ${player.sources.size} platforms\n\n`;
      });
    } else {
      response += `**Top Trending Players:**\nNo significant trending activity detected.\n\n`;
    }

    response += `**Categories:**\n`;
    Object.entries(analysis.categories).forEach(([category, players]) => {
      response += `${category}: ${players}\n`;
    });

    response += `\nGenerated: ${new Date(analysis.generated).toLocaleTimeString()}`;
    if (analysis.nextUpdate) {
      response += ` | ${analysis.nextUpdate}`;
    }

    return response;
  }
}

module.exports = TrendingAnalyzer;