const DraftMonitor = require('../services/draft-monitor');
const DiscordNotifier = require('../alerts/discord-bot');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class DraftMonitorTest {
  constructor() {
    this.draftMonitor = new DraftMonitor();
    this.discordNotifier = new DiscordNotifier();
  }

  async runTests() {
    logger.info('🧪 Starting Draft Monitor Tests...');

    try {
      await this.testDraftMonitorInitialization();
      await this.testMockDraftScenario();
      await this.testAIRecommendations();
      await this.testDiscordNotifications();
      
      logger.info('✅ All tests completed successfully!');
    } catch (error) {
      logger.error('❌ Test failed:', error.message);
      throw error;
    }
  }

  async testDraftMonitorInitialization() {
    logger.info('🔧 Testing Draft Monitor Initialization...');

    // Mock ESPN client to avoid real API calls during testing
    this.draftMonitor.espnClient = {
      async getLeagueInfo() {
        return {
          id: 123456,
          name: 'Test Fantasy League',
          size: 12,
          scoringType: 'PPR',
          currentMatchupPeriod: 1,
          status: 'ACTIVE'
        };
      },

      async getDraftInfo() {
        return {
          drafted: false,
          inProgress: true,
          picks: [
            { overallPickNumber: 1, playerId: 1001, playerName: 'Christian McCaffrey', teamId: 1, position: 'RB' },
            { overallPickNumber: 2, playerId: 1002, playerName: 'Josh Allen', teamId: 2, position: 'QB' }
          ],
          currentPick: { overall: 3, round: 1, pickInRound: 3 },
          draftOrder: [
            { pickPosition: 1, teamId: 1, teamName: 'Team Alpha', owner: 'User1' },
            { pickPosition: 2, teamId: 2, teamName: 'Team Beta', owner: 'User2' },
            { pickPosition: 3, teamId: 3, teamName: 'My Team', owner: 'TestUser' }
          ],
          totalPicks: 192
        };
      },

      async getRosters() {
        return [
          {
            id: 1,
            name: 'Team Alpha',
            owner: 'User1',
            roster: [{ playerId: 1001, slot: 'RB', player: { name: 'Christian McCaffrey', position: 'RB', team: 'SF' } }]
          },
          {
            id: 2,
            name: 'Team Beta', 
            owner: 'User2',
            roster: [{ playerId: 1002, slot: 'QB', player: { name: 'Josh Allen', position: 'QB', team: 'BUF' } }]
          },
          {
            id: 3,
            name: 'My Team',
            owner: 'TestUser',
            roster: []
          }
        ];
      },

      async getPlayers() {
        return [
          {
            id: 2001,
            name: 'Cooper Kupp',
            position: 'WR',
            team: 'LAR',
            injuryStatus: 'ACTIVE',
            ownership: { percentOwned: 95, percentStarted: 85 }
          },
          {
            id: 2002,
            name: 'Travis Kelce',
            position: 'TE',
            team: 'KC',
            injuryStatus: 'ACTIVE',
            ownership: { percentOwned: 98, percentStarted: 90 }
          },
          {
            id: 2003,
            name: 'Stefon Diggs',
            position: 'WR',
            team: 'HOU',
            injuryStatus: 'ACTIVE',
            ownership: { percentOwned: 92, percentStarted: 88 }
          }
        ];
      },

      async healthCheck() {
        return { status: 'connected', timestamp: new Date().toISOString() };
      }
    };

    // Mock Claude AI to avoid real API calls
    this.draftMonitor.claudeAI = {
      async analyzeDraftSituation(context) {
        return {
          recommendations: [
            {
              player: 'Cooper Kupp',
              position: 'WR',
              team: 'LAR',
              urgency: 'HIGH',
              reasoning: 'Elite WR1 with proven track record, great value at this pick',
              valueRating: 9,
              riskLevel: 'LOW'
            },
            {
              player: 'Travis Kelce',
              position: 'TE',
              team: 'KC',
              urgency: 'MEDIUM',
              reasoning: 'Best TE available, would secure the position early',
              valueRating: 8,
              riskLevel: 'LOW'
            }
          ],
          steals: [
            {
              player: 'Stefon Diggs',
              normalADP: 'Round 2',
              currentAvailability: 'Available now',
              reasoning: 'New team situation creates uncertainty but talent remains elite'
            }
          ],
          threats: [
            {
              player: 'Cooper Kupp',
              likelihood: 'HIGH',
              reasoning: 'Multiple teams need WR1, likely to be taken soon'
            }
          ],
          strategy: {
            nextRound: 'Target RB depth or elite TE',
            reasoning: 'With WR locked up, focus on positional scarcity'
          }
        };
      },

      async healthCheck() {
        return { status: 'connected', timestamp: new Date().toISOString() };
      }
    };

    await this.draftMonitor.initialize();
    
    const status = this.draftMonitor.getDraftStatus();
    logger.info('Draft status:', status);
    
    if (status.myTeamId === 3 && status.availablePlayerCount > 0) {
      logger.info('✅ Draft Monitor initialized successfully');
    } else {
      throw new Error('Draft Monitor initialization failed');
    }
  }

  async testMockDraftScenario() {
    logger.info('🎯 Testing Mock Draft Scenario...');

    let pickDetected = false;
    let turnDetected = false;
    let recommendationsGenerated = false;

    this.draftMonitor.on('newPick', (pick) => {
      logger.info(`📋 New pick detected: ${pick.player.name} (${pick.player.position}) to ${pick.teamName}`);
      pickDetected = true;
    });

    this.draftMonitor.on('myTurn', (data) => {
      logger.info(`🚨 My turn detected! Pick ${data.pick.overall}`);
      turnDetected = true;
    });

    this.draftMonitor.on('aiRecommendations', (recommendations) => {
      logger.info(`🤖 AI recommendations: ${recommendations.recommendations?.length || 0} options`);
      recommendationsGenerated = true;
    });

    // Simulate a new pick being made
    const mockPick = {
      overallPickNumber: 3,
      playerId: 2001,
      playerName: 'Cooper Kupp',
      teamId: 3,
      position: 'WR'
    };

    await this.draftMonitor.processPick(mockPick);

    // Simulate it being my turn
    const mockCurrentPick = {
      overall: 4,
      round: 1,
      pickInRound: 4
    };

    await this.draftMonitor.checkIfMyTurn({
      currentPick: mockCurrentPick,
      picks: [mockPick]
    });

    if (pickDetected) {
      logger.info('✅ Pick detection working');
    } else {
      logger.warn('⚠️ Pick detection not triggered');
    }

    if (recommendationsGenerated) {
      logger.info('✅ AI recommendations working');
    } else {
      logger.warn('⚠️ AI recommendations not generated');
    }
  }

  async testAIRecommendations() {
    logger.info('🤖 Testing AI Recommendations...');

    const mockContext = {
      overall: 4,
      round: 1,
      pickInRound: 4
    };

    const recommendations = await this.draftMonitor.generateAIRecommendations(mockContext, 0);
    
    if (recommendations && recommendations.recommendations && recommendations.recommendations.length > 0) {
      logger.info('✅ AI recommendations generated successfully');
      logger.info(`Top recommendation: ${recommendations.recommendations[0].player} (${recommendations.recommendations[0].urgency})`);
    } else {
      throw new Error('AI recommendations failed to generate');
    }
  }

  async testDiscordNotifications() {
    logger.info('💬 Testing Discord Notifications...');

    // Test basic notification
    const testResult = await this.discordNotifier.testConnection();
    
    if (testResult.success) {
      logger.info('✅ Discord connection test successful');
    } else {
      logger.warn('⚠️ Discord connection test failed - webhook may not be configured');
    }

    // Test draft alerts
    await this.discordNotifier.sendDraftAlert({
      type: 'NEW_PICK',
      urgency: 'MEDIUM',
      data: {
        player: { name: 'Cooper Kupp', position: 'WR', team: 'LAR', injuryStatus: 'ACTIVE' },
        teamName: 'Test Team',
        overallPickNumber: 24,
        round: 2,
        pickInRound: 12
      }
    });

    await this.discordNotifier.sendDraftAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: [
          {
            player: 'Travis Kelce',
            position: 'TE',
            urgency: 'HIGH',
            valueRating: 9,
            riskLevel: 'LOW',
            reasoning: 'Elite TE option, significant positional advantage'
          }
        ]
      }
    });

    logger.info('✅ Discord notification tests completed');
  }

  async cleanup() {
    if (this.draftMonitor.isMonitoring) {
      this.draftMonitor.stopMonitoring();
    }
    logger.info('🧹 Test cleanup completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new DraftMonitorTest();
  
  tester.runTests()
    .then(() => {
      logger.info('🎉 All tests passed!');
      tester.cleanup();
      process.exit(0);
    })
    .catch((error) => {
      logger.error('💥 Tests failed:', error.message);
      tester.cleanup();
      process.exit(1);
    });
}

module.exports = DraftMonitorTest;