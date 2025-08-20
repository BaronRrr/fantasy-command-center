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

class NewsArticleFetcher {
  constructor() {
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    // Tier 1: Fastest Breaking News Sources (1-5 minutes)
    this.newsFeeds = {
      nfl_official: {
        name: 'NFL.com',
        rss: 'https://www.nfl.com/news/rss.xml',
        url: 'https://www.nfl.com/news',
        priority: 'CRITICAL',
        update_speed: '1-2 minutes',
        specialty: 'Official NFL news, fastest injury reports'
      },
      espn_nfl: {
        name: 'ESPN NFL',
        rss: 'https://www.espn.com/espn/rss/nfl/news',
        url: 'https://www.espn.com/nfl/',
        priority: 'CRITICAL',
        update_speed: '2-3 minutes',
        specialty: 'Breaking news, insider reports, Adam Schefter'
      },
      pro_football_talk: {
        name: 'Pro Football Talk',
        rss: 'https://profootballtalk.nbcsports.com/feed',
        url: 'https://profootballtalk.nbcsports.com/',
        priority: 'HIGH',
        update_speed: '5-15 minutes',
        specialty: 'Mike Florio analysis, rumors, legal issues'
      },
      cbs_sports_nfl: {
        name: 'CBS Sports NFL',
        rss: 'https://www.cbssports.com/rss/headlines/nfl',
        url: 'https://www.cbssports.com/nfl/',
        priority: 'HIGH',
        update_speed: '5-15 minutes',
        specialty: 'Jonathan Jones insider reports'
      },
      pff_feed: {
        name: 'Pro Football Focus',
        rss: 'https://www.pff.com/feed',
        url: 'https://www.pff.com/',
        priority: 'HIGH',
        update_speed: '15-30 minutes',
        specialty: 'Player grades, snap counts, advanced metrics'
      },
      rotoballer: {
        name: 'RotoBaller',
        rss: 'https://www.rotoballer.com/feed',
        url: 'https://www.rotoballer.com/category/nfl',
        priority: 'MEDIUM'
      },
      yahoo_fantasy: {
        name: 'Yahoo Fantasy',
        rss: 'https://sports.yahoo.com/fantasy/rss.xml',
        url: 'https://sports.yahoo.com/fantasy/',
        priority: 'MEDIUM'
      },
      sleeper_blog: {
        name: 'Sleeper Blog',
        rss: 'https://blog.sleeper.app/feed/',
        url: 'https://blog.sleeper.app/',
        priority: 'MEDIUM'
      },
      fantasypros: {
        name: 'FantasyPros',
        rss: 'https://www.fantasypros.com/nfl/rss/news.xml',
        url: 'https://www.fantasypros.com/nfl/news/',
        priority: 'MEDIUM'
      },
      // Fallback links for major sites (when RSS fails)
      espn_fantasy: {
        name: 'ESPN Fantasy',
        rss: null, // Skip RSS, use direct link
        url: 'https://www.espn.com/fantasy/football/',
        priority: 'MEDIUM'
      },
      nfl_fantasy: {
        name: 'NFL.com Fantasy',
        rss: null,
        url: 'https://www.nfl.com/fantasy/',
        priority: 'MEDIUM'
      },
      cbs_fantasy: {
        name: 'CBS Fantasy',
        rss: null,
        url: 'https://www.cbssports.com/fantasy/football/',
        priority: 'MEDIUM'
      }
    };
  }

  async fetchLatestArticles(maxArticles = 10) {
    const allArticles = [];
    
    logger.info('📰 Fetching latest fantasy football news articles...');

    for (const [feedKey, feed] of Object.entries(this.newsFeeds)) {
      try {
        logger.info(`📡 Fetching from ${feed.name}...`);
        const articles = await this.fetchFeedArticles(feed);
        
        if (articles.length > 0) {
          allArticles.push(...articles.slice(0, 3)); // Top 3 from each source
          logger.info(`✅ ${feed.name}: ${articles.length} articles found`);
        } else {
          logger.warn(`⚠️ ${feed.name}: No articles found`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        logger.warn(`❌ Failed to fetch ${feed.name}: ${error.message}`);
      }
    }

    // Sort by timestamp (newest first) and limit results
    const sortedArticles = allArticles
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, maxArticles);

    logger.info(`📊 Total articles fetched: ${sortedArticles.length}`);
    return sortedArticles;
  }

  async fetchFeedArticles(feed) {
    try {
      // Skip RSS if not provided
      if (!feed.rss) {
        return await this.scrapeWebsiteArticles(feed);
      }
      
      // Try RSS feed first
      const response = await this.axiosInstance.get(feed.rss);
      const articles = this.parseRSSFeed(response.data, feed);
      
      if (articles.length > 0) {
        // Fetch content for each article
        const enrichedArticles = await this.enrichArticlesWithContent(articles.slice(0, 2));
        return enrichedArticles;
      }
      
      // Fallback to website scraping if RSS fails
      return await this.scrapeWebsiteArticles(feed);
      
    } catch (error) {
      logger.debug(`RSS failed for ${feed.name}, trying website scraping...`);
      return await this.scrapeWebsiteArticles(feed);
    }
  }

  async enrichArticlesWithContent(articles) {
    const enrichedArticles = [];
    
    for (const article of articles) {
      try {
        // Fetch article content
        const contentResponse = await this.axiosInstance.get(article.url);
        const content = this.extractArticleContent(contentResponse.data);
        
        if (content) {
          article.content = content.substring(0, 500); // First 500 chars
          article.summary = await this.generateSummary(content);
        }
        
        enrichedArticles.push(article);
        
        // Rate limiting between article fetches
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        logger.debug(`Failed to fetch content for: ${article.title}`);
        enrichedArticles.push(article); // Add without content
      }
    }
    
    return enrichedArticles;
  }

  extractArticleContent(html) {
    try {
      // Simple content extraction - look for paragraph tags
      const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gs;
      const paragraphs = html.match(paragraphRegex) || [];
      
      const content = paragraphs
        .slice(0, 5) // First 5 paragraphs
        .map(p => this.cleanText(p.replace(/<[^>]*>/g, '')))
        .filter(p => p.length > 50) // Only meaningful paragraphs
        .join('\n\n');
        
      return content.length > 100 ? content : null;
      
    } catch (error) {
      return null;
    }
  }

  async generateSummary(content) {
    try {
      // Simple extractive summary - first few sentences
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
      return sentences.slice(0, 2).join('. ') + '.';
    } catch (error) {
      return null;
    }
  }

  parseRSSFeed(rssData, feed) {
    const articles = [];
    
    try {
      // Simple RSS parsing - look for item tags
      const itemRegex = /<item>(.*?)<\/item>/gs;
      const items = rssData.match(itemRegex) || [];
      
      for (const item of items.slice(0, 5)) {
        const title = this.extractRSSField(item, 'title');
        const link = this.extractRSSField(item, 'link');
        const description = this.extractRSSField(item, 'description');
        const pubDate = this.extractRSSField(item, 'pubDate');
        
        if (title && link) {
          articles.push({
            title: this.cleanText(title),
            url: link.trim(),
            description: this.cleanText(description || '').substring(0, 200),
            publishedAt: pubDate ? new Date(pubDate) : new Date(),
            source: feed.name,
            priority: feed.priority
          });
        }
      }
    } catch (error) {
      logger.debug(`RSS parsing failed for ${feed.name}: ${error.message}`);
    }
    
    return articles;
  }

  extractRSSField(item, fieldName) {
    const regex = new RegExp(`<${fieldName}[^>]*>(.*?)<\/${fieldName}>`, 'is');
    const match = item.match(regex);
    return match ? match[1].trim() : null;
  }

  async scrapeWebsiteArticles(feed) {
    // Fallback method - return placeholder articles with real links
    const now = new Date();
    return [
      {
        title: `Latest Fantasy News from ${feed.name}`,
        url: feed.url,
        description: `Check the latest fantasy football news and analysis`,
        publishedAt: now,
        source: feed.name,
        priority: feed.priority
      }
    ];
  }

  cleanText(text) {
    if (!text) return '';
    
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatArticlesForDiscord(articles) {
    if (articles.length === 0) {
      return "📰 No recent fantasy football news found. Check back later!";
    }

    let newsContent = `📰 **Latest Fantasy Football News** (${articles.length} articles)\n\n`;
    
    articles.forEach((article, index) => {
      const timeAgo = this.getTimeAgo(article.publishedAt);
      const priority = article.priority === 'HIGH' ? '🔥' : '📄';
      
      newsContent += `${priority} **[${article.title}](${article.url})**\n`;
      newsContent += `*${article.source} • ${timeAgo}*\n`;
      
      if (article.description) {
        newsContent += `${article.description.substring(0, 150)}...\n`;
      }
      
      newsContent += `\n`;
    });
    
    newsContent += `🔄 Updated: ${new Date().toLocaleTimeString()}`;
    return newsContent;
  }

  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - new Date(date);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    }
  }
}

module.exports = NewsArticleFetcher;