const axios = require('axios');
const winston = require('winston');
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

class TwitterMonitor {
  constructor() {
    this.discordNotifier = new DiscordNotifier();
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });
    
    // Twitter RSS feeds (no API keys required)
    this.twitterFeeds = {
      // NFL Insiders (CRITICAL for breaking news)
      schefter: {
        name: 'Adam Schefter',
        rss: 'https://rss.app/feeds/twitter/AdamSchefter.xml',
        priority: 'CRITICAL',
        category: 'breaking_news'
      },
      rapoport: {
        name: 'Ian Rapoport',
        rss: 'https://rss.app/feeds/twitter/RapSheet.xml',
        priority: 'CRITICAL',
        category: 'breaking_news'
      },
      
      // Fantasy Experts (HIGH for draft advice)
      evan_silva: {
        name: 'Evan Silva',
        rss: 'https://rss.app/feeds/twitter/EvanSilva.xml',
        priority: 'HIGH',
        category: 'draft_analysis'
      },
      scott_barrett: {
        name: 'Scott Barrett',
        rss: 'https://rss.app/feeds/twitter/ScottBarrettDFB.xml',
        priority: 'HIGH',
        category: 'draft_analysis'
      },
      matthew_berry: {
        name: 'Matthew Berry',
        rss: 'https://rss.app/feeds/twitter/MatthewBerryTMR.xml',
        priority: 'MEDIUM',
        category: 'draft_analysis'
      },
      
      // Beat Writers (HIGH for injury scoops)
      auman: {
        name: 'Greg Auman (Bucs)',
        rss: 'https://rss.app/feeds/twitter/gregauman.xml',
        priority: 'HIGH',
        category: 'team_news'
      },
      birkett: {
        name: 'Dave Birkett (Lions)',
        rss: 'https://rss.app/feeds/twitter/davebirkett.xml',
        priority: 'HIGH',
        category: 'team_news'
      },
      
      // Additional Key Sources
      field_yates: {
        name: 'Field Yates',
        rss: 'https://rss.app/feeds/twitter/FieldYates.xml',
        priority: 'HIGH',
        category: 'transactions'
      },
      rotoworld_football: {
        name: 'RotoWorld Football',
        rss: 'https://rss.app/feeds/twitter/Rotoworld_FB.xml',
        priority: 'HIGH',
        category: 'player_news'
      }
    };

    // Critical keywords for draft impact
    this.draftKeywords = [
      'injury', 'injured', 'hurt', 'out', 'questionable', 'doubtful', 'probable',
      'ir', 'injured reserve', 'surgery', 'torn', 'sprained', 'broken',
      'starter', 'starting', 'backup', 'depth chart', 'snap count',
      'trade', 'traded', 'waiver', 'signed', 'released', 'cut',
      'suspension', 'suspended', 'eligible', 'return',
      'breakout', 'sleeper', 'bust', 'avoid', 'draft', 'adp'
    ];

    // News urgency levels
    this.urgencyLevels = {
      CRITICAL: ['injury', 'out', 'ir', 'surgery', 'trade', 'suspended'],
      HIGH: ['questionable', 'doubtful', 'starter', 'waiver', 'signed'],
      MEDIUM: ['probable', 'snap count', 'depth chart', 'breakout'],
      LOW: ['sleeper', 'bust', 'avoid', 'adp']
    };
    
    this.lastFetch = {};
    this.processedTweets = new Set(); // Avoid duplicates
  }

  async startMonitoring() {
    logger.info('🐦 Starting Twitter monitoring for draft intelligence...');
    
    // Initial fetch
    await this.fetchAllFeeds();
    
    // Set up intervals based on priority
    setInterval(() => this.fetchCriticalFeeds(), 2 * 60 * 1000);  // 2 minutes
    setInterval(() => this.fetchHighPriorityFeeds(), 5 * 60 * 1000); // 5 minutes
    setInterval(() => this.fetchMediumPriorityFeeds(), 15 * 60 * 1000); // 15 minutes
  }

  async fetchAllFeeds() {
    for (const [feedKey, feed] of Object.entries(this.twitterFeeds)) {
      try {
        await this.fetchFeed(feedKey, feed);
        await this.delay(1000); // Rate limiting
      } catch (error) {
        logger.error(`Error fetching ${feed.name}:`, error.message);
      }
    }
  }

  async fetchCriticalFeeds() {
    const criticalFeeds = Object.entries(this.twitterFeeds)
      .filter(([key, feed]) => feed.priority === 'CRITICAL');
    
    for (const [feedKey, feed] of criticalFeeds) {
      await this.fetchFeed(feedKey, feed);
      await this.delay(500);
    }
  }

  async fetchHighPriorityFeeds() {
    const highFeeds = Object.entries(this.twitterFeeds)
      .filter(([key, feed]) => feed.priority === 'HIGH');
    
    for (const [feedKey, feed] of highFeeds) {
      await this.fetchFeed(feedKey, feed);
      await this.delay(1000);
    }
  }

  async fetchMediumPriorityFeeds() {
    const mediumFeeds = Object.entries(this.twitterFeeds)
      .filter(([key, feed]) => feed.priority === 'MEDIUM');
    
    for (const [feedKey, feed] of mediumFeeds) {
      await this.fetchFeed(feedKey, feed);
      await this.delay(1000);
    }
  }

  async fetchFeed(feedKey, feed) {
    try {
      const response = await this.axiosInstance.get(feed.rss);
      
      if (response.status === 200 && response.data) {
        const tweets = this.parseRSSFeed(response.data, feed);
        const newTweets = tweets.filter(tweet => !this.processedTweets.has(tweet.id));
        
        for (const tweet of newTweets) {
          if (this.isRelevantForDraft(tweet.content)) {
            await this.processTweet(tweet, feed);
            this.processedTweets.add(tweet.id);
          }
        }
        
        logger.debug(`${feed.name}: Processed ${newTweets.length} new tweets`);
      }
      
    } catch (error) {
      logger.error(`Failed to fetch ${feed.name}:`, error.message);
    }
  }

  parseRSSFeed(xmlData, feed) {
    try {
      const tweets = [];
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s;
      const linkRegex = /<link>(.*?)<\/link>/s;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/s;
      
      let match;
      while ((match = itemRegex.exec(xmlData)) !== null) {
        const itemContent = match[1];
        
        const titleMatch = titleRegex.exec(itemContent);
        const linkMatch = linkRegex.exec(itemContent);
        const dateMatch = pubDateRegex.exec(itemContent);
        
        if (titleMatch && linkMatch) {
          const content = (titleMatch[1] || titleMatch[2] || '').trim();
          const url = (linkMatch[1] || '').trim();
          const published = dateMatch ? new Date(dateMatch[1]) : new Date();
          
          // Only process tweets from last hour
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          if (published > oneHourAgo) {
            tweets.push({
              id: this.generateTweetId(content, url),
              content: this.cleanText(content),
              url,
              published: published.toISOString(),
              author: feed.name,
              category: feed.category,
              priority: feed.priority
            });
          }
        }
      }
      
      return tweets;
      
    } catch (error) {
      logger.error(`RSS parsing failed for ${feed.name}:`, error.message);
      return [];
    }
  }

  isRelevantForDraft(content) {
    const lowercaseContent = content.toLowerCase();
    return this.draftKeywords.some(keyword => 
      lowercaseContent.includes(keyword.toLowerCase())
    );
  }

  async processTweet(tweet, feed) {
    try {
      // Determine urgency level
      const urgency = this.getUrgencyLevel(tweet.content);
      
      // Extract player names (simple approach)
      const playerMentions = this.extractPlayerNames(tweet.content);
      
      // Send to Discord for immediate alerts
      await this.sendToDiscord(tweet, urgency, playerMentions);
      
      // Add to knowledge base for AI analysis
      await this.addToKnowledgeBase(tweet, urgency, playerMentions);
      
      logger.info(`📱 Processed ${urgency} tweet from ${tweet.author}: ${tweet.content.substring(0, 100)}...`);
      
    } catch (error) {
      logger.error('Error processing tweet:', error.message);
    }
  }

  getUrgencyLevel(content) {
    const lowercaseContent = content.toLowerCase();
    
    for (const [level, keywords] of Object.entries(this.urgencyLevels)) {
      if (keywords.some(keyword => lowercaseContent.includes(keyword))) {
        return level;
      }
    }
    
    return 'LOW';
  }

  extractPlayerNames(content) {
    // Simple regex to find capitalized names (first last)
    const nameRegex = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    const matches = content.match(nameRegex) || [];
    
    // Filter out common non-player words
    const excludeWords = ['New York', 'Las Vegas', 'New England', 'Green Bay', 'San Francisco'];
    return matches.filter(name => !excludeWords.includes(name));
  }

  async sendToDiscord(tweet, urgency, playerMentions) {
    try {
      const colorMap = {
        CRITICAL: 0xFF0000,  // Red
        HIGH: 0xFF8800,      // Orange  
        MEDIUM: 0x0099FF,    // Blue
        LOW: 0x00FF00        // Green
      };

      const embed = {
        title: `🚨 ${urgency} Fantasy News`,
        description: tweet.content,
        color: colorMap[urgency],
        author: {
          name: tweet.author,
          icon_url: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
        },
        fields: [],
        timestamp: tweet.published,
        footer: {
          text: 'Fantasy Command Center • Twitter Monitor'
        },
        url: tweet.url
      };

      // Add player mentions if found
      if (playerMentions.length > 0) {
        embed.fields.push({
          name: '👤 Players Mentioned',
          value: playerMentions.join(', '),
          inline: true
        });
      }

      // Add category field
      embed.fields.push({
        name: '📂 Category',
        value: this.formatCategory(tweet.category),
        inline: true
      });

      await this.discordNotifier.sendEmbed(embed, urgency);
      
    } catch (error) {
      logger.error('Failed to send Discord notification:', error.message);
    }
  }

  async addToKnowledgeBase(tweet, urgency, playerMentions) {
    try {
      const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
      const ClaudeAI = require('../api/claude-ai');
      
      const enhancer = new FantasyKnowledgeEnhancer();
      const claude = new ClaudeAI();
      
      // First, add raw tweet to knowledge base
      const tweetId = await enhancer.addArticle(
        `Twitter: ${tweet.author} - ${playerMentions.join(', ') || 'General Update'}`,
        tweet.content,
        tweet.author,
        tweet.category
      );
      
      // Then analyze with Claude AI for deeper insights
      const analysisPrompt = `
        Analyze this fantasy football tweet for actionable insights:
        
        Tweet: "${tweet.content}"
        Author: ${tweet.author}
        Players Mentioned: ${playerMentions.join(', ') || 'None'}
        Urgency: ${urgency}
        
        Extract:
        1. Fantasy impact (positive/negative/neutral)
        2. Affected players and their outlook
        3. Draft implications (should this change ADP?)
        4. Injury/lineup implications
        5. Key takeaways for draft strategy
        
        Format as structured analysis for future reference.
      `;
      
      const aiAnalysis = await claude.generateResponse(analysisPrompt);
      
      // Store AI analysis as separate knowledge entry
      if (aiAnalysis) {
        await enhancer.addArticle(
          `AI Analysis: ${tweet.author} Tweet`,
          aiAnalysis,
          'Claude AI Analysis',
          'ai_insights'
        );
      }
      
      // Store structured data for quick lookup during drafts
      this.storeForDraftLookup(tweet, urgency, playerMentions, aiAnalysis);
      
      logger.info(`📚 Added tweet + AI analysis to knowledge base: ${tweet.content.substring(0, 50)}...`);
      
    } catch (error) {
      logger.error('Failed to add tweet to knowledge base:', error.message);
    }
  }

  storeForDraftLookup(tweet, urgency, playerMentions, aiAnalysis) {
    // Store in fast-access cache for draft recommendations
    if (!this.draftCache) {
      this.draftCache = {
        playerUpdates: new Map(),
        recentNews: [],
        injuryAlerts: [],
        lineupChanges: []
      };
    }
    
    const newsItem = {
      id: tweet.id,
      content: tweet.content,
      author: tweet.author,
      urgency: urgency,
      players: playerMentions,
      analysis: aiAnalysis,
      timestamp: tweet.published
    };
    
    // Categorize for quick draft lookup
    if (urgency === 'CRITICAL') {
      this.draftCache.recentNews.unshift(newsItem);
      // Keep only last 10 critical updates
      this.draftCache.recentNews = this.draftCache.recentNews.slice(0, 10);
    }
    
    // Store player-specific updates
    for (const player of playerMentions) {
      if (!this.draftCache.playerUpdates.has(player)) {
        this.draftCache.playerUpdates.set(player, []);
      }
      this.draftCache.playerUpdates.get(player).unshift(newsItem);
      // Keep only last 5 updates per player
      const playerUpdates = this.draftCache.playerUpdates.get(player).slice(0, 5);
      this.draftCache.playerUpdates.set(player, playerUpdates);
    }
    
    // Categorize by content type
    const lowerContent = tweet.content.toLowerCase();
    if (lowerContent.includes('injury') || lowerContent.includes('hurt') || lowerContent.includes('out')) {
      this.draftCache.injuryAlerts.unshift(newsItem);
      this.draftCache.injuryAlerts = this.draftCache.injuryAlerts.slice(0, 15);
    }
    
    if (lowerContent.includes('starter') || lowerContent.includes('lineup') || lowerContent.includes('depth')) {
      this.draftCache.lineupChanges.unshift(newsItem);
      this.draftCache.lineupChanges = this.draftCache.lineupChanges.slice(0, 10);
    }
  }

  // Method for AI draft system to get relevant Twitter insights
  getDraftRelevantInsights(playerName = null, timeframe = 120) {
    if (!this.draftCache) return null;
    
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 1000);
    
    const insights = {
      critical_news: this.draftCache.recentNews.filter(item => 
        new Date(item.timestamp) > cutoffTime
      ),
      injury_updates: this.draftCache.injuryAlerts.filter(item => 
        new Date(item.timestamp) > cutoffTime
      ),
      lineup_changes: this.draftCache.lineupChanges.filter(item => 
        new Date(item.timestamp) > cutoffTime
      ),
      player_specific: playerName ? this.draftCache.playerUpdates.get(playerName) || [] : []
    };
    
    return insights;
  }

  // Enhanced AI learning method - called periodically  
  async performPeriodicAILearning() {
    try {
      const ClaudeAI = require('../api/claude-ai');
      const claude = new ClaudeAI();
      
      if (!this.draftCache || this.draftCache.recentNews.length === 0) {
        logger.debug('No new Twitter data for AI learning');
        return;
      }
      
      // Analyze patterns in recent tweets
      const recentTweets = this.draftCache.recentNews.slice(0, 20);
      const analysisPrompt = `
        Analyze these recent fantasy football tweets for emerging patterns and trends:
        
        ${recentTweets.map(tweet => `
        - ${tweet.author}: "${tweet.content}" (${tweet.urgency})
        `).join('')}
        
        Identify:
        1. Emerging injury patterns or concerns
        2. Rising/falling player values based on news
        3. Position scarcity trends
        4. Draft strategy adjustments needed
        5. Players gaining/losing buzz
        
        Provide strategic insights for draft recommendations.
      `;
      
      const trendAnalysis = await claude.generateResponse(analysisPrompt);
      
      if (trendAnalysis) {
        // Store trend analysis for draft system
        const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
        const enhancer = new FantasyKnowledgeEnhancer();
        
        await enhancer.addArticle(
          `Twitter Trend Analysis - ${new Date().toISOString().split('T')[0]}`,
          trendAnalysis,
          'AI Pattern Recognition',
          'trend_analysis'
        );
        
        logger.info('🧠 Completed periodic AI learning from Twitter data');
      }
      
    } catch (error) {
      logger.error('Failed to perform AI learning:', error.message);
    }
  }

  formatCategory(category) {
    const categoryMap = {
      breaking_news: '🚨 Breaking News',
      draft_analysis: '📊 Draft Analysis', 
      team_news: '🏈 Team News',
      transactions: '🔄 Transactions',
      player_news: '👤 Player News'
    };
    
    return categoryMap[category] || category;
  }

  generateTweetId(content, url) {
    return Buffer.from(content + url).toString('base64').substring(0, 16);
  }

  cleanText(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')  // Remove HTML tags
      .replace(/&nbsp;/g, ' ')  // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get latest news for AI draft analysis
  getLatestDraftNews(playerName = null, timeframe = 60) {
    // This method would be called by your AI system during draft analysis
    // Returns recent tweets relevant to draft decisions
    const cutoffTime = new Date(Date.now() - timeframe * 60 * 1000);
    
    // Implementation would filter stored tweets by player/timeframe
    logger.info(`Retrieving draft-relevant news${playerName ? ` for ${playerName}` : ''} from last ${timeframe} minutes`);
    
    return {
      critical_updates: [],
      injury_reports: [],
      lineup_changes: [],
      trade_rumors: []
    };
  }

  // Manual test method
  async testFeeds() {
    logger.info('🧪 Testing Twitter RSS feeds...');
    
    const testFeeds = ['schefter', 'rapoport', 'evan_silva'];
    
    for (const feedKey of testFeeds) {
      const feed = this.twitterFeeds[feedKey];
      if (feed) {
        logger.info(`Testing ${feed.name}...`);
        await this.fetchFeed(feedKey, feed);
      }
    }
  }
}

module.exports = TwitterMonitor;