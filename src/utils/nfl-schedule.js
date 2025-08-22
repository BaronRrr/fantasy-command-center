/**
 * NFL Schedule Intelligence - Only Monitor Game Days
 * Checks actual NFL schedule to avoid unnecessary API calls
 */

const axios = require('axios');
const createLogger = require('./logger');

const logger = createLogger();

class NFLSchedule {
  constructor() {
    this.scheduleCache = new Map();
    this.lastScheduleUpdate = null;
    this.scheduleCacheDuration = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Check if today has any NFL games scheduled
   */
  async hasGamesToday() {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      return await this.hasGamesOnDate(today);
    } catch (error) {
      logger.warn('Failed to check games for today, defaulting to monitor:', error.message);
      return true; // Default to monitoring if check fails
    }
  }

  /**
   * Check if specific date has games
   */
  async hasGamesOnDate(dateString) {
    // Check cache first
    if (this.scheduleCache.has(dateString)) {
      return this.scheduleCache.get(dateString);
    }

    // Update schedule if cache is stale
    if (this.shouldUpdateSchedule()) {
      await this.updateScheduleCache();
    }

    return this.scheduleCache.get(dateString) || false;
  }

  /**
   * Get upcoming game days (next 7 days)
   */
  async getUpcomingGameDays() {
    const gameDays = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + i);
      const dateString = checkDate.toISOString().split('T')[0];
      
      if (await this.hasGamesOnDate(dateString)) {
        gameDays.push({
          date: dateString,
          dayOfWeek: checkDate.toLocaleDateString('en-US', { weekday: 'long' }),
          gameCount: await this.getGameCountForDate(dateString)
        });
      }
    }
    
    return gameDays;
  }

  /**
   * Update schedule cache from ESPN API
   */
  async updateScheduleCache() {
    try {
      logger.info('🗓️ Updating NFL schedule cache...');
      
      // Get current week's games
      const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });

      const games = response.data.events || [];
      const gameDates = new Set();

      // Process all games and extract dates
      games.forEach(game => {
        try {
          const gameDate = new Date(game.date).toISOString().split('T')[0];
          gameDates.add(gameDate);
          
          // Count games per date
          const currentCount = this.scheduleCache.get(gameDate) || 0;
          this.scheduleCache.set(gameDate, currentCount + 1);
        } catch (error) {
          logger.debug('Error processing game date:', error.message);
        }
      });

      // Also get next few weeks
      await this.getExtendedSchedule();
      
      this.lastScheduleUpdate = Date.now();
      logger.info(`✅ Schedule updated: ${gameDates.size} game days found`);
      
    } catch (error) {
      logger.error('Failed to update schedule cache:', error.message);
    }
  }

  /**
   * Get extended schedule for next few weeks
   */
  async getExtendedSchedule() {
    try {
      // Get schedule for current season
      const currentYear = new Date().getFullYear();
      const seasonResponse = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${currentYear}`, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });

      // Process season schedule if available
      if (seasonResponse.data?.events) {
        seasonResponse.data.events.forEach(game => {
          try {
            const gameDate = new Date(game.date).toISOString().split('T')[0];
            const currentCount = this.scheduleCache.get(gameDate) || 0;
            this.scheduleCache.set(gameDate, currentCount + 1);
          } catch (error) {
            logger.debug('Error processing season game:', error.message);
          }
        });
      }
    } catch (error) {
      logger.debug('Extended schedule fetch failed:', error.message);
    }
  }

  /**
   * Get game count for specific date
   */
  async getGameCountForDate(dateString) {
    if (this.scheduleCache.has(dateString)) {
      return this.scheduleCache.get(dateString);
    }
    return 0;
  }

  /**
   * Check if schedule cache needs updating
   */
  shouldUpdateSchedule() {
    if (!this.lastScheduleUpdate) return true;
    return (Date.now() - this.lastScheduleUpdate) > this.scheduleCacheDuration;
  }

  /**
   * Smart monitoring decision
   */
  async shouldMonitorNow() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Always monitor during prime game hours
    if (currentHour >= 12 && currentHour <= 23) {
      const hasGames = await this.hasGamesToday();
      if (hasGames) {
        return {
          monitor: true,
          reason: 'Games scheduled today during prime hours',
          frequency: 'high' // Every 15 seconds
        };
      }
    }

    // Check if games tomorrow (for late night/early morning prep)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];
    const hasGamesTomorrow = await this.hasGamesOnDate(tomorrowString);
    
    if (hasGamesTomorrow && currentHour >= 22) {
      return {
        monitor: true,
        reason: 'Games tomorrow, late prep monitoring',
        frequency: 'low' // Every 5 minutes
      };
    }

    return {
      monitor: false,
      reason: 'No games today or tomorrow',
      frequency: 'off'
    };
  }

  /**
   * Get monitoring status summary
   */
  async getMonitoringStatus() {
    const decision = await this.shouldMonitorNow();
    const upcomingGames = await this.getUpcomingGameDays();
    
    return {
      ...decision,
      upcomingGameDays: upcomingGames,
      cacheLastUpdated: this.lastScheduleUpdate ? new Date(this.lastScheduleUpdate).toISOString() : null,
      cacheSize: this.scheduleCache.size
    };
  }

  /**
   * Get today's game schedule for Discord alert
   */
  async getTodaysGameSchedule() {
    try {
      const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });

      const games = response.data.events || [];
      const today = new Date().toISOString().split('T')[0];
      const todaysGames = [];

      games.forEach(game => {
        try {
          const gameDate = new Date(game.date).toISOString().split('T')[0];
          
          if (gameDate === today) {
            const homeTeam = game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation || 'HOME';
            const awayTeam = game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation || 'AWAY';
            const gameTime = new Date(game.date).toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              timeZoneName: 'short'
            });
            const status = game.status?.type?.name || 'Scheduled';
            const homeScore = game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.score || '0';
            const awayScore = game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.score || '0';
            
            todaysGames.push({
              id: game.id,
              matchup: `${awayTeam} @ ${homeTeam}`,
              time: gameTime,
              status,
              score: status.includes('PROGRESS') || status.includes('FINAL') ? `${awayTeam} ${awayScore} - ${homeTeam} ${homeScore}` : null,
              isLive: ['STATUS_IN_PROGRESS', 'STATUS_HALFTIME'].includes(game.status?.type?.id)
            });
          }
        } catch (error) {
          logger.debug('Error processing game for schedule:', error.message);
        }
      });

      return {
        date: today,
        gameCount: todaysGames.length,
        games: todaysGames.sort((a, b) => new Date(`1970-01-01 ${a.time}`) - new Date(`1970-01-01 ${b.time}`))
      };
    } catch (error) {
      logger.error('Failed to get today\'s game schedule:', error.message);
      return { date: new Date().toISOString().split('T')[0], gameCount: 0, games: [] };
    }
  }

  /**
   * Create Discord embed for today's games
   */
  async createTodaysGamesEmbed() {
    const schedule = await this.getTodaysGameSchedule();
    
    if (schedule.gameCount === 0) {
      return {
        title: '📅 Today\'s NFL Games',
        description: 'No NFL games scheduled for today',
        color: 0x808080,
        timestamp: new Date().toISOString(),
        footer: { text: 'NFL Schedule • No Games Today' }
      };
    }

    const liveGames = schedule.games.filter(game => game.isLive);
    const upcomingGames = schedule.games.filter(game => !game.isLive && !game.status.includes('FINAL'));
    const completedGames = schedule.games.filter(game => game.status.includes('FINAL'));

    const embed = {
      title: `🏈 Today's NFL Games (${schedule.gameCount})`,
      description: `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`,
      color: liveGames.length > 0 ? 0x00FF00 : 0x0099FF,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: `NFL Schedule • ${schedule.gameCount} Games Today` }
    };

    if (liveGames.length > 0) {
      embed.fields.push({
        name: '🔴 LIVE GAMES',
        value: liveGames.map(game => 
          `**${game.matchup}**\n${game.score || 'In Progress'}`
        ).join('\n\n'),
        inline: false
      });
    }

    if (upcomingGames.length > 0) {
      embed.fields.push({
        name: '⏰ UPCOMING GAMES',
        value: upcomingGames.map(game => 
          `**${game.matchup}**\n${game.time}`
        ).join('\n\n'),
        inline: false
      });
    }

    if (completedGames.length > 0) {
      embed.fields.push({
        name: '✅ COMPLETED GAMES',
        value: completedGames.map(game => 
          `**${game.matchup}**\n${game.score || 'Final'}`
        ).join('\n\n'),
        inline: false
      });
    }

    return embed;
  }

  /**
   * Manual schedule refresh
   */
  async refreshSchedule() {
    this.scheduleCache.clear();
    this.lastScheduleUpdate = null;
    await this.updateScheduleCache();
    return this.getMonitoringStatus();
  }
}

module.exports = NFLSchedule;