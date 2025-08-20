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

class DepthChartMonitor {
  constructor(discordNotifier) {
    this.discordNotifier = discordNotifier;
    this.lastDepthCharts = new Map(); // Track previous depth charts
    this.positionsToMonitor = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    this.isMonitoring = false;
    
    // Premium depth chart sources from the comprehensive list
    this.sources = {
      ourlads: {
        name: 'Ourlads NFL Depth Charts',
        url: 'https://www.ourlads.com/nfldepthcharts/',
        specialty: 'Most accurate depth charts, updated weekly',
        update_frequency: 'Tuesday-Wednesday each week',
        priority: 'PRIMARY'
      },
      espn_teams: {
        name: 'ESPN Team Pages',
        url: 'https://www.espn.com/nfl/teams',
        specialty: 'Team depth charts, roster moves',
        update_frequency: 'Real-time during season',
        priority: 'SECONDARY'
      },
      fantasypros_depth: {
        name: 'FantasyPros Depth Charts',
        url: 'https://www.fantasypros.com/nfl/depth-charts.php',
        specialty: 'Fantasy-focused depth analysis',
        update_frequency: 'Weekly',
        priority: 'TERTIARY'
      }
    };

    // Team abbreviation mapping for different sources
    this.teamMapping = {
      'SF': ['49ers', 'san-francisco-49ers', 'sf'],
      'KC': ['chiefs', 'kansas-city-chiefs', 'kc'],
      'BUF': ['bills', 'buffalo-bills', 'buf'],
      'PHI': ['eagles', 'philadelphia-eagles', 'phi'],
      'BAL': ['ravens', 'baltimore-ravens', 'bal'],
      'HOU': ['texans', 'houston-texans', 'hou'],
      'NYJ': ['jets', 'new-york-jets', 'nyj'],
      'TEN': ['titans', 'tennessee-titans', 'ten'],
      'PIT': ['steelers', 'pittsburgh-steelers', 'pit'],
      'TB': ['buccaneers', 'tampa-bay-buccaneers', 'tb'],
      'MIA': ['dolphins', 'miami-dolphins', 'mia'],
      'NE': ['patriots', 'new-england-patriots', 'ne'],
      'CIN': ['bengals', 'cincinnati-bengals', 'cin'],
      'CLE': ['browns', 'cleveland-browns', 'cle']
      // Add more teams as needed
    };
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Depth chart monitoring already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('📊 Starting depth chart monitoring...');
    
    // Initial load
    await this.checkAllDepthCharts();
    
    // Check twice a week (Tuesday and Wednesday at 10 AM EST)
    setInterval(async () => {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const hour = now.getHours();
      
      // Check Tuesday (2) and Wednesday (3) at 10 AM EST
      if ((dayOfWeek === 2 || dayOfWeek === 3) && hour === 10) {
        await this.checkAllDepthCharts();
      }
    }, 60 * 60 * 1000); // Check every hour for the trigger
    
    logger.info('✅ Depth chart monitoring active - checking Tue/Wed at 10 AM EST');
  }

  async checkAllDepthCharts() {
    try {
      logger.info('📊 Checking depth charts for all teams...');
      
      const changes = [];
      
      // Check Ourlads (primary source)
      try {
        const ourladChanges = await this.scrapeOurladsDepthCharts();
        changes.push(...ourladChanges);
      } catch (error) {
        logger.warn('Ourlads depth chart check failed:', error.message);
      }
      
      // Check ESPN (secondary source)
      try {
        const espnChanges = await this.scrapeESPNDepthCharts();
        changes.push(...espnChanges);
      } catch (error) {
        logger.warn('ESPN depth chart check failed:', error.message);
      }
      
      if (changes.length > 0) {
        await this.processDepthChartChanges(changes);
      }
      
      logger.info(`📊 Depth chart check complete. Found ${changes.length} changes.`);
      
    } catch (error) {
      logger.error('Error checking depth charts:', error.message);
    }
  }

  async scrapeOurladsDepthCharts() {
    const changes = [];
    
    try {
      const response = await axios.get('https://www.ourlads.com/nfldepthcharts/', {
        timeout: 15000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Parse Ourlads depth chart format
      $('.team-depth-chart, .depth-chart-team').each((i, teamSection) => {
        const $team = $(teamSection);
        const teamName = $team.find('.team-name, .team-title').text().trim();
        const teamAbbr = this.getTeamAbbreviation(teamName);
        
        if (!teamAbbr) return;
        
        // Parse positions within team
        $team.find('.position-group, .depth-position').each((j, posGroup) => {
          const $pos = $(posGroup);
          const position = $pos.find('.position-title, .pos-name').text().trim();
          
          if (!this.positionsToMonitor.includes(position)) return;
          
          const players = [];
          $pos.find('.player-name, .depth-player').each((k, player) => {
            const playerName = $(player).text().trim();
            const depth = k + 1; // 1st string, 2nd string, etc.
            
            if (playerName) {
              players.push({ name: playerName, depth, position });
            }
          });
          
          // Check for changes
          const key = `${teamAbbr}-${position}`;
          const previousDepth = this.lastDepthCharts.get(key);
          
          if (previousDepth && JSON.stringify(previousDepth) !== JSON.stringify(players)) {
            changes.push({
              team: teamAbbr,
              position: position,
              previous: previousDepth,
              current: players,
              source: 'Ourlads',
              timestamp: new Date().toISOString()
            });
          }
          
          this.lastDepthCharts.set(key, players);
        });
      });
      
    } catch (error) {
      logger.debug('Ourlads scraping error:', error.message);
    }
    
    return changes;
  }

  async scrapeESPNDepthCharts() {
    const changes = [];
    
    // This would scrape ESPN team pages for depth chart changes
    // Implementation would loop through team URLs like:
    // https://www.espn.com/nfl/team/_/name/buf/buffalo-bills
    
    // Placeholder for ESPN depth chart scraping
    return changes;
  }

  getTeamAbbreviation(teamName) {
    const name = teamName.toLowerCase();
    
    for (const [abbr, variations] of Object.entries(this.teamMapping)) {
      if (variations.some(variation => name.includes(variation))) {
        return abbr;
      }
    }
    
    return null;
  }

  async processDepthChartChanges(changes) {
    for (const change of changes) {
      await this.sendDepthChartAlert(change);
    }
  }

  async sendDepthChartAlert(change) {
    const { team, position, previous, current, source } = change;
    
    // Determine the type of change
    const changeType = this.analyzeDepthChange(previous, current);
    
    const color = changeType.impact === 'HIGH' ? 0xFF0000 : 
                  changeType.impact === 'MEDIUM' ? 0xFFFF00 : 0x00FF00;
    
    const embed = {
      title: `📊 Depth Chart Update: ${team} ${position}`,
      description: changeType.description,
      color: color,
      fields: [
        {
          name: '📈 New Depth Chart',
          value: current.map((p, i) => `${i + 1}. ${p.name}`).join('\n') || 'No players listed',
          inline: true
        },
        {
          name: '📉 Previous Depth Chart',
          value: previous.map((p, i) => `${i + 1}. ${p.name}`).join('\n') || 'No previous data',
          inline: true
        },
        {
          name: '🎯 Fantasy Impact',
          value: changeType.fantasyImpact,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: `Source: ${source} • Depth Chart Monitor`
      }
    };
    
    await this.discordNotifier.sendEmbed(embed, 'INFO');
    logger.info(`📊 Depth chart alert sent: ${team} ${position}`);
  }

  analyzeDepthChange(previous, current) {
    if (!previous || previous.length === 0) {
      return {
        description: 'New depth chart data available',
        impact: 'LOW',
        fantasyImpact: 'Monitor for initial position hierarchy'
      };
    }
    
    // Check for starter changes (position 1)
    const prevStarter = previous[0]?.name;
    const currentStarter = current[0]?.name;
    
    if (prevStarter !== currentStarter) {
      return {
        description: `🚨 **STARTER CHANGE**: ${currentStarter} replaces ${prevStarter} as #1`,
        impact: 'HIGH',
        fantasyImpact: `Major opportunity change! ${currentStarter} likely sees increased usage. ${prevStarter} value decreases significantly.`
      };
    }
    
    // Check for depth changes
    const depthChanges = [];
    current.forEach((player, index) => {
      const prevIndex = previous.findIndex(p => p.name === player.name);
      if (prevIndex !== -1 && prevIndex !== index) {
        const direction = index < prevIndex ? 'up' : 'down';
        depthChanges.push(`${player.name} moved ${direction} (${prevIndex + 1} → ${index + 1})`);
      }
    });
    
    if (depthChanges.length > 0) {
      return {
        description: `📈 Depth chart movements detected`,
        impact: 'MEDIUM',
        fantasyImpact: `Position changes: ${depthChanges.join(', ')}. Monitor for usage implications.`
      };
    }
    
    return {
      description: 'Minor depth chart adjustments',
      impact: 'LOW',
      fantasyImpact: 'No significant fantasy impact expected'
    };
  }

  stopMonitoring() {
    this.isMonitoring = false;
    logger.info('⏹️ Depth chart monitoring stopped');
  }

  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      trackedPositions: this.positionsToMonitor.join(', '),
      depthChartsTracked: this.lastDepthCharts.size,
      sources: Object.keys(this.sources).join(', ')
    };
  }
}

module.exports = DepthChartMonitor;