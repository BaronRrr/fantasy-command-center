const axios = require('axios');
const cheerio = require('cheerio');
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

class PracticeReportMonitor {
  constructor(discordNotifier) {
    this.discordNotifier = discordNotifier;
    this.practiceWebhookUrl = process.env.PRACTICE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1407573210593230949/49oispk9IkCr9_0TuE69WpYjaOqvacwqzhCQh3gwTu37OOzXcPzupJa2LpWYwLGC7mNN';
    this.watchlist = new Set(); // Players to monitor
    this.lastReports = new Map(); // Track previous status to detect changes
    this.weeklyTracking = new Map(); // Track entire week's practice participation
    this.isMonitoring = false;
    
    // Practice report sources
    this.sources = {
      espn: 'https://www.espn.com/nfl/team/injuries/_/name/sf', // Will be dynamic per team
      nfl: 'https://www.nfl.com/teams/san-francisco-49ers/injury-report', // Example
      fantasypros: 'https://www.fantasypros.com/nfl/reports/injuries/'
    };
    
    // Practice designations and their fantasy impact
    this.practiceStatus = {
      'Full Practice': { severity: 'low', impact: 'Likely to play' },
      'Limited Practice': { severity: 'medium', impact: 'Monitor status' },
      'Did Not Practice': { severity: 'high', impact: 'Questionable to play' },
      'No Practice - Rest': { severity: 'low', impact: 'Maintenance day' },
      'No Practice - Injury': { severity: 'high', impact: 'Injury concern' }
    };
  }

  // Add players to watch list
  addPlayerToWatchlist(playerName, team) {
    const playerId = `${playerName}-${team}`.toLowerCase().replace(/\s+/g, '-');
    this.watchlist.add({ id: playerId, name: playerName, team: team });
    logger.info(`Added ${playerName} (${team}) to practice watch list`);
    return playerId;
  }

  // Remove player from watch list
  removePlayerFromWatchlist(playerId) {
    for (const player of this.watchlist) {
      if (player.id === playerId) {
        this.watchlist.delete(player);
        logger.info(`Removed ${player.name} from practice watch list`);
        return true;
      }
    }
    return false;
  }

  // Get current watch list
  getWatchlist() {
    return Array.from(this.watchlist);
  }

  // Start monitoring practice reports
  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Practice monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('🏈 Starting practice report monitoring...');
    
    // Initial load
    await this.checkPracticeReports();
    
    // Check every 2 hours during practice week (Tuesday-Friday)
    setInterval(async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();
      
      // Only check during practice days and hours (Tue-Fri, 9 AM - 7 PM EST)
      if (dayOfWeek >= 2 && dayOfWeek <= 5 && hour >= 9 && hour <= 19) {
        await this.checkPracticeReports();
      }
    }, 2 * 60 * 60 * 1000); // 2 hours
    
    // Friday evening practice summary (6 PM EST)
    setInterval(async () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();
      
      // Friday at 6 PM - send weekly practice summary
      if (dayOfWeek === 5 && hour === 18) {
        await this.sendWeeklyPracticeSummary();
      }
    }, 60 * 60 * 1000); // Check every hour for the Friday 6 PM trigger
    
    logger.info('✅ Practice monitoring active - checking every 2 hours during practice days');
  }

  async checkPracticeReports() {
    if (this.watchlist.size === 0) {
      logger.debug('No players in watchlist, skipping practice check');
      return;
    }

    try {
      logger.info(`🔍 Checking practice reports for ${this.watchlist.size} players...`);
      
      const teams = new Set(Array.from(this.watchlist).map(player => player.team));
      const updates = [];
      
      for (const team of teams) {
        try {
          const teamReports = await this.getTeamPracticeReport(team);
          updates.push(...teamReports);
        } catch (error) {
          logger.warn(`Failed to get practice report for ${team}:`, error.message);
        }
      }
      
      if (updates.length > 0) {
        await this.processUpdates(updates);
      }
      
    } catch (error) {
      logger.error('Error checking practice reports:', error.message);
    }
  }

  async getTeamPracticeReport(team) {
    const reports = [];
    
    // Try ESPN first (primary source)
    try {
      const espnReports = await this.scrapeESPNPracticeReport(team);
      reports.push(...espnReports);
    } catch (error) {
      logger.debug(`ESPN practice report failed for ${team}:`, error.message);
    }
    
    // Try Yahoo Fantasy Sports
    try {
      const yahooReports = await this.scrapeYahooPracticeReport(team);
      reports.push(...yahooReports);
    } catch (error) {
      logger.debug(`Yahoo practice report failed for ${team}:`, error.message);
    }
    
    // Fallback to other sources if needed
    if (reports.length === 0) {
      try {
        const nflReports = await this.scrapeNFLPracticeReport(team);
        reports.push(...nflReports);
      } catch (error) {
        logger.debug(`NFL.com practice report failed for ${team}:`, error.message);
      }
    }
    
    return reports;
  }

  // Manual practice report scanning for any player
  async getPlayerPracticeReport(playerName, team) {
    try {
      logger.info(`🔍 Manual practice check for ${playerName} (${team})...`);
      
      const allSources = [];
      
      // ESPN practice report (all players)
      try {
        const espnReports = await this.scrapeESPNPracticeReportAll(team);
        const playerReport = espnReports.find(report => 
          report.player.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(report.player.toLowerCase())
        );
        if (playerReport) {
          allSources.push({ ...playerReport, source: 'ESPN' });
        }
      } catch (error) {
        logger.debug(`ESPN manual check failed for ${playerName}:`, error.message);
      }
      
      // Yahoo Fantasy practice report (all players)
      try {
        const yahooReports = await this.scrapeYahooPracticeReportAll(team);
        const playerReport = yahooReports.find(report => 
          report.player.toLowerCase().includes(playerName.toLowerCase()) ||
          playerName.toLowerCase().includes(report.player.toLowerCase())
        );
        if (playerReport) {
          allSources.push({ ...playerReport, source: 'Yahoo Fantasy' });
        }
      } catch (error) {
        logger.debug(`Yahoo manual check failed for ${playerName}:`, error.message);
      }
      
      if (allSources.length === 0) {
        return {
          player: playerName,
          team: team,
          status: 'No practice report found',
          injury: 'No information available',
          sources: [],
          lastChecked: new Date().toISOString()
        };
      }
      
      // Return the most recent/reliable source
      const primaryReport = allSources[0];
      return {
        ...primaryReport,
        allSources: allSources,
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Error getting manual practice report for ${playerName}:`, error.message);
      throw error;
    }
  }

  async scrapeESPNPracticeReport(team) {
    const teamMapping = {
      'SF': 'sf',
      'KC': 'kc', 
      'BUF': 'buf',
      'PHI': 'phi',
      'BAL': 'bal',
      'HOU': 'hou',
      'NYJ': 'nyj',
      'TEN': 'ten',
      'PIT': 'pit',
      'TB': 'tb'
      // Add more team mappings as needed
    };
    
    const espnTeam = teamMapping[team] || team.toLowerCase();
    const url = `https://www.espn.com/nfl/team/injuries/_/name/${espnTeam}`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });
    
    const $ = cheerio.load(response.data);
    const reports = [];
    
    // Parse ESPN injury/practice table
    $('.Table__TR').each((i, row) => {
      const $row = $(row);
      const playerName = $row.find('[data-idx="0"]').text().trim();
      const status = $row.find('[data-idx="2"]').text().trim();
      const injury = $row.find('[data-idx="1"]').text().trim();
      
      if (playerName && this.isPlayerWatched(playerName, team)) {
        reports.push({
          player: playerName,
          team: team,
          status: status,
          injury: injury || 'Unspecified',
          source: 'ESPN',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return reports;
  }

  // Manual ESPN scraping for any player (not just watched)
  async scrapeESPNPracticeReportAll(team) {
    const teamMapping = {
      'SF': 'sf',
      'KC': 'kc', 
      'BUF': 'buf',
      'PHI': 'phi',
      'BAL': 'bal',
      'HOU': 'hou',
      'NYJ': 'nyj',
      'TEN': 'ten',
      'PIT': 'pit',
      'TB': 'tb'
      // Add more team mappings as needed
    };
    
    const espnTeam = teamMapping[team] || team.toLowerCase();
    const url = `https://www.espn.com/nfl/team/injuries/_/name/${espnTeam}`;
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });
    
    const $ = cheerio.load(response.data);
    const reports = [];
    
    // Parse ESPN injury/practice table for ALL players
    $('.Table__TR').each((i, row) => {
      const $row = $(row);
      const playerName = $row.find('[data-idx="0"]').text().trim();
      const status = $row.find('[data-idx="2"]').text().trim();
      const injury = $row.find('[data-idx="1"]').text().trim();
      
      if (playerName) {
        reports.push({
          player: playerName,
          team: team,
          status: status,
          injury: injury || 'Unspecified',
          source: 'ESPN',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    return reports;
  }

  async scrapeYahooPracticeReport(team) {
    try {
      // Yahoo Fantasy Sports injury/practice tracking URLs
      const teamUrls = {
        'SF': 'https://sports.yahoo.com/nfl/teams/sf/',
        'KC': 'https://sports.yahoo.com/nfl/teams/kc/',
        'BUF': 'https://sports.yahoo.com/nfl/teams/buf/',
        'PHI': 'https://sports.yahoo.com/nfl/teams/phi/',
        'BAL': 'https://sports.yahoo.com/nfl/teams/bal/',
        'HOU': 'https://sports.yahoo.com/nfl/teams/hou/',
        'NYJ': 'https://sports.yahoo.com/nfl/teams/nyj/',
        'TEN': 'https://sports.yahoo.com/nfl/teams/ten/',
        'PIT': 'https://sports.yahoo.com/nfl/teams/pit/',
        'TB': 'https://sports.yahoo.com/nfl/teams/tb/'
        // Add more team mappings as needed
      };
      
      const baseUrl = teamUrls[team];
      if (!baseUrl) {
        logger.debug(`No Yahoo URL mapping for team ${team}`);
        return [];
      }
      
      const url = `${baseUrl}injuries/`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      const reports = [];
      
      // Parse Yahoo injury/practice table (adjust selectors as needed)
      $('.Table tbody tr, .injury-report tr, .players-table tr').each((i, row) => {
        const $row = $(row);
        const playerName = $row.find('td:first-child, .name').text().trim();
        const status = $row.find('td:nth-child(3), .status').text().trim();
        const injury = $row.find('td:nth-child(2), .injury').text().trim();
        
        if (playerName && this.isPlayerWatched(playerName, team)) {
          reports.push({
            player: playerName,
            team: team,
            status: status || 'Unknown',
            injury: injury || 'Unspecified',
            source: 'Yahoo Fantasy',
            timestamp: new Date().toISOString()
          });
        }
      });
      
      logger.debug(`Yahoo scraping found ${reports.length} practice reports for ${team}`);
      return reports;
      
    } catch (error) {
      logger.debug(`Yahoo practice scraping failed for ${team}:`, error.message);
      return [];
    }
  }

  // Manual Yahoo scraping for any player (not just watched)
  async scrapeYahooPracticeReportAll(team) {
    try {
      // Yahoo Fantasy Sports injury/practice tracking URLs
      const teamUrls = {
        'SF': 'https://sports.yahoo.com/nfl/teams/sf/',
        'KC': 'https://sports.yahoo.com/nfl/teams/kc/',
        'BUF': 'https://sports.yahoo.com/nfl/teams/buf/',
        'PHI': 'https://sports.yahoo.com/nfl/teams/phi/',
        'BAL': 'https://sports.yahoo.com/nfl/teams/bal/',
        'HOU': 'https://sports.yahoo.com/nfl/teams/hou/',
        'NYJ': 'https://sports.yahoo.com/nfl/teams/nyj/',
        'TEN': 'https://sports.yahoo.com/nfl/teams/ten/',
        'PIT': 'https://sports.yahoo.com/nfl/teams/pit/',
        'TB': 'https://sports.yahoo.com/nfl/teams/tb/'
        // Add more team mappings as needed
      };
      
      const baseUrl = teamUrls[team];
      if (!baseUrl) {
        logger.debug(`No Yahoo URL mapping for team ${team}`);
        return [];
      }
      
      const url = `${baseUrl}injuries/`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      const reports = [];
      
      // Parse Yahoo injury/practice table for ALL players
      $('.Table tbody tr, .injury-report tr, .players-table tr').each((i, row) => {
        const $row = $(row);
        const playerName = $row.find('td:first-child, .name').text().trim();
        const status = $row.find('td:nth-child(3), .status').text().trim();
        const injury = $row.find('td:nth-child(2), .injury').text().trim();
        
        if (playerName) {
          reports.push({
            player: playerName,
            team: team,
            status: status || 'Unknown',
            injury: injury || 'Unspecified',
            source: 'Yahoo Fantasy',
            timestamp: new Date().toISOString()
          });
        }
      });
      
      logger.debug(`Yahoo ALL scraping found ${reports.length} practice reports for ${team}`);
      return reports;
      
    } catch (error) {
      logger.debug(`Yahoo ALL practice scraping failed for ${team}:`, error.message);
      return [];
    }
  }

  async scrapeNFLPracticeReport(team) {
    // Placeholder for NFL.com scraping
    // Would need actual team URLs and parsing logic
    return [];
  }

  isPlayerWatched(playerName, team) {
    for (const player of this.watchlist) {
      if (player.team === team && 
          player.name.toLowerCase().includes(playerName.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  async processUpdates(updates) {
    for (const update of updates) {
      const playerId = `${update.player}-${update.team}`.toLowerCase().replace(/\s+/g, '-');
      const previousReport = this.lastReports.get(playerId);
      
      // Track weekly data
      this.trackWeeklyData(playerId, update);
      
      // Check if status changed
      if (!previousReport || previousReport.status !== update.status) {
        await this.sendPracticeAlert(update, previousReport);
        this.lastReports.set(playerId, update);
      }
    }
  }

  trackWeeklyData(playerId, update) {
    const weekKey = this.getWeekKey(); // Current week identifier
    const dayOfWeek = new Date().getDay(); // 0=Sunday, 1=Monday, etc
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    
    // Initialize weekly tracking for this player if not exists
    if (!this.weeklyTracking.has(playerId)) {
      this.weeklyTracking.set(playerId, new Map());
    }
    
    const playerWeekly = this.weeklyTracking.get(playerId);
    
    // Initialize week data if not exists
    if (!playerWeekly.has(weekKey)) {
      playerWeekly.set(weekKey, {
        player: update.player,
        team: update.team,
        practices: {},
        lastUpdated: update.timestamp
      });
    }
    
    const weekData = playerWeekly.get(weekKey);
    weekData.practices[dayName] = {
      status: update.status,
      injury: update.injury,
      timestamp: update.timestamp
    };
    weekData.lastUpdated = update.timestamp;
  }

  getWeekKey() {
    const now = new Date();
    const year = now.getFullYear();
    const weekNum = Math.ceil((now - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${weekNum}`;
  }

  async sendToPracticeChannel(embed) {
    const axios = require('axios');
    try {
      await axios.post(this.practiceWebhookUrl, {
        embeds: [embed]
      });
      logger.info('📢 Practice alert sent to dedicated channel');
    } catch (error) {
      logger.warn('Failed to send to practice channel, using fallback:', error.message);
      // Fallback to regular Discord notifier
      await this.discordNotifier.sendEmbed(embed, 'INFO');
    }
  }

  async sendPracticeAlert(update, previousReport) {
    const statusInfo = this.practiceStatus[update.status] || 
      { severity: 'medium', impact: 'Monitor status' };
    
    const color = statusInfo.severity === 'high' ? 0xFF0000 : 
                  statusInfo.severity === 'medium' ? 0xFFFF00 : 0x00FF00;
    
    const embed = {
      title: `🏈 Practice Report Update`,
      description: `${update.player} - ${update.team}`,
      color: color,
      fields: [
        {
          name: '📋 Practice Status',
          value: update.status,
          inline: true
        },
        {
          name: '🏥 Injury',
          value: update.injury,
          inline: true
        },
        {
          name: '📊 Fantasy Impact',
          value: statusInfo.impact,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Source: ${update.source} • Practice Monitor`
      }
    };

    if (previousReport) {
      embed.fields.push({
        name: '🔄 Previous Status',
        value: previousReport.status,
        inline: false
      });
    }
    
    await this.sendToPracticeChannel(embed);
    logger.info(`📢 Practice alert sent: ${update.player} - ${update.status}`);
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('⏹️ Practice monitoring stopped');
  }

  async sendWeeklyPracticeSummary() {
    if (this.watchlist.size === 0) {
      logger.debug('No players in watchlist, skipping weekly summary');
      return;
    }

    try {
      logger.info('📋 Generating weekly practice summary...');
      
      const weekKey = this.getWeekKey();
      const summaryData = [];
      
      // Get current week's data for all watched players
      for (const player of this.watchlist) {
        const playerWeekly = this.weeklyTracking.get(player.id);
        if (playerWeekly && playerWeekly.has(weekKey)) {
          const weekData = playerWeekly.get(weekKey);
          summaryData.push({
            ...weekData,
            riskLevel: this.calculateWeeklyRisk(weekData)
          });
        } else {
          // Player not tracked this week - might be new addition
          summaryData.push({
            player: player.name,
            team: player.team,
            practices: {},
            riskLevel: 'unknown',
            note: 'Recently added to watchlist'
          });
        }
      }
      
      await this.sendWeeklySummaryEmbed(summaryData);
      
    } catch (error) {
      logger.error('Error generating weekly practice summary:', error.message);
    }
  }

  calculateWeeklyRisk(weekData) {
    const practices = Object.values(weekData.practices);
    if (practices.length === 0) return 'unknown';
    
    const missedPractices = practices.filter(p => 
      p.status.toLowerCase().includes('did not practice') || 
      p.status.toLowerCase().includes('no practice')
    ).length;
    
    const limitedPractices = practices.filter(p => 
      p.status.toLowerCase().includes('limited')
    ).length;
    
    if (missedPractices >= 2) return 'high';
    if (missedPractices >= 1 || limitedPractices >= 2) return 'medium';
    return 'low';
  }

  async sendWeeklySummaryEmbed(summaryData) {
    const highRisk = summaryData.filter(p => p.riskLevel === 'high');
    const mediumRisk = summaryData.filter(p => p.riskLevel === 'medium');
    const lowRisk = summaryData.filter(p => p.riskLevel === 'low');
    
    const embed = {
      title: '📋 Weekly Practice Summary',
      description: `Practice participation report for your watchlist players`,
      color: highRisk.length > 0 ? 0xFF0000 : mediumRisk.length > 0 ? 0xFFFF00 : 0x00FF00,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Practice Monitor • Weekly Summary'
      }
    };

    // High risk players
    if (highRisk.length > 0) {
      embed.fields.push({
        name: '🚨 High Risk Players',
        value: highRisk.map(p => this.formatPlayerSummary(p)).join('\n'),
        inline: false
      });
    }

    // Medium risk players  
    if (mediumRisk.length > 0) {
      embed.fields.push({
        name: '⚠️ Monitor Closely',
        value: mediumRisk.map(p => this.formatPlayerSummary(p)).join('\n'),
        inline: false
      });
    }

    // Low risk players
    if (lowRisk.length > 0) {
      embed.fields.push({
        name: '✅ Good to Go',
        value: lowRisk.map(p => this.formatPlayerSummary(p)).join('\n'),
        inline: false
      });
    }

    // Practice breakdown
    embed.fields.push({
      name: '📊 This Week\'s Summary',
      value: `**Total Players:** ${summaryData.length}
**High Risk:** ${highRisk.length} 🚨
**Medium Risk:** ${mediumRisk.length} ⚠️
**Low Risk:** ${lowRisk.length} ✅

*Game day approaches - check final injury reports Saturday!*`,
      inline: false
    });
    
    await this.sendToPracticeChannel(embed);
    logger.info(`📢 Weekly practice summary sent for ${summaryData.length} players`);
  }

  formatPlayerSummary(playerData) {
    const practices = playerData.practices;
    const practiceEmojis = {
      'Tuesday': this.getPracticeEmoji(practices.Tuesday?.status),
      'Wednesday': this.getPracticeEmoji(practices.Wednesday?.status),
      'Thursday': this.getPracticeEmoji(practices.Thursday?.status),
      'Friday': this.getPracticeEmoji(practices.Friday?.status)
    };
    
    const practiceString = Object.entries(practiceEmojis)
      .map(([day, emoji]) => `${day.substring(0,3)}: ${emoji || '❓'}`)
      .join(' | ');
    
    return `**${playerData.player}** (${playerData.team})\n${practiceString}`;
  }

  getPracticeEmoji(status) {
    if (!status) return '❓';
    const lower = status.toLowerCase();
    if (lower.includes('full')) return '✅';
    if (lower.includes('limited')) return '⚠️';
    if (lower.includes('did not') || lower.includes('no practice')) return '❌';
    return '❓';
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      watchlistSize: this.watchlist.size,
      playersWatched: Array.from(this.watchlist).map(p => `${p.name} (${p.team})`),
      lastReportsCount: this.lastReports.size,
      weeklyDataSize: this.weeklyTracking.size
    };
  }
}

module.exports = PracticeReportMonitor;