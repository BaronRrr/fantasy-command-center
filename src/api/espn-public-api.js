const axios = require('axios');
const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
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

class ESPNPublicAPI {
  constructor() {
    this.baseURL = 'http://site.api.espn.com/apis/site/v2/sports/football/nfl';
    this.enhancer = new FantasyKnowledgeEnhancer();
    
    this.axiosInstance = axios.create({
      timeout: 10000, // Reduced to 10 seconds for faster failover
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    this.endpoints = {
      scoreboard: '/scoreboard',
      news: '/news',
      teams: '/teams',
      team: '/teams/:team'
    };

    this.teamCache = new Map();
    this.newsCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Circuit breaker state
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      maxFailures: 3,
      resetTimeout: 30000, // 30 seconds
      isOpen: false
    };

    // Rate limiting
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests
  }

  async makeRequest(url, cacheKey = null) {
    // Check circuit breaker
    if (this.isCircuitOpen()) {
      throw new Error('ESPN API circuit breaker is open');
    }

    // Rate limiting
    await this.waitForRateLimit();

    try {
      const response = await this.axiosInstance.get(url);
      this.recordSuccess();
      return response;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  isCircuitOpen() {
    if (!this.circuitBreaker.isOpen) return false;
    
    const now = Date.now();
    if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
      this.resetCircuitBreaker();
      return false;
    }
    
    return true;
  }

  recordFailure() {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.isOpen = true;
      logger.warn(`ESPN API circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }
  }

  recordSuccess() {
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1);
      logger.debug('ESPN API success - reducing failure count');
    }
  }

  resetCircuitBreaker() {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.lastFailureTime = null;
    logger.info('ESPN API circuit breaker reset');
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  async getScoreboard() {
    try {
      logger.info('Fetching NFL scoreboard...');
      const url = `${this.baseURL}${this.endpoints.scoreboard}`;
      const response = await this.makeRequest(url);
      
      const games = response.data.events.map(game => ({
        id: game.id,
        name: game.name,
        shortName: game.shortName,
        date: game.date,
        status: game.status.type.description,
        week: game.week?.number,
        season: game.season?.year,
        home: {
          team: game.competitions[0].competitors.find(c => c.homeAway === 'home')?.team.displayName,
          abbreviation: game.competitions[0].competitors.find(c => c.homeAway === 'home')?.team.abbreviation,
          score: game.competitions[0].competitors.find(c => c.homeAway === 'home')?.score,
          record: game.competitions[0].competitors.find(c => c.homeAway === 'home')?.records?.[0]?.summary
        },
        away: {
          team: game.competitions[0].competitors.find(c => c.homeAway === 'away')?.team.displayName,
          abbreviation: game.competitions[0].competitors.find(c => c.homeAway === 'away')?.team.abbreviation,
          score: game.competitions[0].competitors.find(c => c.homeAway === 'away')?.score,
          record: game.competitions[0].competitors.find(c => c.homeAway === 'away')?.records?.[0]?.summary
        },
        weather: game.weather,
        venue: game.competitions[0].venue?.fullName
      }));

      logger.info(`Retrieved ${games.length} NFL games`);
      return games;
      
    } catch (error) {
      logger.error('Failed to fetch scoreboard:', error.message);
      throw error;
    }
  }

  async getNews(limit = 20) {
    try {
      const cacheKey = `news-${limit}`;
      const cached = this.getFromCache(this.newsCache, cacheKey);
      if (cached) return cached;

      logger.info('Fetching NFL news...');
      const url = `${this.baseURL}${this.endpoints.news}`;
      const response = await this.makeRequest(url + `?limit=${limit}`);
      
      const articles = response.data.articles.map(article => ({
        id: article.id,
        headline: article.headline,
        description: article.description,
        story: article.story,
        published: article.published,
        lastModified: article.lastModified,
        byline: article.byline,
        source: article.source,
        categories: article.categories?.map(cat => cat.description),
        links: article.links,
        images: article.images?.map(img => ({
          url: img.url,
          caption: img.caption,
          alt: img.alt
        })),
        // Extract fantasy-relevant info
        isFantasyRelevant: this.isFantasyRelevant(article),
        fantasyImpact: this.assessFantasyImpact(article)
      }));

      this.setCache(this.newsCache, cacheKey, articles);
      logger.info(`Retrieved ${articles.length} NFL news articles`);
      
      return articles;
      
    } catch (error) {
      logger.error('Failed to fetch news:', error.message);
      throw error;
    }
  }

  async getAllTeams() {
    try {
      const cached = this.getFromCache(this.teamCache, 'all-teams');
      if (cached) return cached;

      logger.info('Fetching all NFL teams...');
      const url = `${this.baseURL}${this.endpoints.teams}`;
      const response = await this.makeRequest(url);
      
      const teams = response.data.sports[0].leagues[0].teams.map(teamData => ({
        id: teamData.team.id,
        name: teamData.team.displayName,
        abbreviation: teamData.team.abbreviation,
        location: teamData.team.location,
        nickname: teamData.team.nickname,
        color: teamData.team.color,
        alternateColor: teamData.team.alternateColor,
        logos: teamData.team.logos,
        record: teamData.team.record,
        standingSummary: teamData.team.standingSummary,
        venue: teamData.team.venue
      }));

      this.setCache(this.teamCache, 'all-teams', teams);
      logger.info(`Retrieved ${teams.length} NFL teams`);
      
      return teams;
      
    } catch (error) {
      logger.error('Failed to fetch teams:', error.message);
      throw error;
    }
  }

  async getTeam(teamId) {
    try {
      const cacheKey = `team-${teamId}`;
      const cached = this.getFromCache(this.teamCache, cacheKey);
      if (cached) return cached;

      logger.info(`Fetching team data for ${teamId}...`);
      const url = `${this.baseURL}${this.endpoints.team.replace(':team', teamId)}`;
      const response = await this.makeRequest(url);
      
      const team = response.data.team;
      const teamData = {
        id: team.id,
        name: team.displayName,
        abbreviation: team.abbreviation,
        location: team.location,
        nickname: team.nickname,
        color: team.color,
        alternateColor: team.alternateColor,
        logos: team.logos,
        record: team.record,
        standingSummary: team.standingSummary,
        nextEvent: team.nextEvent,
        venue: team.venue,
        athletes: team.athletes?.map(athlete => ({
          id: athlete.id,
          name: athlete.displayName,
          position: athlete.position?.displayName,
          jersey: athlete.jersey,
          headshot: athlete.headshot,
          age: athlete.age,
          experience: athlete.experience?.years
        })) || []
      };

      this.setCache(this.teamCache, cacheKey, teamData);
      logger.info(`Retrieved team data for ${team.displayName}`);
      
      return teamData;
      
    } catch (error) {
      logger.error(`Failed to fetch team ${teamId}:`, error.message);
      throw error;
    }
  }

  async getFantasyRelevantNews() {
    try {
      const allNews = await this.getNews(50);
      const fantasyNews = allNews.filter(article => article.isFantasyRelevant);
      
      logger.info(`Found ${fantasyNews.length} fantasy-relevant articles`);
      return fantasyNews;
      
    } catch (error) {
      logger.error('Failed to get fantasy news:', error.message);
      throw error;
    }
  }

  async addNewsToKnowledgeBase() {
    try {
      logger.info('Adding fantasy-relevant news to knowledge base...');
      
      const fantasyNews = await this.getFantasyRelevantNews();
      let addedCount = 0;
      
      for (const article of fantasyNews.slice(0, 10)) { // Limit to prevent spam
        try {
          // Check if already exists
          const existing = await this.enhancer.searchKnowledge(article.headline);
          if (existing.length > 0) continue;
          
          const content = `${article.description || ''}\n\n${article.story || ''}\n\nFantasy Impact: ${article.fantasyImpact}`;
          
          await this.enhancer.addArticle(
            article.headline,
            content,
            'ESPN NFL News',
            'news'
          );
          
          addedCount++;
          logger.info(`Added: ${article.headline}`);
          
        } catch (error) {
          logger.debug(`Failed to add article: ${error.message}`);
        }
      }
      
      logger.info(`Added ${addedCount} news articles to knowledge base`);
      return addedCount;
      
    } catch (error) {
      logger.error('Failed to add news to knowledge base:', error.message);
      return 0;
    }
  }

  isFantasyRelevant(article) {
    const fantasyKeywords = [
      'injury', 'injured', 'questionable', 'doubtful', 'out',
      'trade', 'traded', 'waiver', 'signed', 'released',
      'starting', 'starter', 'backup', 'depth chart',
      'touchdown', 'yards', 'fantasy', 'targets', 'carries',
      'snap count', 'playing time', 'role', 'usage',
      'quarterback', 'running back', 'wide receiver', 'tight end',
      'rb', 'wr', 'qb', 'te', 'flex'
    ];

    const text = `${article.headline} ${article.description || ''}`.toLowerCase();
    return fantasyKeywords.some(keyword => text.includes(keyword));
  }

  assessFantasyImpact(article) {
    const text = `${article.headline} ${article.description || ''}`.toLowerCase();
    
    if (text.includes('out') || text.includes('injured') || text.includes('ir')) {
      return 'HIGH - Injury impact, handcuff opportunities';
    }
    
    if (text.includes('trade') || text.includes('signed') || text.includes('starting')) {
      return 'MEDIUM - Role change, target/carry redistribution';
    }
    
    if (text.includes('questionable') || text.includes('limited')) {
      return 'MEDIUM - Monitor for lineup decisions';
    }
    
    return 'LOW - Monitor for developing situations';
  }

  getFromCache(cache, key) {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCache(cache, key, data) {
    cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  getHealthStatus() {
    return {
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      maxFailures: this.circuitBreaker.maxFailures,
      lastFailureTime: this.circuitBreaker.lastFailureTime,
      resetTimeout: this.circuitBreaker.resetTimeout,
      cacheSize: {
        teams: this.teamCache.size,
        news: this.newsCache.size
      },
      rateLimit: {
        minInterval: this.minRequestInterval,
        lastRequestTime: this.lastRequestTime
      }
    };
  }

  resetHealth() {
    this.resetCircuitBreaker();
    this.teamCache.clear();
    this.newsCache.clear();
    logger.info('ESPN API health status and cache reset');
  }

  async healthCheck() {
    try {
      await this.getNews(1);
      return { 
        status: 'connected', 
        timestamp: new Date().toISOString(),
        ...this.getHealthStatus()
      };
    } catch (error) {
      return { 
        status: 'error', 
        error: error.message, 
        timestamp: new Date().toISOString(),
        ...this.getHealthStatus()
      };
    }
  }
}

module.exports = ESPNPublicAPI;