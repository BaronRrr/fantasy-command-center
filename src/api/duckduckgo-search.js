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

class DuckDuckGoSearch {
  constructor() {
    // DuckDuckGo Instant Answer API - completely free!
    this.baseURL = 'https://api.duckduckgo.com';
    this.searchURL = 'https://html.duckduckgo.com/html';
    
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0 (https://github.com/fantasy-football)'
      }
    });

    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes for news
  }

  getCacheKey(query) {
    return `ddg-${query.toLowerCase().replace(/\s+/g, '-')}`;
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

  async searchPlayerNews(playerName, includeFantasy = true) {
    try {
      const queries = [
        `${playerName} NFL injury news today`,
        `${playerName} fantasy football news`,
        `${playerName} trade rumors`,
        `${playerName} practice report`,
        `${playerName} game status`
      ];

      const allResults = [];
      
      for (const query of queries) {
        const results = await this.performSearch(query);
        if (results && results.length > 0) {
          allResults.push(...results);
        }
        
        // Small delay to be respectful
        await this.delay(200);
      }

      return this.processPlayerNews(playerName, allResults);
    } catch (error) {
      logger.error(`Failed to search news for ${playerName}:`, error.message);
      return [];
    }
  }

  async performSearch(query) {
    try {
      const cacheKey = this.getCacheKey(query);
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      // Use DuckDuckGo instant answer API
      const response = await this.axiosInstance.get(this.baseURL, {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        }
      });

      let results = [];
      
      // Extract relevant results from DuckDuckGo response
      if (response.data) {
        // Abstract provides summary
        if (response.data.Abstract) {
          results.push({
            title: response.data.Heading || query,
            snippet: response.data.Abstract,
            url: response.data.AbstractURL,
            source: response.data.AbstractSource || 'DuckDuckGo',
            timestamp: new Date().toISOString()
          });
        }

        // Related topics
        if (response.data.RelatedTopics) {
          response.data.RelatedTopics.forEach(topic => {
            if (topic.Text && topic.FirstURL) {
              results.push({
                title: topic.Text.split(' - ')[0],
                snippet: topic.Text,
                url: topic.FirstURL,
                source: 'Wikipedia/Related',
                timestamp: new Date().toISOString()
              });
            }
          });
        }

        // Answer if available
        if (response.data.Answer) {
          results.push({
            title: `${query} - Quick Answer`,
            snippet: response.data.Answer,
            url: response.data.AnswerURL,
            source: 'DuckDuckGo Answer',
            timestamp: new Date().toISOString()
          });
        }
      }

      // If no instant answers, try news search
      if (results.length === 0) {
        results = await this.searchNews(query);
      }

      this.setCachedData(cacheKey, results);
      return results;
    } catch (error) {
      logger.error(`Search failed for query: ${query}`, error.message);
      return [];
    }
  }

  async searchNews(query) {
    try {
      // Alternative approach using news-specific search
      const newsQueries = [
        `site:espn.com ${query}`,
        `site:nfl.com ${query}`,
        `site:fantasypros.com ${query}`,
        `site:rotoworld.com ${query}`,
        `site:reddit.com/r/fantasyfootball ${query}`
      ];

      const results = [];
      
      for (const newsQuery of newsQueries.slice(0, 2)) { // Limit to prevent rate limiting
        try {
          const response = await this.axiosInstance.get(this.baseURL, {
            params: {
              q: newsQuery,
              format: 'json'
            }
          });

          if (response.data && response.data.RelatedTopics) {
            response.data.RelatedTopics.forEach(topic => {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0],
                  snippet: topic.Text,
                  url: topic.FirstURL,
                  source: this.extractSource(topic.FirstURL),
                  timestamp: new Date().toISOString()
                });
              }
            });
          }
        } catch (siteError) {
          logger.debug(`Site search failed for ${newsQuery}:`, siteError.message);
        }
        
        await this.delay(300);
      }

      return results;
    } catch (error) {
      logger.error('News search failed:', error.message);
      return [];
    }
  }

  processPlayerNews(playerName, rawResults) {
    const processedNews = [];
    const seen = new Set();

    for (const result of rawResults) {
      // Skip duplicates
      const key = `${result.title}-${result.snippet}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const newsItem = {
        player: playerName,
        title: result.title,
        summary: result.snippet,
        url: result.url,
        source: result.source,
        timestamp: result.timestamp,
        urgency: this.categorizeUrgency(result.snippet),
        impact: this.analyzeFantasyImpact(result.snippet),
        category: this.categorizeNews(result.snippet)
      };

      // Only include if it seems relevant to fantasy football
      if (this.isFantasyRelevant(result.snippet)) {
        processedNews.push(newsItem);
      }
    }

    return processedNews.slice(0, 10); // Limit to most relevant
  }

  categorizeUrgency(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('ruled out') || lowerText.includes('placed on ir') || 
        lowerText.includes('season ending') || lowerText.includes('suspended')) {
      return 'CRITICAL';
    }
    
    if (lowerText.includes('questionable') || lowerText.includes('doubtful') || 
        lowerText.includes('limited') || lowerText.includes('injury') ||
        lowerText.includes('trade') || lowerText.includes('released')) {
      return 'HIGH';
    }
    
    if (lowerText.includes('probable') || lowerText.includes('full practice') ||
        lowerText.includes('starting') || lowerText.includes('targets')) {
      return 'MEDIUM';
    }
    
    return 'INFO';
  }

  analyzeFantasyImpact(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('ruled out') || lowerText.includes('ir')) {
      return 'NEGATIVE_HIGH';
    }
    
    if (lowerText.includes('starting') || lowerText.includes('increased role') ||
        lowerText.includes('more targets') || lowerText.includes('healthy')) {
      return 'POSITIVE_HIGH';
    }
    
    if (lowerText.includes('limited') || lowerText.includes('questionable')) {
      return 'NEGATIVE_MEDIUM';
    }
    
    if (lowerText.includes('full practice') || lowerText.includes('probable')) {
      return 'POSITIVE_MEDIUM';
    }
    
    return 'NEUTRAL';
  }

  categorizeNews(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('injury') || lowerText.includes('hurt') || 
        lowerText.includes('pain') || lowerText.includes('surgery')) {
      return 'INJURY';
    }
    
    if (lowerText.includes('trade') || lowerText.includes('released') || 
        lowerText.includes('signed') || lowerText.includes('waived')) {
      return 'ROSTER_MOVE';
    }
    
    if (lowerText.includes('suspended') || lowerText.includes('arrested') || 
        lowerText.includes('violation')) {
      return 'DISCIPLINE';
    }
    
    if (lowerText.includes('practice') || lowerText.includes('report') || 
        lowerText.includes('status')) {
      return 'PRACTICE_REPORT';
    }
    
    if (lowerText.includes('performance') || lowerText.includes('stats') || 
        lowerText.includes('fantasy')) {
      return 'PERFORMANCE';
    }
    
    return 'GENERAL';
  }

  isFantasyRelevant(text) {
    const lowerText = text.toLowerCase();
    const fantasyKeywords = [
      'fantasy', 'start', 'sit', 'injury', 'trade', 'targets', 'touches',
      'quarterback', 'running back', 'wide receiver', 'tight end',
      'qb', 'rb', 'wr', 'te', 'nfl', 'football', 'game', 'week',
      'practice', 'status', 'ruled out', 'questionable', 'probable',
      'starting', 'backup', 'depth chart', 'snap count', 'carries'
    ];
    
    return fantasyKeywords.some(keyword => lowerText.includes(keyword));
  }

  extractSource(url) {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch (error) {
      return 'Unknown';
    }
  }

  async searchBreakingNews() {
    try {
      const breakingQueries = [
        'NFL injury report today',
        'NFL trade news today',
        'fantasy football news today',
        'NFL practice report',
        'NFL game status updates'
      ];

      const allNews = [];
      
      for (const query of breakingQueries) {
        const results = await this.performSearch(query);
        allNews.push(...results);
        await this.delay(400);
      }

      return this.processBreakingNews(allNews);
    } catch (error) {
      logger.error('Failed to search breaking news:', error.message);
      return [];
    }
  }

  processBreakingNews(rawNews) {
    const recentNews = rawNews.filter(news => {
      // Try to filter for recent news (last 24 hours)
      const timeSensitiveWords = ['today', 'breaking', 'just in', 'update', 'latest'];
      return timeSensitiveWords.some(word => 
        news.title.toLowerCase().includes(word) || 
        news.snippet.toLowerCase().includes(word)
      );
    });

    return recentNews.slice(0, 15);
  }

  async searchTeamNews(teamAbbr) {
    try {
      const teamQueries = [
        `${teamAbbr} NFL injury report`,
        `${teamAbbr} NFL depth chart changes`,
        `${teamAbbr} NFL practice report`
      ];

      const allResults = [];
      
      for (const query of teamQueries) {
        const results = await this.performSearch(query);
        allResults.push(...results);
        await this.delay(300);
      }

      return allResults.slice(0, 10);
    } catch (error) {
      logger.error(`Failed to search team news for ${teamAbbr}:`, error.message);
      return [];
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck() {
    try {
      const testResult = await this.performSearch('NFL news');
      return {
        status: testResult.length > 0 ? 'connected' : 'limited',
        timestamp: new Date().toISOString(),
        resultCount: testResult.length
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async searchGameWeather(homeTeam, awayTeam, week = null) {
    try {
      const teamNames = this.getTeamFullNames();
      const homeTeamName = teamNames[homeTeam] || homeTeam;
      const awayTeamName = teamNames[awayTeam] || awayTeam;
      
      const weatherQueries = [
        `${homeTeamName} vs ${awayTeamName} weather forecast today`,
        `${homeTeamName} stadium weather conditions`,
        `NFL ${homeTeamName} game weather today`,
        `${homeTeamName} weather forecast this week`
      ];

      const allResults = [];
      
      for (const query of weatherQueries) {
        const results = await this.performSearch(query);
        if (results && results.length > 0) {
          allResults.push(...results);
        }
        await this.delay(300);
      }

      return this.processWeatherResults(homeTeam, awayTeam, allResults);
    } catch (error) {
      logger.error(`Failed to search weather for ${homeTeam} vs ${awayTeam}:`, error.message);
      return null;
    }
  }

  async searchStadiumWeather(teamAbbr) {
    try {
      const teamNames = this.getTeamFullNames();
      const teamName = teamNames[teamAbbr] || teamAbbr;
      const stadiumInfo = this.getStadiumInfo();
      const stadium = stadiumInfo[teamAbbr];
      
      const weatherQueries = [
        `${teamName} stadium weather today`,
        `${stadium?.city || teamName} weather forecast`,
        `${teamName} game day weather conditions`,
        `weather ${stadium?.city || teamName} ${stadium?.state || ''}`
      ];

      const allResults = [];
      
      for (const query of weatherQueries) {
        const results = await this.performSearch(query);
        if (results && results.length > 0) {
          allResults.push(...results);
        }
        await this.delay(250);
      }

      return this.processStadiumWeather(teamAbbr, allResults);
    } catch (error) {
      logger.error(`Failed to search stadium weather for ${teamAbbr}:`, error.message);
      return null;
    }
  }

  async searchWeeklyWeatherReport() {
    try {
      const weatherQueries = [
        'NFL weather report this week',
        'NFL games weather conditions today',
        'football weather forecast this weekend',
        'NFL stadium weather updates'
      ];

      const allResults = [];
      
      for (const query of weatherQueries) {
        const results = await this.performSearch(query);
        if (results && results.length > 0) {
          allResults.push(...results);
        }
        await this.delay(400);
      }

      return this.processWeeklyWeatherResults(allResults);
    } catch (error) {
      logger.error('Failed to search weekly weather report:', error.message);
      return [];
    }
  }

  processWeatherResults(homeTeam, awayTeam, rawResults) {
    const weatherInfo = {
      homeTeam,
      awayTeam,
      conditions: 'Unknown',
      temperature: null,
      windSpeed: null,
      precipitation: null,
      impact: 'Weather information not available',
      severity: 'UNKNOWN',
      fantasyAdvice: 'Monitor weather updates closer to game time',
      sources: [],
      timestamp: new Date().toISOString()
    };

    for (const result of rawResults) {
      const text = (result.title + ' ' + result.snippet).toLowerCase();
      
      // Extract weather conditions
      if (text.includes('rain') || text.includes('storm')) {
        weatherInfo.conditions = 'Rainy';
        weatherInfo.precipitation = 'Moderate';
        weatherInfo.severity = 'MODERATE';
        weatherInfo.impact = 'Rain may affect passing game and field conditions';
        weatherInfo.fantasyAdvice = 'Target RBs and short-passing games, avoid kickers';
      }
      
      if (text.includes('snow') || text.includes('blizzard')) {
        weatherInfo.conditions = 'Snow';
        weatherInfo.severity = 'SEVERE';
        weatherInfo.impact = 'Snow significantly favors running game';
        weatherInfo.fantasyAdvice = 'Heavily favor RBs, avoid WRs and kickers';
      }
      
      if (text.includes('wind') || text.includes('gusty')) {
        weatherInfo.windSpeed = 'High';
        weatherInfo.severity = weatherInfo.severity === 'UNKNOWN' ? 'MODERATE' : weatherInfo.severity;
        weatherInfo.impact = 'High winds affect passing and kicking game';
        weatherInfo.fantasyAdvice = 'Target RBs and TEs, avoid deep-threat WRs';
      }
      
      if (text.includes('cold') || text.includes('freezing')) {
        weatherInfo.temperature = 'Cold';
        weatherInfo.impact = 'Cold weather may reduce offensive efficiency';
        weatherInfo.fantasyAdvice = 'Cold affects ball handling, favor indoor alternatives';
      }
      
      if (text.includes('hot') || text.includes('heat')) {
        weatherInfo.temperature = 'Hot';
        weatherInfo.impact = 'Hot weather may cause fatigue';
        weatherInfo.fantasyAdvice = 'Monitor snap counts, expect more rotation';
      }
      
      if (text.includes('clear') || text.includes('sunny') || text.includes('fair')) {
        if (weatherInfo.conditions === 'Unknown') {
          weatherInfo.conditions = 'Clear';
          weatherInfo.severity = 'MINIMAL';
          weatherInfo.impact = 'Ideal weather conditions for football';
          weatherInfo.fantasyAdvice = 'No weather adjustments needed';
        }
      }
      
      // Add source information
      if (result.source && result.url) {
        weatherInfo.sources.push({
          source: result.source,
          url: result.url,
          title: result.title
        });
      }
    }

    return weatherInfo;
  }

  processStadiumWeather(teamAbbr, rawResults) {
    const stadiumInfo = this.getStadiumInfo();
    const stadium = stadiumInfo[teamAbbr];
    
    const weather = {
      team: teamAbbr,
      location: stadium ? `${stadium.city}, ${stadium.state}` : 'Unknown',
      conditions: 'Unknown',
      temperature: null,
      humidity: null,
      windSpeed: null,
      isDome: stadium?.dome || false,
      timestamp: new Date().toISOString(),
      sources: []
    };

    // If it's a dome, return indoor conditions
    if (stadium?.dome) {
      weather.conditions = 'Indoor Stadium';
      weather.temperature = 72;
      weather.humidity = 50;
      weather.windSpeed = 0;
      weather.impact = 'No weather impact (indoor)';
      return weather;
    }

    // Process search results for outdoor stadiums
    for (const result of rawResults) {
      const text = (result.title + ' ' + result.snippet).toLowerCase();
      
      // Extract temperature info
      const tempMatch = text.match(/(\d+)°?(?:f|fahrenheit)/i);
      if (tempMatch) {
        weather.temperature = parseInt(tempMatch[1]);
      }
      
      // Extract conditions
      if (text.includes('rain')) weather.conditions = 'Rainy';
      if (text.includes('snow')) weather.conditions = 'Snow';
      if (text.includes('cloud')) weather.conditions = 'Cloudy';
      if (text.includes('clear') || text.includes('sunny')) weather.conditions = 'Clear';
      
      weather.sources.push({
        source: result.source,
        title: result.title,
        snippet: result.snippet
      });
    }

    return weather;
  }

  processWeeklyWeatherResults(rawResults) {
    const weeklyReport = [];
    
    for (const result of rawResults) {
      const text = (result.title + ' ' + result.snippet).toLowerCase();
      
      // Look for team mentions and weather conditions
      const teams = this.extractTeamsFromText(text);
      
      if (teams.length > 0) {
        teams.forEach(team => {
          const weatherItem = {
            team: team,
            title: result.title,
            summary: result.snippet,
            conditions: this.extractConditionsFromText(text),
            impact: this.assessWeatherImpact(text),
            source: result.source,
            url: result.url,
            timestamp: new Date().toISOString()
          };
          
          weeklyReport.push(weatherItem);
        });
      }
    }

    return weeklyReport.slice(0, 10); // Limit results
  }

  extractTeamsFromText(text) {
    const teamNames = this.getTeamFullNames();
    const foundTeams = [];
    
    Object.entries(teamNames).forEach(([abbr, fullName]) => {
      if (text.includes(fullName.toLowerCase()) || text.includes(abbr.toLowerCase())) {
        foundTeams.push(abbr);
      }
    });
    
    return foundTeams;
  }

  extractConditionsFromText(text) {
    if (text.includes('rain') || text.includes('storm')) return 'Rainy';
    if (text.includes('snow') || text.includes('blizzard')) return 'Snow';
    if (text.includes('wind') || text.includes('gusty')) return 'Windy';
    if (text.includes('cold') || text.includes('freezing')) return 'Cold';
    if (text.includes('hot') || text.includes('heat')) return 'Hot';
    if (text.includes('clear') || text.includes('sunny')) return 'Clear';
    return 'Unknown';
  }

  assessWeatherImpact(text) {
    if (text.includes('rain') || text.includes('snow')) {
      return 'Favors running game, affects passing and kicking';
    }
    if (text.includes('wind')) {
      return 'Affects passing game and field goals';
    }
    if (text.includes('cold')) {
      return 'May reduce offensive efficiency';
    }
    if (text.includes('hot')) {
      return 'May cause fatigue, expect more rotation';
    }
    return 'Minimal weather impact expected';
  }

  getTeamFullNames() {
    return {
      'ARI': 'Arizona Cardinals',
      'ATL': 'Atlanta Falcons', 
      'BAL': 'Baltimore Ravens',
      'BUF': 'Buffalo Bills',
      'CAR': 'Carolina Panthers',
      'CHI': 'Chicago Bears',
      'CIN': 'Cincinnati Bengals',
      'CLE': 'Cleveland Browns',
      'DAL': 'Dallas Cowboys',
      'DEN': 'Denver Broncos',
      'DET': 'Detroit Lions',
      'GB': 'Green Bay Packers',
      'HOU': 'Houston Texans',
      'IND': 'Indianapolis Colts',
      'JAX': 'Jacksonville Jaguars',
      'KC': 'Kansas City Chiefs',
      'LV': 'Las Vegas Raiders',
      'LAC': 'Los Angeles Chargers',
      'LAR': 'Los Angeles Rams',
      'MIA': 'Miami Dolphins',
      'MIN': 'Minnesota Vikings',
      'NE': 'New England Patriots',
      'NO': 'New Orleans Saints',
      'NYG': 'New York Giants',
      'NYJ': 'New York Jets',
      'PHI': 'Philadelphia Eagles',
      'PIT': 'Pittsburgh Steelers',
      'SF': 'San Francisco 49ers',
      'SEA': 'Seattle Seahawks',
      'TB': 'Tampa Bay Buccaneers',
      'TEN': 'Tennessee Titans',
      'WSH': 'Washington Commanders'
    };
  }

  getStadiumInfo() {
    return {
      'ARI': { city: 'Glendale', state: 'AZ', dome: true },
      'ATL': { city: 'Atlanta', state: 'GA', dome: true },
      'BAL': { city: 'Baltimore', state: 'MD', dome: false },
      'BUF': { city: 'Orchard Park', state: 'NY', dome: false },
      'CAR': { city: 'Charlotte', state: 'NC', dome: false },
      'CHI': { city: 'Chicago', state: 'IL', dome: false },
      'CIN': { city: 'Cincinnati', state: 'OH', dome: false },
      'CLE': { city: 'Cleveland', state: 'OH', dome: false },
      'DAL': { city: 'Arlington', state: 'TX', dome: true },
      'DEN': { city: 'Denver', state: 'CO', dome: false },
      'DET': { city: 'Detroit', state: 'MI', dome: true },
      'GB': { city: 'Green Bay', state: 'WI', dome: false },
      'HOU': { city: 'Houston', state: 'TX', dome: true },
      'IND': { city: 'Indianapolis', state: 'IN', dome: true },
      'JAX': { city: 'Jacksonville', state: 'FL', dome: false },
      'KC': { city: 'Kansas City', state: 'MO', dome: false },
      'LV': { city: 'Las Vegas', state: 'NV', dome: true },
      'LAC': { city: 'Inglewood', state: 'CA', dome: true },
      'LAR': { city: 'Inglewood', state: 'CA', dome: true },
      'MIA': { city: 'Miami Gardens', state: 'FL', dome: false },
      'MIN': { city: 'Minneapolis', state: 'MN', dome: true },
      'NE': { city: 'Foxborough', state: 'MA', dome: false },
      'NO': { city: 'New Orleans', state: 'LA', dome: true },
      'NYG': { city: 'East Rutherford', state: 'NJ', dome: false },
      'NYJ': { city: 'East Rutherford', state: 'NJ', dome: false },
      'PHI': { city: 'Philadelphia', state: 'PA', dome: false },
      'PIT': { city: 'Pittsburgh', state: 'PA', dome: false },
      'SF': { city: 'Santa Clara', state: 'CA', dome: false },
      'SEA': { city: 'Seattle', state: 'WA', dome: false },
      'TB': { city: 'Tampa', state: 'FL', dome: false },
      'TEN': { city: 'Nashville', state: 'TN', dome: false },
      'WSH': { city: 'Landover', state: 'MD', dome: false }
    };
  }

  clearCache() {
    this.cache.clear();
    logger.info('DuckDuckGo search cache cleared');
  }
}

module.exports = DuckDuckGoSearch;