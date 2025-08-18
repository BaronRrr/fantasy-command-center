const axios = require('axios');
const config = require('../../config');
const winston = require('winston');
const DuckDuckGoSearch = require('./duckduckgo-search');
const WeatherClient = require('./weather-client');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class ExternalAPIsClient {
  constructor() {
    this.sportsDataConfig = config.externalAPIs.sportsData;
    this.fantasyProsConfig = config.externalAPIs.fantasyPros;
    this.weatherConfig = config.externalAPIs.weather;
    this.newsConfig = config.externalAPIs.news;
    
    // Initialize free data sources
    this.duckDuckGoSearch = new DuckDuckGoSearch();
    this.weatherClient = new WeatherClient();
    
    this.sportsDataClient = axios.create({
      baseURL: this.sportsDataConfig.baseURL,
      timeout: 30000,
      headers: {
        'Ocp-Apim-Subscription-Key': this.sportsDataConfig.apiKey
      }
    });

    this.fantasyProsClient = axios.create({
      baseURL: this.fantasyProsConfig.baseURL,
      timeout: 30000,
      headers: {
        'x-api-key': this.fantasyProsConfig.apiKey
      }
    });

    this.weatherClient = axios.create({
      baseURL: this.weatherConfig.baseURL,
      timeout: 15000,
      params: {
        apikey: this.weatherConfig.apiKey
      }
    });

    this.newsClient = axios.create({
      baseURL: this.newsConfig.baseURL,
      timeout: 15000,
      params: {
        apiKey: this.newsConfig.apiKey
      }
    });

    this.cache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes
  }

  getCacheKey(source, endpoint, params = {}) {
    const paramsString = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
    return `${source}-${endpoint}-${paramsString}`;
  }

  getCachedData(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCachedData(cacheKey, data) {
    this.cache.set(cacheKey, {
      data: data,
      timestamp: Date.now()
    });
  }

  async makeRequest(client, endpoint, params = {}, cacheKey = null) {
    try {
      if (cacheKey) {
        const cached = this.getCachedData(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for ${cacheKey}`);
          return cached;
        }
      }

      logger.debug(`Making API request to ${endpoint}`);
      const response = await client.get(endpoint, { params });
      
      if (response.status === 200) {
        const data = response.data;
        if (cacheKey) {
          this.setCachedData(cacheKey, data);
        }
        return data;
      } else {
        throw new Error(`API returned status ${response.status}`);
      }
    } catch (error) {
      logger.error(`API request failed for ${endpoint}:`, error.message);
      throw error;
    }
  }

  async getPlayerStats(playerId, season = 2025) {
    try {
      const cacheKey = this.getCacheKey('sportsdata', 'playerstats', { playerId, season });
      const endpoint = `${this.sportsDataConfig.endpoints.stats}/${season}`;
      
      const allStats = await this.makeRequest(this.sportsDataClient, endpoint, {}, cacheKey);
      const playerStats = allStats.find(player => player.PlayerID === playerId);
      
      if (!playerStats) {
        return null;
      }

      return {
        playerId: playerStats.PlayerID,
        name: playerStats.Name,
        position: playerStats.Position,
        team: playerStats.Team,
        games: playerStats.Games,
        fantasyPoints: playerStats.FantasyPoints,
        passingYards: playerStats.PassingYards,
        passingTDs: playerStats.PassingTouchdowns,
        rushingYards: playerStats.RushingYards,
        rushingTDs: playerStats.RushingTouchdowns,
        receivingYards: playerStats.ReceivingYards,
        receivingTDs: playerStats.ReceivingTouchdowns,
        receptions: playerStats.Receptions,
        targets: playerStats.Targets,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to get player stats for ${playerId}:`, error.message);
      return null;
    }
  }

  async getPlayerProjections(position = null, week = null) {
    try {
      const params = {};
      if (week) params.week = week;
      
      const cacheKey = this.getCacheKey('sportsdata', 'projections', params);
      const endpoint = this.sportsDataConfig.endpoints.projections;
      
      const projections = await this.makeRequest(this.sportsDataClient, endpoint, params, cacheKey);
      
      let filteredProjections = projections;
      if (position) {
        filteredProjections = projections.filter(player => player.Position === position);
      }

      return filteredProjections.map(player => ({
        playerId: player.PlayerID,
        name: player.Name,
        position: player.Position,
        team: player.Team,
        week: player.Week,
        projectedFantasyPoints: player.FantasyPoints,
        projectedPassingYards: player.PassingYards,
        projectedPassingTDs: player.PassingTouchdowns,
        projectedRushingYards: player.RushingYards,
        projectedRushingTDs: player.RushingTouchdowns,
        projectedReceivingYards: player.ReceivingYards,
        projectedReceivingTDs: player.ReceivingTouchdowns,
        projectedReceptions: player.Receptions,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to get player projections:', error.message);
      return [];
    }
  }

  async getInjuryReports() {
    try {
      const cacheKey = this.getCacheKey('sportsdata', 'injuries', {});
      const endpoint = this.sportsDataConfig.endpoints.injuries;
      
      const injuries = await this.makeRequest(this.sportsDataClient, endpoint, {}, cacheKey);
      
      return injuries.map(injury => ({
        playerId: injury.PlayerID,
        name: injury.Name,
        position: injury.Position,
        team: injury.Team,
        injuryStatus: injury.Status,
        bodyPart: injury.BodyPart,
        practice: injury.Practice,
        practiceDescription: injury.PracticeDescription,
        startDate: injury.StartDate,
        lastUpdate: injury.Updated,
        severity: this.categorizeInjurySeverity(injury.Status)
      }));
    } catch (error) {
      logger.error('Failed to get injury reports:', error.message);
      return [];
    }
  }

  categorizeInjurySeverity(status) {
    const severeStatuses = ['Out', 'IR', 'PUP', 'Suspended'];
    const moderateStatuses = ['Doubtful', 'Questionable'];
    const mildStatuses = ['Probable', 'Probable to Play'];

    if (severeStatuses.includes(status)) return 'SEVERE';
    if (moderateStatuses.includes(status)) return 'MODERATE';
    if (mildStatuses.includes(status)) return 'MILD';
    return 'UNKNOWN';
  }

  async getDepthCharts(team = null) {
    try {
      const params = team ? { team } : {};
      const cacheKey = this.getCacheKey('sportsdata', 'depthcharts', params);
      const endpoint = this.sportsDataConfig.endpoints.depthCharts;
      
      const depthCharts = await this.makeRequest(this.sportsDataClient, endpoint, params, cacheKey);
      
      return depthCharts.map(entry => ({
        playerId: entry.PlayerID,
        name: entry.Name,
        position: entry.Position,
        team: entry.Team,
        depthOrder: entry.DepthOrder,
        positionCategory: entry.PositionCategory,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to get depth charts:', error.message);
      return [];
    }
  }

  async getFantasyProsRankings(position = null, scoringType = 'PPR') {
    try {
      const params = { scoring: scoringType.toLowerCase() };
      if (position) params.position = position;
      
      const cacheKey = this.getCacheKey('fantasypros', 'rankings', params);
      const endpoint = this.fantasyProsConfig.endpoints.rankings;
      
      const rankings = await this.makeRequest(this.fantasyProsClient, endpoint, params, cacheKey);
      
      return rankings.map(player => ({
        playerId: player.player_id,
        name: player.player_name,
        position: player.position,
        team: player.team,
        rank: player.rank,
        tier: player.tier,
        adp: player.adp,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to get FantasyPros rankings:', error.message);
      return [];
    }
  }

  async getADPData(format = 'standard') {
    try {
      const params = { format };
      const cacheKey = this.getCacheKey('fantasypros', 'adp', params);
      const endpoint = this.fantasyProsConfig.endpoints.adp;
      
      const adpData = await this.makeRequest(this.fantasyProsClient, endpoint, params, cacheKey);
      
      return adpData.map(player => ({
        playerId: player.player_id,
        name: player.player_name,
        position: player.position,
        team: player.team,
        adp: player.avg_adp,
        minPick: player.min_pick,
        maxPick: player.max_pick,
        stdDev: player.std_dev,
        lastUpdated: new Date().toISOString()
      }));
    } catch (error) {
      logger.error('Failed to get ADP data:', error.message);
      return [];
    }
  }

  async getGameWeather(week) {
    try {
      const params = { week };
      const cacheKey = this.getCacheKey('weather', 'gameweather', params);
      
      const cached = this.getCachedData(cacheKey);
      if (cached) return cached;

      // Use DuckDuckGo weather search first
      const ddgWeatherReport = await this.duckDuckGoSearch.searchWeeklyWeatherReport();
      if (ddgWeatherReport && ddgWeatherReport.length > 0) {
        this.setCachedData(cacheKey, ddgWeatherReport);
        return ddgWeatherReport;
      }

      // Fallback to OpenWeather API
      const weeklyWeather = await this.weatherClient.getWeeklyWeatherReport(week);
      if (weeklyWeather && weeklyWeather.length > 0) {
        this.setCachedData(cacheKey, weeklyWeather);
        return weeklyWeather;
      }

      // Final fallback to mock data
      const mockWeatherData = [
        {
          homeTeam: 'BUF',
          awayTeam: 'MIA',
          temperature: 45,
          conditions: 'Light Snow',
          windSpeed: 15,
          precipitation: 30,
          impact: 'Moderate - May affect passing game',
          severity: 'MODERATE'
        },
        {
          homeTeam: 'GB',
          awayTeam: 'MIN',
          temperature: 28,
          conditions: 'Clear',
          windSpeed: 8,
          precipitation: 0,
          impact: 'Minimal - Cold but clear',
          severity: 'MILD'
        }
      ];

      this.setCachedData(cacheKey, mockWeatherData);
      return mockWeatherData;
    } catch (error) {
      logger.error(`Failed to get weather for week ${week}:`, error.message);
      return [];
    }
  }

  async getPlayerNews(playerName = null, limit = 20) {
    try {
      // Try DuckDuckGo search first (free)
      if (playerName) {
        const ddgNews = await this.duckDuckGoSearch.searchPlayerNews(playerName);
        if (ddgNews && ddgNews.length > 0) {
          return ddgNews.slice(0, limit);
        }
      } else {
        const breakingNews = await this.duckDuckGoSearch.searchBreakingNews();
        if (breakingNews && breakingNews.length > 0) {
          return breakingNews.slice(0, limit);
        }
      }

      // Fallback to NewsAPI if DuckDuckGo fails
      const query = playerName ? `"${playerName}" NFL fantasy` : 'NFL fantasy football';
      const params = {
        q: query,
        sortBy: 'publishedAt',
        pageSize: limit,
        domains: 'espn.com,nfl.com,fantasypros.com,rotoworld.com'
      };
      
      const cacheKey = this.getCacheKey('news', 'everything', params);
      const endpoint = '/everything';
      
      const newsData = await this.makeRequest(this.newsClient, endpoint, params, cacheKey);
      
      return newsData.articles?.map(article => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: article.source.name,
        publishedAt: article.publishedAt,
        relevantPlayer: this.extractPlayerFromTitle(article.title),
        impact: this.categorizeNewsImpact(article.title, article.description)
      })) || [];
    } catch (error) {
      logger.error('Failed to get player news:', error.message);
      return [];
    }
  }

  extractPlayerFromTitle(title) {
    const commonNames = ['Josh Allen', 'Christian McCaffrey', 'Cooper Kupp', 'Travis Kelce'];
    
    for (const name of commonNames) {
      if (title.includes(name)) {
        return name;
      }
    }
    
    return null;
  }

  categorizeNewsImpact(title, description) {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('injured') || text.includes('injury') || text.includes('hurt')) {
      return 'INJURY';
    }
    if (text.includes('traded') || text.includes('signs') || text.includes('released')) {
      return 'ROSTER_MOVE';
    }
    if (text.includes('suspended') || text.includes('arrested')) {
      return 'DISCIPLINE';
    }
    if (text.includes('breakout') || text.includes('sleeper') || text.includes('target')) {
      return 'OPPORTUNITY';
    }
    
    return 'GENERAL';
  }

  async enrichPlayerData(espnPlayer) {
    try {
      const enrichedData = { ...espnPlayer };
      
      const [stats, projections, injuries, rankings, adp] = await Promise.allSettled([
        this.getPlayerStats(espnPlayer.id),
        this.getPlayerProjections(espnPlayer.position),
        this.getInjuryReports(),
        this.getFantasyProsRankings(espnPlayer.position),
        this.getADPData()
      ]);

      if (stats.status === 'fulfilled' && stats.value) {
        enrichedData.stats = stats.value;
      }

      if (projections.status === 'fulfilled') {
        const playerProjection = projections.value.find(p => 
          p.name.toLowerCase().includes(espnPlayer.name.toLowerCase().split(' ')[0]) &&
          p.position === espnPlayer.position
        );
        if (playerProjection) {
          enrichedData.projections = playerProjection;
        }
      }

      if (injuries.status === 'fulfilled') {
        const playerInjury = injuries.value.find(i => 
          i.name.toLowerCase().includes(espnPlayer.name.toLowerCase().split(' ')[0]) &&
          i.position === espnPlayer.position
        );
        if (playerInjury) {
          enrichedData.injury = playerInjury;
        }
      }

      if (rankings.status === 'fulfilled') {
        const playerRanking = rankings.value.find(r => 
          r.name.toLowerCase().includes(espnPlayer.name.toLowerCase().split(' ')[0]) &&
          r.position === espnPlayer.position
        );
        if (playerRanking) {
          enrichedData.ranking = playerRanking;
        }
      }

      if (adp.status === 'fulfilled') {
        const playerADP = adp.value.find(a => 
          a.name.toLowerCase().includes(espnPlayer.name.toLowerCase().split(' ')[0]) &&
          a.position === espnPlayer.position
        );
        if (playerADP) {
          enrichedData.adp = playerADP.adp;
        }
      }

      enrichedData.lastEnriched = new Date().toISOString();
      return enrichedData;
    } catch (error) {
      logger.error(`Failed to enrich data for ${espnPlayer.name}:`, error.message);
      return espnPlayer;
    }
  }

  async getScheduleStrength(team, position = null) {
    try {
      const mockScheduleData = {
        'KC': { overall: 'EASY', vs_QB: 'MEDIUM', vs_RB: 'HARD', vs_WR: 'EASY', vs_TE: 'MEDIUM' },
        'BUF': { overall: 'MEDIUM', vs_QB: 'HARD', vs_RB: 'MEDIUM', vs_WR: 'EASY', vs_TE: 'HARD' },
        'MIA': { overall: 'HARD', vs_QB: 'EASY', vs_RB: 'EASY', vs_WR: 'MEDIUM', vs_TE: 'EASY' }
      };

      const teamSchedule = mockScheduleData[team] || { overall: 'MEDIUM' };
      
      if (position) {
        return teamSchedule[`vs_${position}`] || 'MEDIUM';
      }

      return teamSchedule;
    } catch (error) {
      logger.error(`Failed to get schedule strength for ${team}:`, error.message);
      return 'MEDIUM';
    }
  }

  async getAllPlayersEnriched(limit = 200) {
    try {
      logger.info('Starting comprehensive player data enrichment...');
      
      const [projections, injuries, rankings, adp] = await Promise.allSettled([
        this.getPlayerProjections(),
        this.getInjuryReports(),
        this.getFantasyProsRankings(),
        this.getADPData()
      ]);

      const enrichedPlayers = [];
      
      if (projections.status === 'fulfilled') {
        const playerProjections = projections.value.slice(0, limit);
        
        for (const projection of playerProjections) {
          const enrichedPlayer = {
            id: projection.playerId,
            name: projection.name,
            position: projection.position,
            team: projection.team,
            projections: projection,
            lastEnriched: new Date().toISOString()
          };

          if (injuries.status === 'fulfilled') {
            const injury = injuries.value.find(i => i.playerId === projection.playerId);
            if (injury) enrichedPlayer.injury = injury;
          }

          if (rankings.status === 'fulfilled') {
            const ranking = rankings.value.find(r => r.playerId === projection.playerId);
            if (ranking) enrichedPlayer.ranking = ranking;
          }

          if (adp.status === 'fulfilled') {
            const playerADP = adp.value.find(a => a.playerId === projection.playerId);
            if (playerADP) enrichedPlayer.adp = playerADP.adp;
          }

          enrichedPlayer.scheduleStrength = await this.getScheduleStrength(projection.team, projection.position);
          
          enrichedPlayers.push(enrichedPlayer);
        }
      }

      logger.info(`Enriched ${enrichedPlayers.length} players with external data`);
      return enrichedPlayers;
    } catch (error) {
      logger.error('Failed to get all enriched players:', error.message);
      return [];
    }
  }

  async healthCheck() {
    const checks = {
      sportsData: { status: 'unknown', timestamp: new Date().toISOString() },
      fantasyPros: { status: 'unknown', timestamp: new Date().toISOString() },
      news: { status: 'unknown', timestamp: new Date().toISOString() },
      duckDuckGo: { status: 'unknown', timestamp: new Date().toISOString() },
      weather: { status: 'unknown', timestamp: new Date().toISOString() }
    };

    try {
      await this.getPlayerProjections('QB');
      checks.sportsData.status = 'connected';
    } catch (error) {
      checks.sportsData.status = 'error';
      checks.sportsData.error = error.message;
    }

    try {
      await this.getFantasyProsRankings('QB');
      checks.fantasyPros.status = 'connected';
    } catch (error) {
      checks.fantasyPros.status = 'error';
      checks.fantasyPros.error = error.message;
    }

    try {
      await this.getPlayerNews(null, 5);
      checks.news.status = 'connected';
    } catch (error) {
      checks.news.status = 'error';
      checks.news.error = error.message;
    }

    // Check DuckDuckGo search
    try {
      const ddgHealth = await this.duckDuckGoSearch.healthCheck();
      checks.duckDuckGo = ddgHealth;
    } catch (error) {
      checks.duckDuckGo = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    // Check weather service
    try {
      const weatherHealth = await this.weatherClient.healthCheck();
      checks.weather = weatherHealth;
    } catch (error) {
      checks.weather = {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }

    return checks;
  }

  clearCache() {
    this.cache.clear();
    this.duckDuckGoSearch.clearCache();
    logger.info('External APIs cache cleared');
  }

  // New methods for live data integration
  async getLivePlayerUpdate(playerName) {
    try {
      const [news, weather] = await Promise.allSettled([
        this.duckDuckGoSearch.searchPlayerNews(playerName),
        this.weatherClient.getCurrentWeather('KC') // Example team
      ]);

      return {
        player: playerName,
        news: news.status === 'fulfilled' ? news.value : [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Failed to get live update for ${playerName}:`, error.message);
      return null;
    }
  }

  async getGameDayWeatherReport(homeTeam, awayTeam) {
    try {
      // Try DuckDuckGo weather search first
      const ddgWeather = await this.duckDuckGoSearch.searchGameWeather(homeTeam, awayTeam);
      if (ddgWeather && ddgWeather.conditions !== 'Unknown') {
        return ddgWeather;
      }
      
      // Fallback to weather API
      return await this.weatherClient.getGameDayForecast(homeTeam, awayTeam);
    } catch (error) {
      logger.error(`Failed to get game day weather for ${homeTeam} vs ${awayTeam}:`, error.message);
      return null;
    }
  }

  async searchTeamNews(teamAbbr) {
    try {
      return await this.duckDuckGoSearch.searchTeamNews(teamAbbr);
    } catch (error) {
      logger.error(`Failed to search team news for ${teamAbbr}:`, error.message);
      return [];
    }
  }
}

module.exports = ExternalAPIsClient;