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

class OfficialInjuryMonitor {
  constructor(discordNotifier) {
    this.discordNotifier = discordNotifier;
    this.lastInjuryReports = new Map(); // Track previous injury reports
    this.isMonitoring = false;
    
    // Official injury report sources from comprehensive list
    this.sources = {
      nfl_official: {
        name: 'NFL.com Injury Report',
        url: 'https://www.nfl.com/injuries/',
        specialty: 'Official Wednesday-Friday injury reports',
        update_schedule: 'Wed 4PM, Thu 4PM, Fri 4PM EST',
        priority: 'OFFICIAL'
      },
      espn_injuries: {
        name: 'ESPN Injury Report',
        url: 'https://www.espn.com/nfl/injuries',
        specialty: 'Injury status with fantasy impact',
        update_frequency: 'Real-time during report periods',
        priority: 'SECONDARY'
      }
    };

    // Official injury designations
    this.injuryDesignations = {
      'Full Practice': { 
        status: 'Healthy', 
        probability: '100%', 
        fantasy_impact: 'No concern - full go',
        color: 0x00FF00 
      },
      'Limited Practice': { 
        status: 'Questionable', 
        probability: '75%', 
        fantasy_impact: 'Monitor - likely to play',
        color: 0xFFFF00 
      },
      'Did Not Practice': { 
        status: 'Doubtful', 
        probability: '25%', 
        fantasy_impact: 'High concern - backup plan needed',
        color: 0xFF8800 
      },
      'Out': { 
        status: 'Out', 
        probability: '0%', 
        fantasy_impact: 'Will not play - use handcuff',
        color: 0xFF0000 
      },
      'Questionable': { 
        status: 'Questionable', 
        probability: '50%', 
        fantasy_impact: 'Game-time decision',
        color: 0xFFFF00 
      },
      'Doubtful': { 
        status: 'Doubtful', 
        probability: '25%', 
        fantasy_impact: 'Very unlikely to play',
        color: 0xFF8800 
      }
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Official injury monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('🏥 Starting official injury report monitoring...');
    
    // Check during official injury report periods
    // Wednesday, Thursday, Friday at 4:15 PM EST (15 minutes after official reports)
    setInterval(async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Check Wed (3), Thu (4), Fri (5) at 4:15 PM EST
      if ([3, 4, 5].includes(dayOfWeek) && hour === 16 && minute === 15) {
        await this.checkOfficialInjuryReports();
      }
    }, 60 * 1000); // Check every minute for precise timing
    
    // Also check every 2 hours during the season for updates
    setInterval(async () => {
      await this.checkOfficialInjuryReports();
    }, 2 * 60 * 60 * 1000); // 2 hours
    
    logger.info('✅ Official injury monitoring active - checking Wed/Thu/Fri 4:15 PM EST');
  }

  async checkOfficialInjuryReports() {
    try {
      logger.info('🏥 Checking official injury reports...');
      
      const reports = [];
      
      // Check NFL.com official reports (primary)
      try {
        const nflReports = await this.scrapeNFLOfficialReports();
        reports.push(...nflReports);
      } catch (error) {
        logger.warn('NFL.com injury report check failed:', error.message);
      }
      
      // Check ESPN (secondary)
      try {
        const espnReports = await this.scrapeESPNInjuryReports();
        reports.push(...espnReports);
      } catch (error) {
        logger.warn('ESPN injury report check failed:', error.message);
      }
      
      if (reports.length > 0) {
        await this.processInjuryUpdates(reports);
      }
      
      logger.info(`🏥 Injury report check complete. Found ${reports.length} updates.`);
      
    } catch (error) {
      logger.error('Error checking official injury reports:', error.message);
    }
  }

  async scrapeNFLOfficialReports() {
    const reports = [];
    
    try {
      const response = await axios.get('https://www.nfl.com/injuries/', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Parse NFL.com injury report format
      $('.nfl-o-table__row, .injury-report-row').each((i, row) => {
        const $row = $(row);
        
        const playerName = $row.find('.nfl-o-table__cell:first-child, .player-name').text().trim();
        const team = $row.find('.team-abbr, .team-name').text().trim();
        const position = $row.find('.position, .pos').text().trim();
        const injury = $row.find('.injury-type, .injury').text().trim();
        const status = $row.find('.practice-status, .status').text().trim();
        const gameStatus = $row.find('.game-status, .designation').text().trim();
        
        if (playerName && team) {
          reports.push({
            player: playerName,
            team: team.toUpperCase(),
            position: position,
            injury: injury || 'Unspecified',
            practiceStatus: status,
            gameStatus: gameStatus,
            source: 'NFL.com Official',
            timestamp: new Date().toISOString(),
            isOfficial: true
          });
        }
      });
      
    } catch (error) {
      logger.debug('NFL.com injury scraping error:', error.message);
    }
    
    return reports;
  }

  async scrapeESPNInjuryReports() {
    const reports = [];
    
    try {
      const response = await axios.get('https://www.espn.com/nfl/injuries', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Parse ESPN injury report format
      $('.Table__TR, .injury-row').each((i, row) => {
        const $row = $(row);
        
        const playerName = $row.find('[data-idx="0"], .player-name').text().trim();
        const team = $row.find('.team-name, .team').text().trim();
        const position = $row.find('.position, .pos').text().trim();
        const injury = $row.find('.injury-description, .injury').text().trim();
        const status = $row.find('.status, .game-status').text().trim();
        
        if (playerName && team) {
          reports.push({
            player: playerName,
            team: team.toUpperCase(),
            position: position,
            injury: injury || 'Unspecified',
            gameStatus: status,
            source: 'ESPN',
            timestamp: new Date().toISOString(),
            isOfficial: false
          });
        }
      });
      
    } catch (error) {
      logger.debug('ESPN injury scraping error:', error.message);
    }
    
    return reports;
  }

  async processInjuryUpdates(reports) {
    for (const report of reports) {
      const playerId = `${report.player}-${report.team}`.toLowerCase().replace(/\s+/g, '-');
      const previousReport = this.lastInjuryReports.get(playerId);
      
      // Check if this is a new injury or status change
      if (!previousReport || this.hasSignificantChange(previousReport, report)) {
        await this.sendInjuryAlert(report, previousReport);
        this.lastInjuryReports.set(playerId, report);
      }
    }
  }

  hasSignificantChange(previous, current) {
    // Check for status changes
    if (previous.gameStatus !== current.gameStatus) return true;
    if (previous.practiceStatus !== current.practiceStatus) return true;
    if (previous.injury !== current.injury) return true;
    
    return false;
  }

  async sendInjuryAlert(report, previousReport) {
    const designation = this.injuryDesignations[report.gameStatus] || 
                       this.injuryDesignations[report.practiceStatus] || {
                         status: 'Unknown',
                         probability: 'TBD',
                         fantasy_impact: 'Monitor for updates',
                         color: 0x888888
                       };
    
    const isNewInjury = !previousReport;
    const isWorseningCondition = previousReport && this.isConditionWorsening(previousReport, report);
    
    let alertTitle = '🏥 Injury Report Update';
    if (isNewInjury) {
      alertTitle = '🚨 NEW INJURY REPORT';
    } else if (isWorseningCondition) {
      alertTitle = '⚠️ INJURY STATUS WORSENED';
    } else if (this.isConditionImproving(previousReport, report)) {
      alertTitle = '✅ INJURY STATUS IMPROVED';
    }
    
    const embed = {
      title: alertTitle,
      description: `**${report.player}** (${report.position} - ${report.team})`,
      color: designation.color,
      fields: [
        {
          name: '🏥 Injury',
          value: report.injury,
          inline: true
        },
        {
          name: '📊 Game Status',
          value: report.gameStatus || 'Not designated',
          inline: true
        },
        {
          name: '🏈 Play Probability',
          value: designation.probability,
          inline: true
        },
        {
          name: '🎯 Fantasy Impact',
          value: designation.fantasy_impact,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `${report.source} • ${report.isOfficial ? 'OFFICIAL' : 'Unofficial'} Report`
      }
    };
    
    if (report.practiceStatus) {
      embed.fields.splice(2, 0, {
        name: '🏃 Practice Status',
        value: report.practiceStatus,
        inline: true
      });
    }
    
    if (previousReport) {
      embed.fields.push({
        name: '📈 Previous Status',
        value: `${previousReport.gameStatus || 'Not designated'} (${previousReport.source})`,
        inline: false
      });
    }
    
    await this.discordNotifier.sendEmbed(embed, 'INFO');
    logger.info(`🏥 Injury alert sent: ${report.player} - ${report.gameStatus}`);
  }

  isConditionWorsening(previous, current) {
    const severityOrder = ['Full Practice', 'Limited Practice', 'Questionable', 'Doubtful', 'Did Not Practice', 'Out'];
    
    const prevSeverity = severityOrder.indexOf(previous.gameStatus || previous.practiceStatus);
    const currentSeverity = severityOrder.indexOf(current.gameStatus || current.practiceStatus);
    
    return currentSeverity > prevSeverity && prevSeverity !== -1 && currentSeverity !== -1;
  }

  isConditionImproving(previous, current) {
    const severityOrder = ['Out', 'Did Not Practice', 'Doubtful', 'Questionable', 'Limited Practice', 'Full Practice'];
    
    const prevSeverity = severityOrder.indexOf(previous.gameStatus || previous.practiceStatus);
    const currentSeverity = severityOrder.indexOf(current.gameStatus || current.practiceStatus);
    
    return currentSeverity > prevSeverity && prevSeverity !== -1 && currentSeverity !== -1;
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('⏹️ Official injury monitoring stopped');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      reportsTracked: this.lastInjuryReports.size,
      sources: Object.keys(this.sources).join(', '),
      nextCheck: 'Wed/Thu/Fri 4:15 PM EST + every 2 hours'
    };
  }
}

module.exports = OfficialInjuryMonitor;