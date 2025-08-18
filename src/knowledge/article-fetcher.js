const axios = require('axios');
const FantasyKnowledgeEnhancer = require('./fantasy-enhancer');
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

class ArticleFetcher {
  constructor() {
    this.enhancer = new FantasyKnowledgeEnhancer();
    this.axiosInstance = axios.create({
      timeout: 30000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });
    
    // Enhanced RSS sources with priority and category mapping
    this.sources = {
      // EXISTING SOURCES (keep these)
      espn: {
        name: 'ESPN Fantasy',
        rss: 'https://www.espn.com/espn/rss/fantasy/news',
        category: 'rankings',
        priority: 'HIGH'
      },
      fantasypros: {
        name: 'FantasyPros',
        rss: 'https://www.fantasypros.com/nfl/news/rss.xml',
        category: 'news',
        priority: 'HIGH'
      },
      yahoo: {
        name: 'Yahoo Fantasy',
        rss: 'https://sports.yahoo.com/fantasy/football/rss.xml',
        category: 'news',
        priority: 'MEDIUM'
      },
      rotoballer: {
        name: 'RotoBaller',
        rss: 'https://www.rotoballer.com/category/nfl/feed',
        category: 'analysis',
        priority: 'HIGH'
      },
      fantasyfootballers: {
        name: 'Fantasy Footballers',
        rss: 'https://www.thefantasyfootballers.com/feed/',
        category: 'strategy',
        priority: 'MEDIUM'
      },

      // NEW TIER 1: Analytics & Expert Content (HIGH PRIORITY)
      pff: {
        name: 'Pro Football Focus',
        rss: 'https://www.pff.com/feed',
        category: 'analytics',
        priority: 'CRITICAL'
      },
      analyticsnet: {
        name: 'Fantasy Football Analytics',
        rss: 'https://fantasyfootballanalytics.net/feed',
        category: 'analytics',
        priority: 'HIGH'
      },
      rotoviz: {
        name: 'RotoViz',
        rss: 'https://rotoviz.com/feed',
        category: 'analytics',
        priority: 'HIGH'
      },
      razzball: {
        name: 'Razzball Football',
        rss: 'https://football.razzball.com/feed',
        category: 'strategy',
        priority: 'HIGH'
      },

      // NEW TIER 2: Breaking News & Player Updates (CRITICAL)
      rotoworld: {
        name: 'RotoWorld',
        rss: 'https://www.nbcsports.com/fantasy/football/news/rss',
        category: 'breaking_news',
        priority: 'CRITICAL'
      },
      rotowire: {
        name: 'RotoWire',
        rss: 'https://www.rotowire.com/rss/news.php?sport=NFL',
        category: 'player_news',
        priority: 'CRITICAL'
      },
      fantasysp: {
        name: 'Fantasy SP',
        rss: 'https://www.fantasysp.com/rss/nfl/',
        category: 'player_news',
        priority: 'HIGH'
      },
      fftoday: {
        name: 'FFToday',
        rss: 'https://fftoday.com/rss/news.xml',
        category: 'player_news',
        priority: 'MEDIUM'
      },

      // NEW TIER 3: Deep Analysis & Dynasty
      dynastyleague: {
        name: 'Dynasty League Football',
        rss: 'https://dynastyleaguefootball.com/feed',
        category: 'deep_analysis',
        priority: 'MEDIUM'
      },
      dynastynerds: {
        name: 'Dynasty Nerds',
        rss: 'https://dynastynerds.com/feed',
        category: 'draft_strategy',
        priority: 'MEDIUM'
      },
      walterfootball: {
        name: 'Walter Football',
        rss: 'https://walterfootball.com/rss.xml',
        category: 'draft_strategy',
        priority: 'MEDIUM'
      },
      fftoolbox: {
        name: 'Fantasy Football Toolbox',
        rss: 'https://fftoolbox.fulltimefantasy.com/rss.cfm',
        category: 'analysis',
        priority: 'LOW'
      },

      // NEW TIER 4: Additional Value Sources
      faketeams: {
        name: 'Fake Teams',
        rss: 'https://faketeams.com/rss/current.xml',
        category: 'deep_analysis',
        priority: 'LOW'
      },
      rotorob: {
        name: 'RotoRob',
        rss: 'https://rotorob.com/feed',
        category: 'analysis',
        priority: 'LOW'
      },
      fansided: {
        name: 'FanSided Fantasy',
        rss: 'https://fansided.com/fantasy/feed',
        category: 'analysis',
        priority: 'LOW'
      }
    };

    // Enhanced fetching configuration
    this.fetchConfig = {
      retryAttempts: 3,
      retryDelay: 5000,
      requestDelay: 2000,
      
      relevantKeywords: [
        'injury', 'waiver', 'start', 'sit', 'sleeper', 'bust',
        'projection', 'ranking', 'draft', 'trade', 'pickup',
        'snap count', 'target share', 'red zone', 'touches',
        'breakout', 'bounce back', 'adp', 'value'
      ],
      
      excludeKeywords: [
        'baseball', 'basketball', 'hockey', 'soccer',
        'college', 'high school', 'coaches', 'madden'
      ]
    };

    // Priority-based fetch intervals (in minutes)
    this.priorityIntervals = {
      CRITICAL: 5,    // Check every 5 minutes
      HIGH: 15,       // Check every 15 minutes  
      MEDIUM: 30,     // Check every 30 minutes
      LOW: 60         // Check every hour
    };
    
    this.lastFetch = {};
  }

  async fetchAllSources() {
    const results = {};
    
    for (const [sourceKey, source] of Object.entries(this.sources)) {
      try {
        logger.info(`Fetching articles from ${source.name}...`);
        const articles = await this.fetchSourceArticles(sourceKey, source);
        results[sourceKey] = articles;
        
        // Add new articles to knowledge base
        for (const article of articles) {
          await this.addArticleToKnowledge(article, source);
        }
        
      } catch (error) {
        logger.error(`Failed to fetch from ${source.name}:`, error.message);
        results[sourceKey] = [];
      }
    }
    
    return results;
  }

  async fetchSourceArticles(sourceKey, source) {
    try {
      // Check priority-based fetch intervals
      const lastFetch = this.lastFetch[sourceKey] || 0;
      const now = Date.now();
      const intervalMinutes = this.priorityIntervals[source.priority] || 60;
      const intervalMs = intervalMinutes * 60 * 1000;
      
      if (now - lastFetch < intervalMs) {
        logger.debug(`${source.name}: Skipping, fetched ${Math.round((now - lastFetch) / 60000)} minutes ago`);
        return [];
      }

      logger.info(`Fetching ${source.priority} priority source: ${source.name}`);
      
      // Attempt real RSS fetching with fallback to mock data
      let articles = await this.fetchRSSFeed(source.rss, source.name);
      
      if (!articles || articles.length === 0) {
        logger.warn(`${source.name}: RSS fetch failed, using mock data`);
        articles = this.getMockArticlesForSource(sourceKey);
      }

      // Filter articles by relevance
      const filteredArticles = this.filterRelevantArticles(articles);
      
      this.lastFetch[sourceKey] = now;
      logger.info(`${source.name}: Retrieved ${filteredArticles.length} relevant articles`);
      
      return filteredArticles;
      
    } catch (error) {
      logger.error(`Error fetching ${source.name}:`, error.message);
      return [];
    }
  }

  async fetchRSSFeed(rssUrl, sourceName) {
    try {
      // Add delay to respect rate limits
      await this.delay(this.fetchConfig.requestDelay);
      
      for (let attempt = 1; attempt <= this.fetchConfig.retryAttempts; attempt++) {
        try {
          const response = await this.axiosInstance.get(rssUrl, {
            headers: {
              'Accept': 'application/rss+xml, application/xml, text/xml',
              'User-Agent': 'Fantasy-Command-Center/1.0.0 (+https://fantasy-command-center.com)'
            }
          });

          if (response.status === 200 && response.data) {
            const articles = this.parseRSSContent(response.data, sourceName);
            if (articles.length > 0) {
              return articles;
            }
          }
        } catch (error) {
          logger.warn(`${sourceName} attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < this.fetchConfig.retryAttempts) {
            await this.delay(this.fetchConfig.retryDelay);
          }
        }
      }
      
      return [];
      
    } catch (error) {
      logger.error(`RSS fetch failed for ${sourceName}:`, error.message);
      return [];
    }
  }

  parseRSSContent(xmlData, sourceName) {
    try {
      // Simple XML parsing for RSS content
      // In production, you'd use a proper XML parser like 'xml2js'
      const articles = [];
      
      // Extract basic RSS items using regex (simplified approach)
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s;
      const linkRegex = /<link>(.*?)<\/link>/s;
      const descRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s;
      const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/s;
      
      let match;
      while ((match = itemRegex.exec(xmlData)) !== null) {
        const itemContent = match[1];
        
        const titleMatch = titleRegex.exec(itemContent);
        const linkMatch = linkRegex.exec(itemContent);
        const descMatch = descRegex.exec(itemContent);
        const dateMatch = pubDateRegex.exec(itemContent);
        
        if (titleMatch && linkMatch) {
          const title = (titleMatch[1] || titleMatch[2] || '').trim();
          const url = (linkMatch[1] || '').trim();
          const content = (descMatch ? (descMatch[1] || descMatch[2] || '') : '').trim();
          const published = dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString();
          
          if (title && url) {
            articles.push({
              title: this.cleanHTMLTags(title),
              content: this.cleanHTMLTags(content),
              url,
              published,
              source: sourceName
            });
          }
        }
      }
      
      return articles.slice(0, 10); // Limit to 10 most recent articles
      
    } catch (error) {
      logger.error(`RSS parsing failed for ${sourceName}:`, error.message);
      return [];
    }
  }

  filterRelevantArticles(articles) {
    return articles.filter(article => {
      const fullText = `${article.title} ${article.content}`.toLowerCase();
      
      // Check for relevant keywords
      const hasRelevantContent = this.fetchConfig.relevantKeywords.some(keyword => 
        fullText.includes(keyword.toLowerCase())
      );
      
      // Check for excluded content
      const hasExcludedContent = this.fetchConfig.excludeKeywords.some(keyword => 
        fullText.includes(keyword.toLowerCase())
      );
      
      return hasRelevantContent && !hasExcludedContent;
    });
  }

  cleanHTMLTags(text) {
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

  getMockArticlesForSource(sourceKey) {
    // This simulates fetching articles - in production you'd parse RSS feeds
    const mockData = {
      espn: [
        {
          title: 'Week 1 Start/Sit Recommendations',
          content: 'Expert analysis on key lineup decisions for Week 1 of the 2025 fantasy season...',
          url: 'https://espn.com/fantasy/start-sit-week1',
          published: new Date().toISOString()
        }
      ],
      fantasypros: [
        {
          title: 'Top Waiver Wire Pickups for Week 1',
          content: 'Key free agent targets emerging from preseason and early games...',
          url: 'https://fantasypros.com/waiver-wire-week1',
          published: new Date().toISOString()
        }
      ],
      yahoo: [
        {
          title: 'Injury Updates Affecting Fantasy Lineups',
          content: 'Latest injury reports and their fantasy football implications...',
          url: 'https://yahoo.com/fantasy/injuries-week1',
          published: new Date().toISOString()
        }
      ]
    };
    
    return mockData[sourceKey] || [];
  }

  async addArticleToKnowledge(article, source) {
    try {
      // Check if article already exists to avoid duplicates
      const existingArticles = await this.enhancer.searchKnowledge(article.title);
      if (existingArticles.length > 0) {
        logger.debug(`Article already exists: ${article.title}`);
        return null;
      }
      
      const articleId = await this.enhancer.addArticle(
        article.title,
        article.content,
        source.name,
        source.category
      );
      
      logger.info(`Added article: ${article.title} from ${source.name}`);
      return articleId;
      
    } catch (error) {
      logger.error(`Failed to add article to knowledge base:`, error.message);
      return null;
    }
  }

  // Manual article addition from URLs
  async addArticleFromURL(url, title, source = 'Manual', category = 'analysis') {
    try {
      logger.info(`Fetching article from URL: ${url}`);
      
      // For now, this requires manual content input
      // In production, you could use web scraping or APIs
      console.log('📰 MANUAL ARTICLE ADDITION');
      console.log(`URL: ${url}`);
      console.log(`Title: ${title}`);
      console.log('Please copy and paste the article content:');
      
      return {
        success: false,
        message: 'Manual content input required. Use add-knowledge.js for interactive addition.'
      };
      
    } catch (error) {
      logger.error('Failed to fetch article from URL:', error.message);
      throw error;
    }
  }

  // Batch add ESPN articles from their draft guide
  async addESPNDraftGuideArticles() {
    const espnArticles = [
      {
        title: 'Mike Clay Ultimate Draft Board 2025',
        content: 'Round-by-round ideal picks for 12-team leagues with detailed position strategy and value analysis...',
        category: 'strategy'
      },
      {
        title: 'Eric Karabell Do Draft and Do Not Draft Lists 2025',
        content: 'Undervalued targets like Davante Henry, Brock Purdy, Travis Kelce vs overvalued players like CMC, Mark Andrews...',
        category: 'rankings'
      },
      {
        title: 'Deep Sleepers and Late Round Fliers 2025',
        content: 'Off-the-radar players like Tory Horton, Jaxson Dart, Adonai Mitchell for late rounds and deep formats...',
        category: 'sleepers'
      },
      {
        title: 'QB/RB/WR/TE Tier Analysis 2025',
        content: 'Position-by-position tier breakdowns showing clustering and drop-off points for strategic drafting...',
        category: 'tiers'
      },
      {
        title: 'Breakout and Bounce-Back Candidates 2025',
        content: 'Year-2 breakouts like Maye, Harrison, Odunze and bounce-back candidates with detailed analysis...',
        category: 'projections'
      }
    ];

    const results = [];
    for (const article of espnArticles) {
      try {
        const id = await this.enhancer.addArticle(
          article.title,
          article.content,
          'ESPN Fantasy Football',
          article.category
        );
        results.push({ success: true, id, title: article.title });
      } catch (error) {
        results.push({ success: false, error: error.message, title: article.title });
      }
    }

    return results;
  }

  async getKnowledgeStats() {
    return await this.enhancer.getStats();
  }
}

module.exports = ArticleFetcher;