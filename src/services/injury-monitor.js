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

class InjuryMonitor {
  constructor(discordNotifier, claudeClient) {
    this.discordNotifier = discordNotifier;
    this.claude = claudeClient;
    this.lastChecked = new Date();
    this.knownInjuries = new Map();
    this.isMonitoring = false;
    
    // Injury data sources (prioritized order)
    this.sources = {
      espn: 'https://www.espn.com/nfl/injuries', // Primary source
      fantasypros: 'https://www.fantasypros.com/nfl/reports/injuries/', // Secondary - excellent consensus data
      nfl: 'https://www.nfl.com/injuries/' // Tertiary - official but slower updates
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Injury monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('🏥 Starting injury monitoring system...');
    
    // Initial load of current injuries
    await this.loadCurrentInjuries();
    
    // Check every hour during active hours (8 AM - 11 PM EST)
    setInterval(async () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour >= 8 && hour <= 23) {
        await this.checkInjuryUpdates();
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Quick check disabled - only use on-command or hourly monitoring
    // setInterval(async () => {
    //   const now = new Date();
    //   const hour = now.getHours();
    //   
    //   if (hour >= 12 && hour <= 19) {
    //     await this.quickInjuryCheck();
    //   }
    // }, 2 * 60 * 1000); // 2 minutes
    
    logger.info('✅ Injury monitoring active - checking every hour');
  }

  async loadCurrentInjuries() {
    try {
      logger.info('📋 Loading current injury reports...');
      const currentInjuries = await this.scrapeAllSources();
      
      currentInjuries.forEach(injury => {
        this.knownInjuries.set(injury.playerId, injury);
      });
      
      logger.info(`✅ Loaded ${currentInjuries.length} current injuries`);
    } catch (error) {
      logger.error('Failed to load current injuries:', error.message);
    }
  }

  async checkInjuryUpdates() {
    try {
      logger.info('🔍 Checking for injury updates...');
      
      const currentInjuries = await this.scrapeAllSources();
      const updates = this.detectChanges(currentInjuries);
      
      if (updates.length > 0) {
        logger.info(`🚨 Found ${updates.length} injury updates`);
        
        for (const update of updates) {
          await this.processInjuryUpdate(update);
        }
      }
      
      this.updateKnownInjuries(currentInjuries);
      this.lastChecked = new Date();
      
    } catch (error) {
      logger.error('Error checking injury updates:', error.message);
    }
  }

  async quickInjuryCheck() {
    // Lighter check during peak hours - only check breaking news sources
    try {
      const breakingNews = await this.checkBreakingNews();
      if (breakingNews.length > 0) {
        for (const news of breakingNews) {
          await this.processBreakingNews(news);
        }
      }
    } catch (error) {
      logger.debug('Quick injury check error:', error.message);
    }
  }

  async scrapeAllSources() {
    const allInjuries = [];
    
    // Try multiple sources and combine results
    for (const [sourceName, url] of Object.entries(this.sources)) {
      try {
        const injuries = await this.scrapeSource(sourceName, url);
        allInjuries.push(...injuries);
        logger.debug(`📊 ${sourceName}: ${injuries.length} injuries found`);
      } catch (error) {
        logger.warn(`Failed to scrape ${sourceName}:`, error.message);
      }
    }
    
    // Remove duplicates based on player name
    const uniqueInjuries = this.deduplicateInjuries(allInjuries);
    return uniqueInjuries;
  }

  async scrapeSource(sourceName, url) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      switch (sourceName) {
        case 'nfl':
          return this.parseNFLInjuries($);
        case 'espn':
          return this.parseESPNInjuries($);
        case 'fantasypros':
          return this.parseFantasyProsInjuries($);
        default:
          return [];
      }
    } catch (error) {
      throw new Error(`Failed to scrape ${sourceName}: ${error.message}`);
    }
  }

  parseNFLInjuries($) {
    const injuries = [];
    
    // NFL.com injury table parsing
    $('.nfl-injury-table tbody tr').each((i, row) => {
      const $row = $(row);
      const player = $row.find('.player-name').text().trim();
      const team = $row.find('.team-abbr').text().trim();
      const position = $row.find('.position').text().trim();
      const injury = $row.find('.injury-description').text().trim();
      const status = $row.find('.injury-status').text().trim();
      
      if (player && team) {
        injuries.push({
          playerId: `${player}-${team}`.toLowerCase().replace(/\s+/g, '-'),
          player: player,
          team: team,
          position: position,
          injury: injury,
          status: status,
          source: 'NFL.com',
          lastUpdated: new Date()
        });
      }
    });
    
    return injuries;
  }

  parseESPNInjuries($) {
    const injuries = [];
    
    // ESPN injury report parsing (adapt based on actual structure)
    $('.Table__TR').each((i, row) => {
      const $row = $(row);
      const playerCell = $row.find('[data-idx="0"]').text().trim();
      const teamCell = $row.find('[data-idx="1"]').text().trim();
      const statusCell = $row.find('[data-idx="2"]').text().trim();
      
      if (playerCell && teamCell) {
        // Extract player name and position from combined cell
        const playerMatch = playerCell.match(/(.+?)\s+([A-Z]{1,3})$/);
        const player = playerMatch ? playerMatch[1] : playerCell;
        const position = playerMatch ? playerMatch[2] : '';
        
        injuries.push({
          playerId: `${player}-${teamCell}`.toLowerCase().replace(/\s+/g, '-'),
          player: player,
          team: teamCell,
          position: position,
          status: statusCell,
          source: 'ESPN',
          lastUpdated: new Date()
        });
      }
    });
    
    return injuries;
  }

  parseFantasyProsInjuries($) {
    const injuries = [];
    
    // FantasyPros injury parsing
    $('table tbody tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const player = $(cells[0]).text().trim();
        const team = $(cells[1]).text().trim();
        const position = $(cells[2]).text().trim();
        const status = $(cells[3]).text().trim();
        
        if (player && team) {
          injuries.push({
            playerId: `${player}-${team}`.toLowerCase().replace(/\s+/g, '-'),
            player: player,
            team: team,
            position: position,
            status: status,
            source: 'FantasyPros',
            lastUpdated: new Date()
          });
        }
      }
    });
    
    return injuries;
  }

  deduplicateInjuries(injuries) {
    const unique = new Map();
    
    injuries.forEach(injury => {
      const existing = unique.get(injury.playerId);
      if (!existing || injury.lastUpdated > existing.lastUpdated) {
        unique.set(injury.playerId, injury);
      }
    });
    
    return Array.from(unique.values());
  }

  detectChanges(currentInjuries) {
    const changes = [];
    
    currentInjuries.forEach(current => {
      const previous = this.knownInjuries.get(current.playerId);
      
      if (!previous) {
        // New injury
        changes.push({
          ...current,
          changeType: 'new_injury',
          oldStatus: null
        });
      } else if (previous.status !== current.status) {
        // Status change
        changes.push({
          ...current,
          changeType: 'status_change',
          oldStatus: previous.status
        });
      }
    });
    
    return changes;
  }

  async processInjuryUpdate(update) {
    try {
      // Get AI analysis for significant injuries
      let aiAnalysis = null;
      if (this.isSignificantInjury(update)) {
        aiAnalysis = await this.getAIAnalysis(update);
      }
      
      // Create Discord alert
      const priority = this.calculatePriority(update);
      const embed = this.createInjuryEmbed(update, aiAnalysis, priority);
      
      // Send to Discord
      await this.discordNotifier.sendEmbed(embed, priority);
      
      logger.info(`📢 Injury alert sent: ${update.player} (${update.status})`);
      
    } catch (error) {
      logger.error(`Failed to process injury update for ${update.player}:`, error.message);
    }
  }

  async getAIAnalysis(update) {
    try {
      const prompt = `Analyze this NFL injury update for fantasy football impact:

Player: ${update.player} (${update.position}, ${update.team})
Status: ${update.oldStatus || 'Healthy'} → ${update.status}
Injury: ${update.injury || 'Unspecified'}

Provide a brief analysis including:
1. Fantasy impact severity (1-10 scale)
2. Immediate waiver wire targets if applicable  
3. Expected timeline for return
4. Key takeaways for fantasy managers

Keep response under 300 characters for Discord embed.`;

      const analysis = await this.claude.makeRequest([{
        role: 'user',
        content: prompt
      }], 'You are a fantasy football injury analyst. Be concise and actionable.');

      return typeof analysis === 'string' ? analysis : 
             analysis.content?.[0]?.text || analysis.text || analysis.message || null;
             
    } catch (error) {
      logger.warn('Failed to get AI analysis:', error.message);
      return null;
    }
  }

  createInjuryEmbed(update, aiAnalysis, priority) {
    const emoji = this.getInjuryEmoji(update.status);
    const color = this.getInjuryColor(update.status);
    
    const embed = {
      title: `${emoji} ${update.player} - ${update.status}`,
      description: update.changeType === 'new_injury' ? 
        'New injury report' : 
        `Status changed: ${update.oldStatus} → **${update.status}**`,
      color: color,
      fields: [
        {
          name: '👤 Player Info',
          value: `${update.position} • ${update.team}`,
          inline: true
        },
        {
          name: '📊 Priority',
          value: priority.toUpperCase(),
          inline: true
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Source: ${update.source} • Fantasy Command Center`
      }
    };

    if (update.injury) {
      embed.fields.push({
        name: '🏥 Injury Details',
        value: update.injury,
        inline: false
      });
    }

    if (aiAnalysis) {
      embed.fields.push({
        name: '🤖 AI Analysis',
        value: aiAnalysis.substring(0, 900),
        inline: false
      });
    }

    return embed;
  }

  isSignificantInjury(update) {
    const significantStatuses = ['out', 'doubtful', 'ir', 'pup'];
    return significantStatuses.some(status => 
      update.status.toLowerCase().includes(status)
    );
  }

  calculatePriority(update) {
    const status = update.status.toLowerCase();
    
    if (status.includes('out') || status.includes('ir')) return 'CRITICAL';
    if (status.includes('doubtful')) return 'HIGH';
    if (status.includes('questionable')) return 'MEDIUM';
    return 'LOW';
  }

  getInjuryEmoji(status) {
    const lower = status.toLowerCase();
    if (lower.includes('out') || lower.includes('ir')) return '🚨';
    if (lower.includes('doubtful')) return '⚠️';
    if (lower.includes('questionable')) return '🤔';
    return '📋';
  }

  getInjuryColor(status) {
    const lower = status.toLowerCase();
    if (lower.includes('out') || lower.includes('ir')) return 0xFF0000; // Red
    if (lower.includes('doubtful')) return 0xFF8800; // Orange
    if (lower.includes('questionable')) return 0xFFFF00; // Yellow
    return 0x00FF00; // Green
  }

  async checkBreakingNews() {
    // Check Twitter RSS feeds or news APIs for breaking injury news
    // Implementation would depend on available news sources
    return [];
  }

  async processBreakingNews(news) {
    // Process breaking news alerts
    // Implementation for urgent injury news
  }

  updateKnownInjuries(currentInjuries) {
    currentInjuries.forEach(injury => {
      this.knownInjuries.set(injury.playerId, injury);
    });
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('⏹️ Injury monitoring stopped');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastChecked: this.lastChecked,
      knownInjuries: this.knownInjuries.size,
      sources: Object.keys(this.sources)
    };
  }
}

module.exports = InjuryMonitor;