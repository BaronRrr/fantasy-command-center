const ESPNClient = require('../api/espn-client');
const ClaudeAI = require('../api/claude-ai');
const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
const config = require('../../config');
const winston = require('winston');
const EventEmitter = require('events');

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

class DraftMonitor extends EventEmitter {
  constructor() {
    super();
    this.espnClient = new ESPNClient();
    this.claudeAI = new ClaudeAI();
    this.knowledgeEnhancer = new FantasyKnowledgeEnhancer();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.lastKnownPick = 0;
    this.draftData = {
      picks: [],
      teams: [],
      myTeamId: null,
      draftOrder: [],
      currentPick: null,
      isMyTurn: false
    };
    this.playerDatabase = new Map();
    this.analysisCache = new Map();
  }

  async initialize() {
    try {
      logger.info('Initializing Draft Monitor...');
      
      await this.loadLeagueData();
      await this.loadPlayerData();
      await this.identifyMyTeam();
      
      logger.info('Draft Monitor initialized successfully');
      this.emit('initialized', { 
        leagueInfo: this.draftData.leagueInfo,
        myTeamId: this.draftData.myTeamId 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize Draft Monitor:', error.message);
      this.emit('error', error);
      throw error;
    }
  }

  async loadLeagueData() {
    try {
      const leagueInfo = await this.espnClient.getLeagueInfo();
      const draftInfo = await this.espnClient.getDraftInfo();
      const rosters = await this.espnClient.getRosters();

      this.draftData.leagueInfo = leagueInfo;
      this.draftData.draftInfo = draftInfo;
      this.draftData.teams = rosters;
      this.draftData.picks = draftInfo.picks || [];
      this.draftData.draftOrder = draftInfo.draftOrder || [];
      
      if (this.draftData.picks.length > 0) {
        this.lastKnownPick = Math.max(...this.draftData.picks.map(p => p.overallPickNumber));
      }

      logger.info(`Loaded league data: ${leagueInfo.name} (${leagueInfo.size} teams)`);
    } catch (error) {
      logger.error('Failed to load league data:', error.message);
      throw error;
    }
  }

  async loadPlayerData() {
    try {
      const players = await this.espnClient.getPlayers(1000);
      
      players.forEach(player => {
        this.playerDatabase.set(player.id, {
          ...player,
          adp: this.estimateADP(player),
          projectedPoints: this.getProjectedPoints(player),
          lastUpdated: new Date()
        });
      });

      logger.info(`Loaded ${this.playerDatabase.size} players into database`);
    } catch (error) {
      logger.error('Failed to load player data:', error.message);
      throw error;
    }
  }

  async identifyMyTeam() {
    try {
      if (!this.draftData.teams || this.draftData.teams.length === 0) {
        throw new Error('No team data available to identify user team');
      }

      if (this.draftData.teams.length === 1) {
        this.draftData.myTeamId = this.draftData.teams[0].id;
        logger.info(`Identified my team: ${this.draftData.teams[0].name}`);
        return;
      }

      const userTeam = this.draftData.teams.find(team => 
        team.owner && team.owner.toLowerCase().includes('user')
      );

      if (userTeam) {
        this.draftData.myTeamId = userTeam.id;
        logger.info(`Identified my team: ${userTeam.name}`);
      } else {
        logger.warn('Could not automatically identify user team - manual selection may be required');
        this.draftData.myTeamId = this.draftData.teams[0].id;
      }
    } catch (error) {
      logger.error('Failed to identify my team:', error.message);
      throw error;
    }
  }

  startMonitoring() {
    if (this.isMonitoring) {
      logger.warn('Draft monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const interval = config.draft.monitorInterval || 5000;
    
    logger.info(`Starting draft monitoring with ${interval}ms interval`);
    this.emit('monitoringStarted', { interval });

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewPicks();
      } catch (error) {
        logger.error('Error during draft monitoring:', error.message);
        this.emit('monitoringError', error);
      }
    }, interval);
  }

  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    logger.info('Draft monitoring stopped');
    this.emit('monitoringStopped');
  }

  async checkForNewPicks() {
    try {
      const draftInfo = await this.espnClient.getDraftInfo();
      const newPicks = draftInfo.picks || [];

      if (newPicks.length === 0) {
        return;
      }

      const latestPickNumber = Math.max(...newPicks.map(p => p.overallPickNumber));
      
      if (latestPickNumber > this.lastKnownPick) {
        const newPicksToProcess = newPicks.filter(
          pick => pick.overallPickNumber > this.lastKnownPick
        );

        for (const pick of newPicksToProcess) {
          await this.processPick(pick);
        }

        this.lastKnownPick = latestPickNumber;
        this.draftData.picks = newPicks;
        
        await this.checkIfMyTurn(draftInfo);
      }

      this.draftData.currentPick = draftInfo.currentPick;
    } catch (error) {
      logger.error('Error checking for new picks:', error.message);
      throw error;
    }
  }

  async processPick(pick) {
    try {
      const player = this.playerDatabase.get(pick.playerId) || {
        id: pick.playerId,
        name: pick.playerName || 'Unknown Player',
        position: pick.position || 'UNKNOWN',
        team: pick.team || 'FA'
      };

      const team = this.draftData.teams.find(t => t.id === pick.teamId);
      const teamName = team ? team.name : `Team ${pick.teamId}`;

      const processedPick = {
        ...pick,
        player: player,
        teamName: teamName,
        timestamp: new Date(),
        round: Math.ceil(pick.overallPickNumber / this.draftData.leagueInfo.size),
        pickInRound: ((pick.overallPickNumber - 1) % this.draftData.leagueInfo.size) + 1
      };

      logger.info(
        `NEW PICK: ${pick.overallPickNumber}. ${player.name} (${player.position}) ` +
        `to ${teamName} - Round ${processedPick.round}, Pick ${processedPick.pickInRound}`
      );

      this.emit('newPick', processedPick);

      this.playerDatabase.delete(pick.playerId);

    } catch (error) {
      logger.error('Error processing pick:', error.message);
      throw error;
    }
  }

  async checkIfMyTurn(draftInfo) {
    if (!draftInfo.currentPick || !this.draftData.myTeamId) {
      return;
    }

    const currentPick = draftInfo.currentPick;
    const myPickPosition = this.getMyDraftPosition();
    
    if (!myPickPosition) {
      return;
    }

    const round = currentPick.round;
    const isSnakeRound = round % 2 === 0;
    
    let currentTeamPosition;
    if (isSnakeRound) {
      currentTeamPosition = this.draftData.leagueInfo.size - currentPick.pickInRound + 1;
    } else {
      currentTeamPosition = currentPick.pickInRound;
    }

    const isMyTurn = currentTeamPosition === myPickPosition;
    const picksUntilMyTurn = this.calculatePicksUntilMyTurn(currentPick, myPickPosition);

    if (isMyTurn && !this.draftData.isMyTurn) {
      this.draftData.isMyTurn = true;
      logger.info('🚨 IT\'S MY TURN TO PICK! 🚨');
      this.emit('myTurn', {
        pick: currentPick,
        availablePlayers: Array.from(this.playerDatabase.values()),
        timeToDecide: this.estimateDecisionTime()
      });

      if (config.draft.aiRecommendationEnabled) {
        await this.generateAIRecommendations(currentPick);
      }
    } else if (!isMyTurn && this.draftData.isMyTurn) {
      this.draftData.isMyTurn = false;
      this.emit('turnEnded');
    }

    if (picksUntilMyTurn <= 3 && picksUntilMyTurn > 0) {
      this.emit('turnApproaching', {
        picksUntilTurn: picksUntilMyTurn,
        currentPick: currentPick,
        preparationTime: picksUntilMyTurn * 90
      });

      if (config.draft.aiRecommendationEnabled) {
        await this.generateAIRecommendations(currentPick, picksUntilMyTurn);
      }
    }
  }

  getMyDraftPosition() {
    if (!this.draftData.draftOrder || !this.draftData.myTeamId) {
      return null;
    }

    const myOrder = this.draftData.draftOrder.find(order => order.teamId === this.draftData.myTeamId);
    return myOrder ? myOrder.pickPosition : null;
  }

  calculatePicksUntilMyTurn(currentPick, myPosition) {
    const leagueSize = this.draftData.leagueInfo.size;
    const currentRound = currentPick.round;
    const currentPickInRound = currentPick.pickInRound;
    
    const isCurrentRoundSnake = currentRound % 2 === 0;
    let currentPosition = isCurrentRoundSnake ? 
      leagueSize - currentPickInRound + 1 : 
      currentPickInRound;

    if (currentPosition === myPosition) {
      return 0;
    }

    let picksUntilMyTurn = 0;
    let round = currentRound;
    let position = currentPosition;

    while (true) {
      position++;
      picksUntilMyTurn++;

      const isSnakeRound = round % 2 === 0;
      
      if ((isSnakeRound && position > leagueSize) || (!isSnakeRound && position > leagueSize)) {
        round++;
        position = 1;
      }

      const adjustedPosition = (round % 2 === 0) ? leagueSize - position + 1 : position;
      
      if (adjustedPosition === myPosition) {
        break;
      }

      if (picksUntilMyTurn > 50) {
        break;
      }
    }

    return picksUntilMyTurn;
  }

  async generateAIRecommendations(currentPick, picksUntilMyTurn = 0) {
    try {
      const cacheKey = `${currentPick.overall}-${this.draftData.myTeamId}`;
      
      if (this.analysisCache.has(cacheKey)) {
        const cached = this.analysisCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) {
          this.emit('aiRecommendations', cached.recommendations);
          return cached.recommendations;
        }
      }

      logger.info('Generating AI recommendations...');

      const myTeam = this.draftData.teams.find(t => t.id === this.draftData.myTeamId);
      const otherTeams = this.draftData.teams.filter(t => t.id !== this.draftData.myTeamId);
      const availablePlayers = Array.from(this.playerDatabase.values())
        .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
        .slice(0, 50);

      const recentPicks = this.draftData.picks
        .slice(-10)
        .map(pick => ({
          ...pick,
          playerName: this.playerDatabase.get(pick.playerId)?.name || pick.playerName,
          position: this.playerDatabase.get(pick.playerId)?.position || 'UNKNOWN',
          teamName: this.draftData.teams.find(t => t.id === pick.teamId)?.name || `Team ${pick.teamId}`
        }));

      // Gather enhanced context from knowledge base
      const knowledgeContext = await this.gatherKnowledgeContext(currentPick, availablePlayers);

      const context = {
        currentPick: currentPick,
        myTeam: myTeam,
        availablePlayers: availablePlayers,
        recentPicks: recentPicks,
        leagueSettings: {
          size: this.draftData.leagueInfo.size,
          scoringType: this.draftData.leagueInfo.scoringType,
          draftRounds: 16,
          rosterPositions: config.league.rosterPositions
        },
        otherTeams: otherTeams,
        picksUntilNext: picksUntilMyTurn,
        // Enhanced with knowledge base
        knowledgeBase: knowledgeContext.articles,
        draftComparisons: knowledgeContext.comparisons,
        strategyGuidance: knowledgeContext.strategy
      };

      const recommendations = await this.claudeAI.analyzeDraftSituation(context);
      
      const cached = {
        recommendations: recommendations,
        timestamp: Date.now()
      };
      this.analysisCache.set(cacheKey, cached);

      logger.info(`Generated ${recommendations.recommendations?.length || 0} AI recommendations`);
      this.emit('aiRecommendations', recommendations);

      return recommendations;
    } catch (error) {
      logger.error('Failed to generate AI recommendations:', error.message);
      this.emit('aiError', error);
      
      return {
        recommendations: [],
        error: error.message,
        fallbackMessage: 'AI analysis temporarily unavailable - use manual rankings'
      };
    }
  }

  async gatherKnowledgeContext(currentPick, availablePlayers) {
    try {
      const round = Math.ceil(currentPick.overall / (this.draftData.leagueInfo.size || 12));
      const scoringType = this.draftData.leagueInfo.scoringType || 'PPR';
      
      // Search for relevant strategy articles
      const strategyQuery = `round ${round} draft strategy ${scoringType}`;
      const strategyArticles = await this.knowledgeEnhancer.searchKnowledge(strategyQuery, 'strategy');
      
      // Get draft comparisons for top available players
      const playerComparisons = {};
      const topPlayers = availablePlayers.slice(0, 10);
      
      for (const player of topPlayers) {
        try {
          const comparisons = await this.knowledgeEnhancer.getPlayerDraftComparison(player.name);
          if (comparisons.length > 0) {
            playerComparisons[player.name] = {
              avgPick: comparisons.reduce((sum, c) => sum + c.overall, 0) / comparisons.length,
              avgValue: comparisons.reduce((sum, c) => sum + c.value, 0) / comparisons.length,
              totalDrafts: comparisons.length
            };
          }
        } catch (error) {
          logger.debug(`No draft comparison for ${player.name}: ${error.message}`);
        }
      }
      
      // Get positional strategy guidance
      const positionQuery = round <= 3 ? 'early round strategy' : 
                           round <= 8 ? 'middle round strategy' : 
                           'late round strategy';
      const positionArticles = await this.knowledgeEnhancer.searchKnowledge(positionQuery);
      
      // Get fundamentals for context
      const fundamentalsQuery = `${scoringType} scoring fundamentals`;
      const fundamentalsArticles = await this.knowledgeEnhancer.searchKnowledge(fundamentalsQuery, 'fundamentals');
      
      return {
        articles: [...strategyArticles, ...positionArticles, ...fundamentalsArticles].slice(0, 5).map(article => ({
          title: article.title || article.source,
          content: article.content?.substring(0, 500) || 'Strategy guidance available',
          source: article.source,
          relevance: article.relevance
        })),
        comparisons: playerComparisons,
        strategy: {
          currentRound: round,
          scoringType: scoringType,
          leagueSize: this.draftData.leagueInfo.size,
          roundGuidance: this.getRoundSpecificGuidance(round, scoringType)
        }
      };
    } catch (error) {
      logger.error('Failed to gather knowledge context:', error.message);
      return {
        articles: [],
        comparisons: {},
        strategy: {}
      };
    }
  }

  getRoundSpecificGuidance(round, scoringType) {
    if (round <= 3) {
      return {
        focus: 'Elite players with consistent production',
        positions: scoringType === 'PPR' ? ['RB', 'WR', 'TE'] : ['RB', 'WR'],
        avoid: 'Risky players, unproven rookies',
        strategy: 'Build foundation with proven commodities'
      };
    } else if (round <= 6) {
      return {
        focus: 'Positional value and upside',
        positions: ['RB', 'WR', 'TE', 'QB'],
        avoid: 'Reaching for QB too early',
        strategy: 'Target positional scarcity, secure starter-quality players'
      };
    } else if (round <= 10) {
      return {
        focus: 'Fill roster needs and handcuffs',
        positions: ['All positions'],
        avoid: 'Players without clear role',
        strategy: 'Handcuff your RBs, target late-round QB value'
      };
    } else {
      return {
        focus: 'Lottery tickets and sleepers',
        positions: ['High-upside players'],
        avoid: 'Safe floor players',
        strategy: 'Swing for ceiling, target breakout candidates'
      };
    }
  }

  estimateADP(player) {
    const positionADPs = {
      'QB': { elite: 40, good: 80, average: 120 },
      'RB': { elite: 15, good: 35, average: 70 },
      'WR': { elite: 20, good: 45, average: 85 },
      'TE': { elite: 35, good: 65, average: 100 },
      'K': { elite: 140, good: 155, average: 170 },
      'DST': { elite: 130, good: 150, average: 165 }
    };

    const position = player.position;
    const ownership = player.ownership?.percentOwned || 0;

    if (!positionADPs[position]) {
      return 180;
    }

    const adpRanges = positionADPs[position];
    
    if (ownership > 90) return adpRanges.elite;
    if (ownership > 60) return adpRanges.good;
    return adpRanges.average;
  }

  getProjectedPoints(player) {
    if (player.projections?.appliedTotal) {
      return player.projections.appliedTotal;
    }

    const positionBaselines = {
      'QB': 280, 'RB': 180, 'WR': 160, 'TE': 120, 'K': 120, 'DST': 130
    };

    return positionBaselines[player.position] || 100;
  }

  estimateDecisionTime() {
    return 90;
  }

  async getAvailablePlayersByPosition(position, limit = 10) {
    const players = Array.from(this.playerDatabase.values())
      .filter(player => player.position === position)
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, limit);

    return players;
  }

  async searchPlayers(query, limit = 20) {
    const searchTerm = query.toLowerCase();
    const players = Array.from(this.playerDatabase.values())
      .filter(player => 
        player.name.toLowerCase().includes(searchTerm) ||
        player.team.toLowerCase().includes(searchTerm) ||
        player.position.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, limit);

    return players;
  }

  getDraftStatus() {
    return {
      isMonitoring: this.isMonitoring,
      lastKnownPick: this.lastKnownPick,
      totalPicks: this.draftData.picks.length,
      currentPick: this.draftData.currentPick,
      isMyTurn: this.draftData.isMyTurn,
      myTeamId: this.draftData.myTeamId,
      availablePlayerCount: this.playerDatabase.size,
      leagueInfo: this.draftData.leagueInfo
    };
  }

  async refreshData() {
    try {
      logger.info('Refreshing draft data...');
      await this.loadLeagueData();
      await this.loadPlayerData();
      this.emit('dataRefreshed');
      logger.info('Draft data refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh draft data:', error.message);
      throw error;
    }
  }
}

module.exports = DraftMonitor;