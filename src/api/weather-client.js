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

class WeatherClient {
  constructor() {
    // Using OpenWeatherMap free tier (60 calls/minute, 1M calls/month)
    this.apiKey = process.env.OPENWEATHER_API_KEY || 'demo_key';
    this.baseURL = 'https://api.openweathermap.org/data/2.5';
    
    this.axiosInstance = axios.create({
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    // NFL stadium locations for weather tracking
    this.stadiumLocations = {
      'ARI': { city: 'Glendale', state: 'AZ', lat: 33.5276, lon: -112.2626, dome: true },
      'ATL': { city: 'Atlanta', state: 'GA', lat: 33.7554, lon: -84.4008, dome: true },
      'BAL': { city: 'Baltimore', state: 'MD', lat: 39.2780, lon: -76.6227, dome: false },
      'BUF': { city: 'Orchard Park', state: 'NY', lat: 42.7738, lon: -78.7868, dome: false },
      'CAR': { city: 'Charlotte', state: 'NC', lat: 35.2258, lon: -80.8528, dome: false },
      'CHI': { city: 'Chicago', state: 'IL', lat: 41.8623, lon: -87.6167, dome: false },
      'CIN': { city: 'Cincinnati', state: 'OH', lat: 39.0955, lon: -84.5161, dome: false },
      'CLE': { city: 'Cleveland', state: 'OH', lat: 41.5061, lon: -81.6995, dome: false },
      'DAL': { city: 'Arlington', state: 'TX', lat: 32.7473, lon: -97.0945, dome: true },
      'DEN': { city: 'Denver', state: 'CO', lat: 39.7439, lon: -105.0201, dome: false },
      'DET': { city: 'Detroit', state: 'MI', lat: 42.3400, lon: -83.0456, dome: true },
      'GB': { city: 'Green Bay', state: 'WI', lat: 44.5013, lon: -88.0622, dome: false },
      'HOU': { city: 'Houston', state: 'TX', lat: 29.6847, lon: -95.4107, dome: true },
      'IND': { city: 'Indianapolis', state: 'IN', lat: 39.7601, lon: -86.1639, dome: true },
      'JAX': { city: 'Jacksonville', state: 'FL', lat: 30.3240, lon: -81.6373, dome: false },
      'KC': { city: 'Kansas City', state: 'MO', lat: 39.0489, lon: -94.4839, dome: false },
      'LV': { city: 'Las Vegas', state: 'NV', lat: 36.0909, lon: -115.1833, dome: true },
      'LAC': { city: 'Inglewood', state: 'CA', lat: 33.9535, lon: -118.3390, dome: true },
      'LAR': { city: 'Inglewood', state: 'CA', lat: 33.9535, lon: -118.3390, dome: true },
      'MIA': { city: 'Miami Gardens', state: 'FL', lat: 25.9580, lon: -80.2389, dome: false },
      'MIN': { city: 'Minneapolis', state: 'MN', lat: 44.9738, lon: -93.2581, dome: true },
      'NE': { city: 'Foxborough', state: 'MA', lat: 42.0909, lon: -71.2643, dome: false },
      'NO': { city: 'New Orleans', state: 'LA', lat: 29.9511, lon: -90.0812, dome: true },
      'NYG': { city: 'East Rutherford', state: 'NJ', lat: 40.8135, lon: -74.0745, dome: false },
      'NYJ': { city: 'East Rutherford', state: 'NJ', lat: 40.8135, lon: -74.0745, dome: false },
      'PHI': { city: 'Philadelphia', state: 'PA', lat: 39.9008, lon: -75.1675, dome: false },
      'PIT': { city: 'Pittsburgh', state: 'PA', lat: 40.4468, lon: -80.0158, dome: false },
      'SF': { city: 'Santa Clara', state: 'CA', lat: 37.4032, lon: -121.9697, dome: false },
      'SEA': { city: 'Seattle', state: 'WA', lat: 47.5952, lon: -122.3316, dome: false },
      'TB': { city: 'Tampa', state: 'FL', lat: 27.9759, lon: -82.5033, dome: false },
      'TEN': { city: 'Nashville', state: 'TN', lat: 36.1665, lon: -86.7713, dome: false },
      'WSH': { city: 'Landover', state: 'MD', lat: 38.9076, lon: -76.8645, dome: false }
    };

    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
  }

  getCacheKey(lat, lon, type = 'current') {
    return `weather-${lat}-${lon}-${type}`;
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

  async getCurrentWeather(teamAbbr) {
    try {
      const location = this.stadiumLocations[teamAbbr];
      if (!location) {
        throw new Error(`Unknown team abbreviation: ${teamAbbr}`);
      }

      const cacheKey = this.getCacheKey(location.lat, location.lon, 'current');
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const url = `${this.baseURL}/weather?lat=${location.lat}&lon=${location.lon}&appid=${this.apiKey}&units=imperial`;
      logger.debug(`Making weather request to: ${url}`);
      
      const response = await this.axiosInstance.get(`${this.baseURL}/weather`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: this.apiKey,
          units: 'imperial'
        }
      });

      const weatherData = this.processWeatherData(response.data, location, teamAbbr);
      this.setCachedData(cacheKey, weatherData);
      
      return weatherData;
    } catch (error) {
      logger.error(`Failed to get weather for ${teamAbbr}:`, error.message);
      if (error.response) {
        logger.error(`API Error Status: ${error.response.status}`);
        logger.error(`API Error Data:`, error.response.data);
      }
      return this.getMockWeatherData(teamAbbr);
    }
  }

  async getGameDayForecast(homeTeam, awayTeam, gameTime = null) {
    try {
      const location = this.stadiumLocations[homeTeam];
      if (!location) {
        throw new Error(`Unknown home team: ${homeTeam}`);
      }

      // If dome/indoor stadium, return no weather impact
      if (location.dome) {
        return {
          homeTeam,
          awayTeam,
          location: location.city,
          conditions: 'Indoor Stadium',
          temperature: 72,
          humidity: 50,
          windSpeed: 0,
          precipitation: 0,
          impact: 'No weather impact (indoor)',
          severity: 'NONE',
          fantasyAdvice: 'Weather not a factor'
        };
      }

      const cacheKey = this.getCacheKey(location.lat, location.lon, 'forecast');
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return { ...cached, homeTeam, awayTeam };
      }

      // Use 5-day/3-hour forecast (available on free plan)
      const response = await this.axiosInstance.get(`${this.baseURL}/forecast`, {
        params: {
          lat: location.lat,
          lon: location.lon,
          appid: this.apiKey,
          units: 'imperial',
          cnt: 8 // Next 24 hours (3-hour intervals)
        }
      });

      const forecast = this.processGameDayForecast(response.data, location, homeTeam, awayTeam);
      this.setCachedData(cacheKey, forecast);
      
      return forecast;
    } catch (error) {
      logger.error(`Failed to get game forecast for ${homeTeam} vs ${awayTeam}:`, error.message);
      return this.getMockGameForecast(homeTeam, awayTeam);
    }
  }

  processWeatherData(data, location, teamAbbr) {
    const weather = data.weather[0];
    const main = data.main;
    const wind = data.wind || {};

    return {
      team: teamAbbr,
      location: `${location.city}, ${location.state}`,
      conditions: weather.description,
      temperature: Math.round(main.temp),
      feelsLike: Math.round(main.feels_like),
      humidity: main.humidity,
      pressure: main.pressure,
      windSpeed: Math.round(wind.speed || 0),
      windDirection: wind.deg,
      cloudiness: data.clouds?.all || 0,
      visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
      isDome: location.dome,
      timestamp: new Date().toISOString()
    };
  }

  processGameDayForecast(data, location, homeTeam, awayTeam) {
    // Use the forecast closest to typical game time (1 PM ET Sunday)
    const forecast = data.list[0]; // Most recent forecast
    const weather = forecast.weather[0];
    const main = forecast.main;
    const wind = forecast.wind || {};
    const rain = forecast.rain || {};
    const snow = forecast.snow || {};

    const conditions = weather.main;
    const temperature = Math.round(main.temp);
    const windSpeed = Math.round(wind.speed || 0);
    const precipitation = (rain['3h'] || 0) + (snow['3h'] || 0);

    return {
      homeTeam,
      awayTeam,
      location: `${location.city}, ${location.state}`,
      conditions: weather.description,
      temperature,
      feelsLike: Math.round(main.feels_like),
      humidity: main.humidity,
      windSpeed,
      windDirection: wind.deg,
      precipitation,
      cloudiness: forecast.clouds?.all || 0,
      impact: this.analyzeWeatherImpact(conditions, temperature, windSpeed, precipitation),
      severity: this.categorizeWeatherSeverity(conditions, temperature, windSpeed, precipitation),
      fantasyAdvice: this.generateFantasyAdvice(conditions, temperature, windSpeed, precipitation),
      timestamp: new Date().toISOString()
    };
  }

  analyzeWeatherImpact(conditions, temperature, windSpeed, precipitation) {
    const impacts = [];

    // Temperature impacts
    if (temperature < 20) {
      impacts.push('Extremely cold affects ball handling and kicking');
    } else if (temperature < 32) {
      impacts.push('Freezing temperatures may reduce offensive efficiency');
    } else if (temperature > 95) {
      impacts.push('Extreme heat may cause fatigue and cramping');
    }

    // Wind impacts
    if (windSpeed > 20) {
      impacts.push('Strong winds significantly affect passing and kicking');
    } else if (windSpeed > 15) {
      impacts.push('Moderate winds may impact deep passes and field goals');
    }

    // Precipitation impacts
    if (precipitation > 0.2) {
      impacts.push('Heavy precipitation favors running game over passing');
    } else if (precipitation > 0.1) {
      impacts.push('Light precipitation may cause some ball handling issues');
    }

    // Specific weather conditions
    if (conditions.toLowerCase().includes('snow')) {
      impacts.push('Snow conditions heavily favor ground game');
    }
    if (conditions.toLowerCase().includes('fog')) {
      impacts.push('Poor visibility affects deep passing game');
    }

    return impacts.length > 0 ? impacts.join('. ') : 'Minimal weather impact expected';
  }

  categorizeWeatherSeverity(conditions, temperature, windSpeed, precipitation) {
    // Severe conditions
    if (temperature < 10 || temperature > 100 || windSpeed > 25 || precipitation > 0.3) {
      return 'SEVERE';
    }

    // Moderate conditions
    if (temperature < 25 || temperature > 90 || windSpeed > 15 || precipitation > 0.1) {
      return 'MODERATE';
    }

    // Mild conditions
    if (temperature < 35 || temperature > 85 || windSpeed > 10 || precipitation > 0.05) {
      return 'MILD';
    }

    return 'MINIMAL';
  }

  generateFantasyAdvice(conditions, temperature, windSpeed, precipitation) {
    const advice = [];

    // Temperature advice
    if (temperature < 25) {
      advice.push('Consider benching QBs and WRs for indoor alternatives');
    } else if (temperature > 90) {
      advice.push('Monitor snap counts - hot weather may lead to more rotation');
    }

    // Wind advice
    if (windSpeed > 20) {
      advice.push('Avoid QBs and WRs - target RBs and TEs for short passes');
    } else if (windSpeed > 15) {
      advice.push('Deep passing may be affected - favor possession receivers');
    }

    // Precipitation advice
    if (precipitation > 0.2) {
      advice.push('Strong RB game script - avoid WRs and consider benching kickers');
    }

    // Game script implications
    if (conditions.toLowerCase().includes('snow') || (windSpeed > 20 && precipitation > 0.1)) {
      advice.push('Expect low-scoring game - target defensive players and unders');
    }

    return advice.length > 0 ? advice.join('. ') : 'No significant fantasy adjustments needed';
  }

  async getWeeklyWeatherReport(week) {
    try {
      const weatherReports = [];
      
      // Get weather for all outdoor stadiums
      const outdoorTeams = Object.entries(this.stadiumLocations)
        .filter(([team, location]) => !location.dome)
        .map(([team]) => team);

      for (const team of outdoorTeams) {
        try {
          const weather = await this.getCurrentWeather(team);
          weatherReports.push(weather);
          
          // Small delay to respect rate limits
          await this.delay(100);
        } catch (error) {
          logger.debug(`Failed to get weather for ${team}:`, error.message);
        }
      }

      return this.processWeeklyReport(weatherReports, week);
    } catch (error) {
      logger.error('Failed to generate weekly weather report:', error.message);
      return [];
    }
  }

  processWeeklyReport(weatherReports, week) {
    const concerningWeather = weatherReports.filter(weather => {
      return weather.temperature < 35 || weather.temperature > 85 || 
             weather.windSpeed > 12 || weather.conditions.includes('rain') ||
             weather.conditions.includes('snow');
    });

    return concerningWeather.map(weather => ({
      week: week,
      team: weather.team,
      location: weather.location,
      conditions: weather.conditions,
      temperature: weather.temperature,
      impact: this.analyzeWeatherImpact(
        weather.conditions, 
        weather.temperature, 
        weather.windSpeed, 
        0
      ),
      recommendation: this.generateFantasyAdvice(
        weather.conditions,
        weather.temperature,
        weather.windSpeed,
        0
      )
    }));
  }

  getMockWeatherData(teamAbbr) {
    const location = this.stadiumLocations[teamAbbr];
    return {
      team: teamAbbr,
      location: location ? `${location.city}, ${location.state}` : 'Unknown',
      conditions: 'Clear',
      temperature: 72,
      humidity: 50,
      windSpeed: 5,
      impact: 'Minimal weather impact',
      severity: 'MINIMAL',
      isDome: location?.dome || false,
      timestamp: new Date().toISOString(),
      note: 'Mock data - API key needed for live weather'
    };
  }

  getMockGameForecast(homeTeam, awayTeam) {
    return {
      homeTeam,
      awayTeam,
      location: 'Stadium Location',
      conditions: 'Partly Cloudy',
      temperature: 68,
      windSpeed: 8,
      precipitation: 0,
      impact: 'Ideal conditions for fantasy football',
      severity: 'MINIMAL',
      fantasyAdvice: 'No weather adjustments needed',
      timestamp: new Date().toISOString(),
      note: 'Mock data - API key needed for live weather'
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async healthCheck() {
    try {
      if (this.apiKey === 'demo_key' || !this.apiKey) {
        return {
          status: 'mock',
          message: 'Using mock data - add OPENWEATHER_API_KEY for live weather',
          timestamp: new Date().toISOString()
        };
      }

      const testWeather = await this.getCurrentWeather('KC');
      return {
        status: testWeather.note ? 'mock' : 'connected',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = WeatherClient;