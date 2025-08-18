const ESPNClient = require('../api/espn-client');
const DiscordNotifier = require('../alerts/discord-bot');
const { channelRouter } = require('../../config/discord-channels');
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

class LeagueIntelligence {
  constructor() {
    this.espnClient = new ESPNClient();
    this.discordNotifier = new DiscordNotifier();
    this.leagueData = {
      teams: [],
      draftOrder: [],
      historicalPatterns: {},
      ownerTendencies: {}
    };
  }

  async initialize() {
    try {
      logger.info('🕵️ Initializing League Intelligence...');
      
      await this.loadLeagueSetup();
      await this.analyzeHistoricalPatterns();
      await this.sendLeagueSetupAlert();
      
      logger.info('✅ League Intelligence initialized');
      return true;
    } catch (error) {
      logger.error('Failed to initialize League Intelligence:', error.message);
      throw error;
    }
  }

  async loadLeagueSetup() {
    try {
      const leagueInfo = await this.espnClient.getLeagueInfo();
      const teams = await this.espnClient.getRosters();
      const draftInfo = await this.espnClient.getDraftInfo();

      this.leagueData = {
        leagueInfo: leagueInfo,
        teams: teams,
        draftOrder: draftInfo.draftOrder,
        myTeamId: this.identifyMyTeam(teams),
        draftStarted: draftInfo.inProgress
      };

      logger.info(`League loaded: ${leagueInfo.name} (${leagueInfo.size} teams)`);
    } catch (error) {
      logger.error('Failed to load league setup:', error.message);
      throw error;
    }
  }

  identifyMyTeam(teams) {
    // Try to identify user's team (you could enhance this with more logic)
    const myTeam = teams.find(team => 
      team.owner && (
        team.owner.toLowerCase().includes('user') ||
        team.owner.toLowerCase().includes('you') ||
        team.name.toLowerCase().includes('my')
      )
    );
    return myTeam ? myTeam.id : teams[0]?.id;
  }

  async analyzeHistoricalPatterns() {
    // This would analyze past drafts if available
    // For now, we'll create mock historical data
    this.leagueData.historicalPatterns = {
      earlyQBTeams: [3, 8], // Teams that historically draft QB early
      rbHeavyTeams: [1, 7, 11], // Teams that load up on RBs
      sleeperhunters: [12, 4], // Teams that love late-round flyers
      tradingTeams: [2, 9, 6], // Most active traders
      conservativeTeams: [5, 10] // Teams that follow consensus
    };

    this.leagueData.ownerTendencies = {
      3: { pattern: 'Always goes RB-RB', riskTolerance: 'Low', tradingFreq: 'Rare' },
      8: { pattern: 'Reaches for QB early', riskTolerance: 'Medium', tradingFreq: 'Active' },
      12: { pattern: 'Loves late-round sleepers', riskTolerance: 'High', tradingFreq: 'Very Active' },
      4: { pattern: 'Handcuff collector', riskTolerance: 'Low', tradingFreq: 'Occasional' },
      7: { pattern: 'WR-heavy strategy', riskTolerance: 'Medium', tradingFreq: 'Active' }
    };
  }

  async sendLeagueSetupAlert() {
    const alert = {
      type: 'LEAGUE_SETUP',
      urgency: 'HIGH',
      data: {
        leagueInfo: this.leagueData.leagueInfo,
        myPosition: this.getMyDraftPosition(),
        draftOrder: this.leagueData.draftOrder,
        keyIntel: this.generatePreDraftIntel()
      }
    };

    await this.sendIntelligenceAlert(alert);
  }

  getMyDraftPosition() {
    if (!this.leagueData.draftOrder || !this.leagueData.myTeamId) {
      return null;
    }

    const myOrder = this.leagueData.draftOrder.find(order => 
      order.teamId === this.leagueData.myTeamId
    );
    return myOrder ? myOrder.pickPosition : null;
  }

  generatePreDraftIntel() {
    const intel = [];
    
    // Draft position analysis
    const myPos = this.getMyDraftPosition();
    if (myPos) {
      if (myPos <= 4) {
        intel.push(`🎯 EARLY PICK ADVANTAGE: Elite RB/WR guaranteed, can wait on QB`);
      } else if (myPos >= 9) {
        intel.push(`🔄 LATE PICK STRATEGY: Back-to-back picks in snake, target value`);
      } else {
        intel.push(`⚖️ MIDDLE PICK: Balanced approach, watch for positional runs`);
      }
    }

    // Historical patterns
    if (this.leagueData.historicalPatterns.earlyQBTeams.length > 0) {
      intel.push(`🏈 QB ALERT: Teams ${this.leagueData.historicalPatterns.earlyQBTeams.join(', ')} historically draft QB early`);
    }

    if (this.leagueData.historicalPatterns.sleeperhunters.length > 0) {
      intel.push(`🔍 SLEEPER HUNTERS: Teams ${this.leagueData.historicalPatterns.sleeperhunters.join(', ')} love late-round flyers`);
    }

    return intel;
  }

  async analyzeDraftPattern(newPick) {
    try {
      const patterns = this.detectPatterns(newPick);
      
      for (const pattern of patterns) {
        await this.sendIntelligenceAlert({
          type: 'DRAFT_PATTERN',
          urgency: pattern.urgency,
          data: pattern
        });
      }
    } catch (error) {
      logger.error('Failed to analyze draft pattern:', error.message);
    }
  }

  detectPatterns(pick) {
    const patterns = [];
    const teamId = pick.teamId;
    const position = pick.position;

    // Get team's previous picks
    const teamPicks = this.getTeamPicks(teamId);
    
    // Detect position runs
    if (this.isPositionRun(teamPicks, position)) {
      patterns.push({
        type: 'POSITION_RUN',
        urgency: 'MEDIUM',
        team: teamId,
        position: position,
        message: `Team ${teamId} going ${position}-heavy (${teamPicks.filter(p => p.position === position).length} ${position}s)`,
        implication: this.getPositionRunImplication(position, teamId)
      });
    }

    // Detect reaches
    if (this.isReach(pick)) {
      patterns.push({
        type: 'REACH_DETECTED',
        urgency: 'MEDIUM',
        player: pick.playerName,
        team: teamId,
        message: `REACH: ${pick.playerName} taken ~2 rounds early by Team ${teamId}`,
        implication: 'Creates value at this position for later picks'
      });
    }

    // Detect trade setups
    const tradeOpportunity = this.detectTradeOpportunity(teamId, teamPicks);
    if (tradeOpportunity) {
      patterns.push({
        type: 'TRADE_SETUP',
        urgency: 'HIGH',
        ...tradeOpportunity
      });
    }

    return patterns;
  }

  getTeamPicks(teamId) {
    // This would track all picks for a specific team
    // For now, return mock data
    return [];
  }

  isPositionRun(teamPicks, position) {
    const positionPicks = teamPicks.filter(p => p.position === position);
    const totalPicks = teamPicks.length;
    
    // If team has drafted 2+ of same position in first 5 picks
    if (totalPicks <= 5 && positionPicks.length >= 2) {
      return true;
    }
    
    return false;
  }

  getPositionRunImplication(position, teamId) {
    switch (position) {
      case 'RB':
        return `Team ${teamId} desperate for WR - will likely reach for next available`;
      case 'WR':
        return `Team ${teamId} needs RB depth - handcuffs become valuable to them`;
      case 'QB':
        return `Team ${teamId} set at QB - will focus skill positions`;
      default:
        return `Team ${teamId} loaded at ${position} - may trade excess later`;
    }
  }

  isReach(pick) {
    // This would compare to ADP data
    // For now, mock logic
    return Math.random() < 0.15; // 15% chance any pick is a reach
  }

  detectTradeOpportunity(teamId, teamPicks) {
    // Analyze if team has created a trade opportunity
    const rbCount = teamPicks.filter(p => p.position === 'RB').length;
    const wrCount = teamPicks.filter(p => p.position === 'WR').length;
    
    if (rbCount >= 3 && wrCount === 0) {
      return {
        team: teamId,
        surplus: 'RB',
        need: 'WR',
        message: `TRADE SETUP: Team ${teamId} loaded at RB (${rbCount}), desperate for WR`,
        opportunity: 'Your WR depth could be valuable to them'
      };
    }
    
    if (wrCount >= 3 && rbCount <= 1) {
      return {
        team: teamId,
        surplus: 'WR', 
        need: 'RB',
        message: `TRADE SETUP: Team ${teamId} loaded at WR (${wrCount}), needs RB help`,
        opportunity: 'Your RB depth could net premium WR'
      };
    }
    
    return null;
  }

  async sendIntelligenceAlert(alert) {
    try {
      const routes = channelRouter.routeAlert(alert.type, alert.urgency, alert.data);
      
      for (const route of routes) {
        if (route.channel === 'leagueIntelligence') {
          await this.discordNotifier.sendDraftAlert({
            type: alert.type,
            urgency: alert.urgency, 
            data: alert.data
          });
          break;
        }
      }
    } catch (error) {
      logger.error('Failed to send intelligence alert:', error.message);
    }
  }

  async monitorLeagueActivity() {
    // This would run continuously to detect:
    // - New roster moves
    // - Waiver claims
    // - Trade proposals
    // - Owner research patterns (if detectable)
    
    logger.info('🕵️ League intelligence monitoring active');
  }

  async generateWeeklyIntel(week) {
    return {
      tradeTargets: await this.identifyTradeTargets(),
      waiverTargets: await this.identifyWaiverTargets(week),
      opponentWeaknesses: await this.analyzeOpponentWeaknesses(week),
      playoffImplications: await this.analyzePlayoffRace(week)
    };
  }

  async identifyTradeTargets() {
    // Analyze all teams for trade opportunities
    const opportunities = [];
    
    for (const team of this.leagueData.teams) {
      if (team.id === this.leagueData.myTeamId) continue;
      
      const analysis = this.analyzeTeamNeeds(team);
      if (analysis.tradeOpportunity) {
        opportunities.push(analysis);
      }
    }
    
    return opportunities;
  }

  analyzeTeamNeeds(team) {
    // Analyze team roster for strengths/weaknesses
    const roster = team.roster || [];
    const positions = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
    
    roster.forEach(player => {
      if (positions.hasOwnProperty(player.position)) {
        positions[player.position]++;
      }
    });

    const needs = [];
    const surplus = [];
    
    // Identify needs and surplus
    if (positions.QB === 0) needs.push('QB');
    if (positions.RB < 2) needs.push('RB');
    if (positions.WR < 2) needs.push('WR');
    if (positions.TE === 0) needs.push('TE');
    
    if (positions.RB > 4) surplus.push('RB');
    if (positions.WR > 5) surplus.push('WR');

    return {
      teamId: team.id,
      teamName: team.name,
      needs: needs,
      surplus: surplus,
      tradeOpportunity: needs.length > 0 && surplus.length > 0
    };
  }
}

module.exports = LeagueIntelligence;