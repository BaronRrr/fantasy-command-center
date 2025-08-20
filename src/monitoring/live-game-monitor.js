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

class LiveGameMonitor {
  constructor() {
    this.isMonitoring = false;
    this.activeGames = new Map();
    this.playerStats = new Map();
    this.watchedPlayers = new Set();
    this.lastSnapCounts = new Map();
    this.lastTargetShares = new Map();
    this.gameAlerts = new Map();
    this.liveWebhookUrl = null;
    
    // Thresholds for alerts
    this.SNAP_COUNT_THRESHOLD = 5; // Alert if snap count changes by 5+
    this.TARGET_THRESHOLD = 2; // Alert for 2+ targets in short time
    this.RED_ZONE_THRESHOLD = 1; // Alert on any red zone usage
    
    // Game status tracking
    this.GAME_STATES = {
      PRE_GAME: 'pre',
      LIVE: 'live', 
      HALFTIME: 'halftime',
      FINAL: 'final'
    };
  }

  // Start live game monitoring
  async startMonitoring(liveWebhookUrl = null) {
    if (this.isMonitoring) {
      logger.warn('Live game monitoring already running');
      return;
    }

    this.isMonitoring = true;
    this.liveWebhookUrl = liveWebhookUrl;
    logger.info('🏈 Starting live game monitoring...');
    
    // Check for active NFL games every 30 seconds during game days
    setInterval(async () => {
      if (this.isGameDay()) {
        await this.checkActiveGames();
      }
    }, 30 * 1000); // 30 seconds
    
    // Update live stats every 15 seconds during active games
    setInterval(async () => {
      if (this.activeGames.size > 0) {
        await this.updateLiveStats();
      }
    }, 15 * 1000); // 15 seconds
    
    logger.info('✅ Live game monitoring active');
  }

  // Check if today is a game day (including preseason for testing)
  isGameDay() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = now.getHours();
    
    // PRESEASON: Allow monitoring any day for testing
    // Regular season: Sunday (main game day), Monday night, Thursday night, Saturday
    if (day === 0) return true; // Sunday
    if (day === 1 && hour >= 17) return true; // Monday night
    if (day === 4 && hour >= 17) return true; // Thursday night
    if (day === 6 && hour >= 15) return true; // Saturday games (late season)
    
    // PRESEASON/TESTING: Also monitor weekdays for preseason games
    const month = now.getMonth(); // 0 = January, 7 = August, etc.
    if (month >= 7 && month <= 8) return true; // August-September preseason
    
    return true; // For testing - monitor every day
  }

  // Add players to live monitoring watchlist
  addPlayersToWatchlist(players) {
    for (const player of players) {
      this.watchedPlayers.add(player.toLowerCase());
      logger.info(`🎯 Added ${player} to live game watchlist`);
    }
  }

  // Remove players from watchlist
  removePlayersFromWatchlist(players) {
    for (const player of players) {
      this.watchedPlayers.delete(player.toLowerCase());
      logger.info(`🗑️ Removed ${player} from live game watchlist`);
    }
  }

  // Check for active NFL games via ESPN API
  async checkActiveGames() {
    try {
      // ESPN NFL Scoreboard API
      const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard', {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });

      const games = response.data.events || [];
      const currentActiveGames = new Map();

      for (const game of games) {
        const gameId = game.id;
        const status = game.status?.type?.name || 'unknown';
        const isLive = ['STATUS_IN_PROGRESS', 'STATUS_HALFTIME'].includes(game.status?.type?.id);
        
        if (isLive) {
          const gameInfo = {
            id: gameId,
            homeTeam: game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.team?.abbreviation,
            awayTeam: game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.team?.abbreviation,
            quarter: game.status?.period || 1,
            clock: game.status?.displayClock || '',
            homeScore: game.competitions[0]?.competitors?.find(c => c.homeAway === 'home')?.score || '0',
            awayScore: game.competitions[0]?.competitors?.find(c => c.homeAway === 'away')?.score || '0',
            status: status,
            lastUpdated: new Date().toISOString()
          };
          
          currentActiveGames.set(gameId, gameInfo);
          
          // Check if this is a newly active game
          if (!this.activeGames.has(gameId)) {
            await this.sendGameStartAlert(gameInfo);
          }
        }
      }

      // Update active games
      this.activeGames = currentActiveGames;
      
      if (currentActiveGames.size > 0) {
        logger.info(`🏈 Monitoring ${currentActiveGames.size} live games`);
      }

    } catch (error) {
      logger.error('Error checking active games:', error.message);
    }
  }

  // Update live stats for active games
  async updateLiveStats() {
    for (const [gameId, gameInfo] of this.activeGames) {
      try {
        await this.scrapeGameStats(gameId, gameInfo);
      } catch (error) {
        logger.error(`Error updating stats for game ${gameId}:`, error.message);
      }
    }
  }

  // Scrape live game stats from ESPN GameCenter
  async scrapeGameStats(gameId, gameInfo) {
    try {
      // ESPN GameCenter URL for detailed stats
      const response = await axios.get(`https://www.espn.com/nfl/game/_/gameId/${gameId}`, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-Command-Center/1.0.0'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Parse snap counts if available
      await this.parseSnapCounts($, gameInfo);
      
      // Parse target data
      await this.parseTargetData($, gameInfo);
      
      // Parse red zone usage
      await this.parseRedZoneData($, gameInfo);
      
      // Check for live injuries
      await this.checkLiveInjuries($, gameInfo);

    } catch (error) {
      logger.debug(`Error scraping stats for game ${gameId}:`, error.message);
    }
  }

  // Parse snap count data
  async parseSnapCounts($, gameInfo) {
    try {
      // Look for snap count data in various ESPN formats
      $('.snap-counts, .player-stats, .game-stats').each((i, section) => {
        const $section = $(section);
        
        $section.find('tr').each((j, row) => {
          const $row = $(row);
          const playerName = $row.find('.player-name, .name').text().trim();
          const snapCount = $row.find('.snaps, .snap-count').text().trim();
          
          if (playerName && snapCount && this.isWatchedPlayer(playerName)) {
            const currentSnaps = parseInt(snapCount) || 0;
            const playerKey = `${playerName}-${gameInfo.id}`;
            const lastSnaps = this.lastSnapCounts.get(playerKey) || 0;
            
            if (currentSnaps > lastSnaps + this.SNAP_COUNT_THRESHOLD) {
              this.sendSnapCountAlert(playerName, currentSnaps, lastSnaps, gameInfo);
            }
            
            this.lastSnapCounts.set(playerKey, currentSnaps);
          }
        });
      });
    } catch (error) {
      logger.debug('Error parsing snap counts:', error.message);
    }
  }

  // Parse target and reception data
  async parseTargetData($, gameInfo) {
    try {
      // Look for receiving stats
      $('.receiving-stats, .player-stats').each((i, section) => {
        const $section = $(section);
        
        $section.find('tr').each((j, row) => {
          const $row = $(row);
          const playerName = $row.find('.player-name, .name').text().trim();
          const targets = $row.find('.targets, .tgt').text().trim();
          const receptions = $row.find('.receptions, .rec').text().trim();
          
          if (playerName && targets && this.isWatchedPlayer(playerName)) {
            const currentTargets = parseInt(targets) || 0;
            const playerKey = `${playerName}-${gameInfo.id}`;
            const lastTargets = this.lastTargetShares.get(playerKey) || 0;
            
            if (currentTargets > lastTargets + this.TARGET_THRESHOLD) {
              this.sendTargetAlert(playerName, currentTargets, receptions, gameInfo);
            }
            
            this.lastTargetShares.set(playerKey, currentTargets);
          }
        });
      });
    } catch (error) {
      logger.debug('Error parsing target data:', error.message);
    }
  }

  // Parse red zone usage
  async parseRedZoneData($, gameInfo) {
    try {
      // Look for red zone mentions in play-by-play or stats
      $('.red-zone, .play-by-play, .scoring').each((i, section) => {
        const $section = $(section);
        const text = $section.text().toLowerCase();
        
        for (const player of this.watchedPlayers) {
          if (text.includes(player.toLowerCase()) && 
              (text.includes('red zone') || text.includes('goal line') || text.includes('td'))) {
            this.sendRedZoneAlert(player, gameInfo);
          }
        }
      });
    } catch (error) {
      logger.debug('Error parsing red zone data:', error.message);
    }
  }

  // Check for live injury updates
  async checkLiveInjuries($, gameInfo) {
    try {
      $('.injury, .questionable, .out').each((i, element) => {
        const $element = $(element);
        const text = $element.text().toLowerCase();
        
        for (const player of this.watchedPlayers) {
          if (text.includes(player.toLowerCase()) && 
              (text.includes('injury') || text.includes('questionable') || text.includes('out'))) {
            this.sendLiveInjuryAlert(player, text, gameInfo);
          }
        }
      });
    } catch (error) {
      logger.debug('Error checking live injuries:', error.message);
    }
  }

  // Check if player is being watched
  isWatchedPlayer(playerName) {
    const normalizedName = playerName.toLowerCase();
    return Array.from(this.watchedPlayers).some(watched => 
      normalizedName.includes(watched) || watched.includes(normalizedName)
    );
  }

  // Send game start alert
  async sendGameStartAlert(gameInfo) {
    const embed = {
      title: '🏈 LIVE GAME STARTED',
      description: `${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0x00FF00,
      fields: [
        {
          name: '📊 Score',
          value: `${gameInfo.awayTeam}: ${gameInfo.awayScore} | ${gameInfo.homeTeam}: ${gameInfo.homeScore}`,
          inline: true
        },
        {
          name: '⏰ Game Clock',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '🎯 Real-Time Tracking',
          value: `• Live scores and quarter updates\n• Player performance stats\n• Snap counts and targets\n• Red zone opportunities`,
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Preseason/Regular Season Tracking'
      }
    };

    await this.sendAlert(embed, '🏈 **LIVE GAME STARTED** - Real-time monitoring active');
  }

  // Send periodic game update (every quarter/score change)
  async sendGameUpdate(gameInfo, previousInfo = null) {
    const scoreChanged = previousInfo && 
      (gameInfo.homeScore !== previousInfo.homeScore || gameInfo.awayScore !== previousInfo.awayScore);
    const quarterChanged = previousInfo && gameInfo.quarter !== previousInfo.quarter;

    if (scoreChanged || quarterChanged) {
      const embed = {
        title: scoreChanged ? '📊 SCORE UPDATE' : '⏰ QUARTER UPDATE',
        description: `${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
        color: scoreChanged ? 0xFF8800 : 0x0099FF,
        fields: [
          {
            name: '📊 Live Score',
            value: `**${gameInfo.awayTeam}: ${gameInfo.awayScore}**\n**${gameInfo.homeTeam}: ${gameInfo.homeScore}**`,
            inline: true
          },
          {
            name: '⏰ Game Status',
            value: `Quarter ${gameInfo.quarter}\n${gameInfo.clock}`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Live Game Monitor • Real-time Updates'
        }
      };

      if (scoreChanged && previousInfo) {
        const awayDiff = parseInt(gameInfo.awayScore) - parseInt(previousInfo.awayScore);
        const homeDiff = parseInt(gameInfo.homeScore) - parseInt(previousInfo.homeScore);
        
        embed.fields.push({
          name: '🏈 Scoring Play',
          value: awayDiff > 0 ? `${gameInfo.awayTeam} +${awayDiff}` : `${gameInfo.homeTeam} +${homeDiff}`,
          inline: false
        });
      }

      await this.sendAlert(embed, scoreChanged ? '📊 **SCORE UPDATE**' : '⏰ **QUARTER UPDATE**');
    }
  }

  // Send player performance update
  async sendPlayerPerformanceUpdate(player, stats, gameInfo) {
    const embed = {
      title: '⭐ PLAYER PERFORMANCE',
      description: `**${player}** - ${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0x9932CC,
      fields: [
        {
          name: '📊 Live Stats',
          value: this.formatPlayerStats(stats),
          inline: true
        },
        {
          name: '⏰ Game Status',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '🎯 Fantasy Impact',
          value: this.analyzePerformance(stats),
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Performance Tracking'
      }
    };

    await this.sendAlert(embed, `⭐ **${player}** performing well`);
  }

  // Format player stats for display
  formatPlayerStats(stats) {
    const parts = [];
    
    if (stats.rushing) {
      parts.push(`🏃 **Rushing:** ${stats.rushing.carries} car, ${stats.rushing.yards} yds`);
    }
    if (stats.receiving) {
      parts.push(`🎯 **Receiving:** ${stats.receiving.targets} tgt, ${stats.receiving.receptions} rec, ${stats.receiving.yards} yds`);
    }
    if (stats.passing) {
      parts.push(`🏈 **Passing:** ${stats.passing.completions}/${stats.passing.attempts}, ${stats.passing.yards} yds`);
    }
    if (stats.snaps) {
      parts.push(`⚡ **Snaps:** ${stats.snaps}`);
    }
    
    return parts.length > 0 ? parts.join('\n') : 'Stats updating...';
  }

  // Analyze performance for fantasy impact
  analyzePerformance(stats) {
    const impacts = [];
    
    if (stats.receiving && stats.receiving.targets >= 3) {
      impacts.push('High target share - actively involved');
    }
    if (stats.rushing && stats.rushing.carries >= 5) {
      impacts.push('Getting significant carries');
    }
    if (stats.receiving && stats.receiving.yards >= 50) {
      impacts.push('Productive receiving performance');
    }
    if (stats.rushing && stats.rushing.yards >= 40) {
      impacts.push('Strong rushing output');
    }
    
    return impacts.length > 0 ? impacts.join('. ') : 'Monitor continued usage';
  }

  // Send snap count alert
  async sendSnapCountAlert(player, currentSnaps, lastSnaps, gameInfo) {
    const snapIncrease = currentSnaps - lastSnaps;
    
    const embed = {
      title: '📊 SNAP COUNT UPDATE',
      description: `**${player}** - ${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0x0099FF,
      fields: [
        {
          name: '🏃 Snap Count',
          value: `${currentSnaps} snaps (+${snapIncrease})`,
          inline: true
        },
        {
          name: '⏰ Game Status',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '🎯 Fantasy Impact',
          value: snapIncrease >= 10 ? 'High usage - excellent opportunity!' : 'Increased involvement',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Snap Count Tracking'
      }
    };

    await this.sendAlert(embed, `📊 **SNAP COUNT ALERT** - ${player} active`);
  }

  // Send target alert
  async sendTargetAlert(player, targets, receptions, gameInfo) {
    const embed = {
      title: '🎯 TARGET ALERT',
      description: `**${player}** - ${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0xFF8800,
      fields: [
        {
          name: '🎯 Targets',
          value: `${targets} targets`,
          inline: true
        },
        {
          name: '🏈 Receptions', 
          value: `${receptions || 'N/A'} catches`,
          inline: true
        },
        {
          name: '⏰ Game Status',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '📈 Fantasy Impact',
          value: 'Active in passing game - monitor for continued targets',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Target Tracking'
      }
    };

    await this.sendAlert(embed, `🎯 **TARGET ALERT** - ${player} getting looks`);
  }

  // Send red zone alert
  async sendRedZoneAlert(player, gameInfo) {
    const alertKey = `${player}-redzone-${gameInfo.id}-${Date.now()}`;
    
    // Prevent duplicate red zone alerts within 5 minutes
    if (this.gameAlerts.has(alertKey)) return;
    this.gameAlerts.set(alertKey, Date.now());

    const embed = {
      title: '🚨 RED ZONE OPPORTUNITY',
      description: `**${player}** - ${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0xFF0000,
      fields: [
        {
          name: '🏈 Red Zone Usage',
          value: 'Player involved in red zone play',
          inline: true
        },
        {
          name: '⏰ Game Status',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '🎯 Fantasy Impact',
          value: 'High-value scoring opportunity! Monitor for TD potential',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Red Zone Tracking'
      }
    };

    await this.sendAlert(embed, `🚨 **RED ZONE ALERT** - ${player} scoring opportunity`);
  }

  // Send live injury alert
  async sendLiveInjuryAlert(player, injuryText, gameInfo) {
    const embed = {
      title: '🚨 LIVE INJURY UPDATE',
      description: `**${player}** - ${gameInfo.awayTeam} @ ${gameInfo.homeTeam}`,
      color: 0xFF0000,
      fields: [
        {
          name: '🏥 Injury Report',
          value: injuryText.substring(0, 200),
          inline: false
        },
        {
          name: '⏰ Game Status',
          value: `Q${gameInfo.quarter} - ${gameInfo.clock}`,
          inline: true
        },
        {
          name: '⚠️ Fantasy Impact',
          value: 'CRITICAL: Monitor backup options and adjust lineup immediately!',
          inline: false
        }
      ],
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Live Game Monitor • Injury Tracking'
      }
    };

    await this.sendAlert(embed, `🚨 **LIVE INJURY ALERT** - ${player} status update`);
  }

  // Send alert to Discord webhook
  async sendAlert(embed, content) {
    if (!this.liveWebhookUrl) {
      logger.warn('No live webhook URL configured for alerts');
      return;
    }

    try {
      await axios.post(this.liveWebhookUrl, {
        content: content,
        embeds: [embed]
      });
      logger.info(`✅ Live game alert sent: ${embed.title}`);
    } catch (error) {
      logger.error('Failed to send live game alert:', error.message);
    }
  }

  // Get current monitoring status
  getStatus() {
    return {
      monitoring: this.isMonitoring,
      activeGames: this.activeGames.size,
      watchedPlayers: this.watchedPlayers.size,
      lastUpdate: new Date().toISOString(),
      gameDay: this.isGameDay(),
      webhookConfigured: !!this.liveWebhookUrl
    };
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    this.activeGames.clear();
    this.playerStats.clear();
    logger.info('⏹️ Live game monitoring stopped');
  }
}

module.exports = LiveGameMonitor;