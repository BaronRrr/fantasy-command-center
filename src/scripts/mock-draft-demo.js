const DraftMonitor = require('../services/draft-monitor');
const DiscordNotifier = require('../alerts/discord-bot');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class MockDraftDemo {
  constructor() {
    this.draftMonitor = new DraftMonitor();
    this.discordNotifier = new DiscordNotifier();
    this.currentPick = 1;
    this.isRunning = false;
  }

  async initialize() {
    logger.info('🏈 Setting up Mock Draft Demo...');
    
    // Setup mock ESPN client
    this.setupMockESPNClient();
    
    // Setup mock Claude AI
    this.setupMockClaudeAI();
    
    // Override the initialize method to use mock data
    this.draftMonitor.initialize = async () => {
      this.draftMonitor.draftData = {
        picks: [],
        teams: this.getMockTeams(),
        myTeamId: 6,
        draftOrder: this.getMockDraftOrder(),
        currentPick: null,
        isMyTurn: false,
        leagueInfo: {
          id: 'MOCK_123456',
          name: 'Demo Fantasy League 2025',
          size: 12,
          scoringType: 'PPR'
        }
      };
      this.draftMonitor.lastKnownPick = 0;
      this.draftMonitor.playerDatabase = new Map();
      this.draftMonitor.analysisCache = new Map();
      logger.info('Mock Draft Monitor initialized');
      return true;
    };
    
    await this.draftMonitor.initialize();
    this.setupEventHandlers();
    
    logger.info('✅ Mock Draft Demo ready!');
  }

  setupMockESPNClient() {
    this.draftMonitor.espnClient = {
      async getLeagueInfo() {
        return {
          id: 'MOCK_123456',
          name: 'Demo Fantasy League 2025',
          size: 12,
          scoringType: 'PPR',
          currentMatchupPeriod: 1,
          status: 'DRAFTING'
        };
      },

      async getDraftInfo() {
        const totalPicks = 12 * 16; // 12 teams, 16 rounds
        const picks = [];
        
        // Generate previous picks
        for (let i = 1; i < this.currentPick; i++) {
          const round = Math.ceil(i / 12);
          const pickInRound = ((i - 1) % 12) + 1;
          const teamId = ((i - 1) % 12) + 1;
          
          picks.push({
            overallPickNumber: i,
            round: round,
            pickInRound: pickInRound,
            playerId: 1000 + i,
            playerName: this.getMockPlayerName(i),
            teamId: teamId,
            position: this.getMockPosition(i)
          });
        }

        return {
          drafted: this.currentPick > totalPicks,
          inProgress: this.currentPick <= totalPicks,
          picks: picks,
          currentPick: {
            overall: this.currentPick,
            round: Math.ceil(this.currentPick / 12),
            pickInRound: ((this.currentPick - 1) % 12) + 1
          },
          draftOrder: this.getMockDraftOrder(),
          totalPicks: totalPicks
        };
      },

      async getRosters() {
        return this.getMockTeams();
      },

      async getPlayers() {
        return this.getMockAvailablePlayers();
      },

      async healthCheck() {
        return { status: 'connected', timestamp: new Date().toISOString() };
      }
    };
  }

  setupMockClaudeAI() {
    this.draftMonitor.claudeAI = {
      async analyzeDraftSituation(context) {
        const availablePlayers = context.availablePlayers || [];
        const currentPick = context.currentPick || { overall: this.currentPick };
        
        // Generate realistic recommendations based on pick number
        const recommendations = this.generateMockRecommendations(currentPick, availablePlayers);
        
        return {
          recommendations: recommendations,
          steals: [
            {
              player: 'Stefon Diggs',
              normalADP: 'Round 2 (Pick 18)',
              currentAvailability: 'Available now',
              reasoning: 'New team situation in Houston creates uncertainty, but elite talent remains. Could be massive value.'
            }
          ],
          threats: [
            {
              player: recommendations[0]?.player || 'Top Target',
              likelihood: 'HIGH',
              reasoning: 'Multiple teams have this position as top need. Likely gone in next 2-3 picks.'
            }
          ],
          strategy: {
            nextRound: this.getNextRoundStrategy(currentPick),
            reasoning: 'Focus on positional scarcity and value opportunities.'
          }
        };
      },

      async healthCheck() {
        return { status: 'connected', timestamp: new Date().toISOString() };
      }
    };
  }

  getMockPlayerName(pickNumber) {
    const players = [
      'Christian McCaffrey', 'Josh Allen', 'Cooper Kupp', 'Travis Kelce', 'Stefon Diggs',
      'Derrick Henry', 'Davante Adams', 'Aaron Rodgers', 'Saquon Barkley', 'Tyreek Hill',
      'Ezekiel Elliott', 'DeAndre Hopkins', 'Lamar Jackson', 'Alvin Kamara', 'Calvin Ridley',
      'Joe Burrow', 'Austin Ekeler', 'Keenan Allen', 'George Kittle', 'Justin Jefferson',
      'Jonathan Taylor', 'CeeDee Lamb', 'Dak Prescott', 'Nick Chubb', 'Mike Evans',
      'Russell Wilson', 'Dalvin Cook', 'Amari Cooper', 'Mark Andrews', 'Ja\'Marr Chase',
      'Kyler Murray', 'Joe Mixon', 'DK Metcalf', 'Darren Waller', 'Tee Higgins',
      'Patrick Mahomes', 'Leonard Fournette', 'Terry McLaurin', 'Kyle Pitts', 'Jaylen Waddle'
    ];
    return players[pickNumber - 1] || `Player ${pickNumber}`;
  }

  getMockPosition(pickNumber) {
    const positions = ['RB', 'QB', 'WR', 'TE', 'WR', 'RB', 'WR', 'QB', 'RB', 'WR'];
    return positions[(pickNumber - 1) % positions.length];
  }

  getMockDraftOrder() {
    const teams = [];
    for (let i = 1; i <= 12; i++) {
      teams.push({
        pickPosition: i,
        teamId: i,
        teamName: `Team ${i}`,
        owner: i === 6 ? 'You' : `Owner ${i}`
      });
    }
    return teams;
  }

  getMockTeams() {
    const teams = [];
    for (let i = 1; i <= 12; i++) {
      teams.push({
        id: i,
        name: `Team ${i}`,
        owner: i === 6 ? 'You' : `Owner ${i}`,
        roster: []
      });
    }
    return teams;
  }

  getMockAvailablePlayers() {
    return [
      {
        id: 2001, name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET',
        injuryStatus: 'ACTIVE', ownership: { percentOwned: 85, percentStarted: 75 }
      },
      {
        id: 2002, name: 'Breece Hall', position: 'RB', team: 'NYJ',
        injuryStatus: 'ACTIVE', ownership: { percentOwned: 90, percentStarted: 85 }
      },
      {
        id: 2003, name: 'Tua Tagovailoa', position: 'QB', team: 'MIA',
        injuryStatus: 'QUESTIONABLE', ownership: { percentOwned: 70, percentStarted: 60 }
      },
      {
        id: 2004, name: 'Dallas Goedert', position: 'TE', team: 'PHI',
        injuryStatus: 'ACTIVE', ownership: { percentOwned: 65, percentStarted: 55 }
      },
      {
        id: 2005, name: 'Chris Olave', position: 'WR', team: 'NO',
        injuryStatus: 'ACTIVE', ownership: { percentOwned: 80, percentStarted: 70 }
      }
    ];
  }

  generateMockRecommendations(currentPick, availablePlayers) {
    const recommendations = [];
    const pickNumber = currentPick.overall;
    
    if (pickNumber <= 24) { // Early rounds
      recommendations.push({
        player: 'Amon-Ra St. Brown',
        position: 'WR',
        team: 'DET',
        urgency: 'HIGH',
        reasoning: 'Elite target share in high-powered offense. Goff\'s favorite weapon with 140+ targets likely. Great value at this spot.',
        valueRating: 9,
        riskLevel: 'LOW'
      });
    } else if (pickNumber <= 60) { // Middle rounds
      recommendations.push({
        player: 'Breece Hall',
        position: 'RB',
        team: 'NYJ',
        urgency: 'CRITICAL',
        reasoning: 'RB1 upside with improved Jets offense. Aaron Rodgers should create more scoring opportunities. Rare RB value this late.',
        valueRating: 8,
        riskLevel: 'MEDIUM'
      });
    } else { // Late rounds
      recommendations.push({
        player: 'Tua Tagovailoa',
        position: 'QB',
        team: 'MIA',
        urgency: 'MEDIUM',
        reasoning: 'QB1 upside when healthy. New offensive coordinator could unlock ceiling. Great backup or streaming option.',
        valueRating: 7,
        riskLevel: 'HIGH'
      });
    }

    // Add second and third options
    recommendations.push({
      player: 'Dallas Goedert',
      position: 'TE',
      team: 'PHI',
      urgency: 'MEDIUM',
      reasoning: 'Consistent TE1 production in Eagles offense. Safety pick with solid floor.',
      valueRating: 7,
      riskLevel: 'LOW'
    });

    recommendations.push({
      player: 'Chris Olave',
      position: 'WR',
      team: 'NO',
      urgency: 'MEDIUM',
      reasoning: 'Breakout candidate with improved Saints passing attack. High ceiling play.',
      valueRating: 8,
      riskLevel: 'MEDIUM'
    });

    return recommendations;
  }

  getNextRoundStrategy(currentPick) {
    const round = Math.ceil(currentPick.overall / 12);
    
    if (round <= 3) return 'Secure RB/WR foundation';
    if (round <= 6) return 'Target positional value and upside';
    if (round <= 10) return 'Fill roster needs and handcuffs';
    return 'Lottery tickets and sleepers';
  }

  setupEventHandlers() {
    this.draftMonitor.on('newPick', async (pick) => {
      logger.info(`📋 PICK ${pick.overallPickNumber}: ${pick.player.name} (${pick.player.position}) → ${pick.teamName}`);
      
      await this.discordNotifier.sendDraftAlert({
        type: 'NEW_PICK',
        urgency: 'MEDIUM',
        data: pick
      });
    });

    this.draftMonitor.on('myTurn', async (data) => {
      logger.info('🚨 YOUR TURN! 🚨');
      
      await this.discordNotifier.sendDraftAlert({
        type: 'MY_TURN',
        urgency: 'CRITICAL',
        data: data
      });
    });

    this.draftMonitor.on('turnApproaching', async (data) => {
      logger.info(`⏰ Your turn in ${data.picksUntilTurn} picks`);
      
      await this.discordNotifier.sendDraftAlert({
        type: 'TURN_APPROACHING',
        urgency: 'HIGH',
        data: data
      });
    });

    this.draftMonitor.on('aiRecommendations', async (recommendations) => {
      logger.info(`🤖 AI Analysis: ${recommendations.recommendations?.length || 0} recommendations`);
      
      if (recommendations.recommendations?.length > 0) {
        const top = recommendations.recommendations[0];
        logger.info(`   Top Pick: ${top.player} (${top.urgency}) - ${top.reasoning.substring(0, 80)}...`);
        
        await this.discordNotifier.sendDraftAlert({
          type: 'AI_RECOMMENDATIONS',
          urgency: 'HIGH',
          data: recommendations
        });
      }
    });
  }

  async runMockDraft() {
    if (this.isRunning) {
      logger.warn('Mock draft already running!');
      return;
    }

    this.isRunning = true;
    logger.info('🎯 Starting Mock Draft Simulation...');
    logger.info('   You are Team 6 - picks 6, 19, 30, 43, etc.');
    logger.info('   Press Ctrl+C to stop\n');

    // Set your team ID to 6 for demo
    this.draftMonitor.draftData.myTeamId = 6;

    const totalPicks = 12 * 16;
    
    while (this.currentPick <= totalPicks && this.isRunning) {
      try {
        // Check if it's your turn (team 6)
        const round = Math.ceil(this.currentPick / 12);
        const pickInRound = ((this.currentPick - 1) % 12) + 1;
        const isSnakeRound = round % 2 === 0;
        
        let currentTeamPosition;
        if (isSnakeRound) {
          currentTeamPosition = 12 - pickInRound + 1;
        } else {
          currentTeamPosition = pickInRound;
        }
        
        const isMyTurn = currentTeamPosition === 6;
        const picksUntilMyTurn = this.calculatePicksUntilMyTurn();

        // Warn when turn is approaching
        if (picksUntilMyTurn <= 3 && picksUntilMyTurn > 0 && !this.draftMonitor.draftData.isMyTurn) {
          this.draftMonitor.emit('turnApproaching', {
            picksUntilTurn: picksUntilMyTurn,
            currentPick: { overall: this.currentPick, round: round, pickInRound: pickInRound },
            preparationTime: picksUntilMyTurn * 90
          });
        }

        // Handle your turn
        if (isMyTurn) {
          this.draftMonitor.draftData.isMyTurn = true;
          
          const mockPickData = {
            pick: { overall: this.currentPick, round: round, pickInRound: pickInRound },
            availablePlayers: await this.draftMonitor.espnClient.getPlayers(),
            timeToDecide: 90
          };
          
          this.draftMonitor.emit('myTurn', mockPickData);
          
          // Generate AI recommendations
          await this.draftMonitor.generateAIRecommendations(mockPickData.pick, 0);
          
          // Wait for "decision time"
          logger.info('   ⏰ You have 90 seconds to decide...');
          await this.sleep(3000); // 3 seconds for demo
          
          this.draftMonitor.draftData.isMyTurn = false;
        }

        // Simulate the pick being made
        const mockPick = {
          overallPickNumber: this.currentPick,
          round: round,
          pickInRound: pickInRound,
          playerId: 1000 + this.currentPick,
          playerName: this.getMockPlayerName(this.currentPick),
          teamId: currentTeamPosition,
          position: this.getMockPosition(this.currentPick),
          player: {
            id: 1000 + this.currentPick,
            name: this.getMockPlayerName(this.currentPick),
            position: this.getMockPosition(this.currentPick),
            team: 'NFL',
            injuryStatus: 'ACTIVE'
          },
          teamName: `Team ${currentTeamPosition}`,
          timestamp: new Date()
        };

        this.draftMonitor.emit('newPick', mockPick);
        
        this.currentPick++;
        
        // Wait between picks (faster for demo)
        await this.sleep(2000); // 2 seconds between picks

      } catch (error) {
        logger.error('Error in mock draft:', error.message);
        break;
      }
    }

    this.isRunning = false;
    logger.info('\n🏁 Mock Draft Complete!');
    logger.info('💡 You can now test with your real league when draft starts!');
  }

  calculatePicksUntilMyTurn() {
    const myPosition = 6;
    const currentRound = Math.ceil(this.currentPick / 12);
    const currentPickInRound = ((this.currentPick - 1) % 12) + 1;
    
    let picksUntilMyTurn = 0;
    let round = currentRound;
    let pickInRound = currentPickInRound;

    while (true) {
      const isSnakeRound = round % 2 === 0;
      const adjustedPosition = isSnakeRound ? 12 - pickInRound + 1 : pickInRound;
      
      if (adjustedPosition === myPosition) {
        break;
      }

      picksUntilMyTurn++;
      pickInRound++;
      
      if (pickInRound > 12) {
        round++;
        pickInRound = 1;
      }

      if (picksUntilMyTurn > 50) break; // Safety
    }

    return picksUntilMyTurn;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
    logger.info('🛑 Mock draft stopped');
  }
}

// Run if executed directly
if (require.main === module) {
  const demo = new MockDraftDemo();
  
  demo.initialize().then(() => {
    return demo.runMockDraft();
  }).catch(error => {
    logger.error('Demo failed:', error.message);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\n🛑 Stopping mock draft...');
    demo.stop();
    process.exit(0);
  });
}

module.exports = MockDraftDemo;