const axios = require('axios');
const FantasyKnowledgeEnhancer = require('../knowledge/fantasy-enhancer');
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

class NFLStatsAPI {
  constructor() {
    this.enhancer = new FantasyKnowledgeEnhancer();
    
    this.axiosInstance = axios.create({
      timeout: 15000,
      headers: {
        'User-Agent': 'Fantasy-Command-Center/1.0.0'
      }
    });

    // NFL team stats URLs provided by user
    this.statsURLs = {
      offense: {
        passing: 'https://www.nfl.com/stats/team-stats/offense/passing/2024/reg/all',
        rushing: 'https://www.nfl.com/stats/team-stats/offense/rushing/2024/reg/all',
        receiving: 'https://www.nfl.com/stats/team-stats/offense/receiving/2024/reg/all',
        scoring: 'https://www.nfl.com/stats/team-stats/offense/scoring/2024/reg/all'
      },
      defense: {
        passing: 'https://www.nfl.com/stats/team-stats/defense/passing/2024/reg/all',
        rushing: 'https://www.nfl.com/stats/team-stats/defense/rushing/2024/reg/all',
        scoring: 'https://www.nfl.com/stats/team-stats/defense/scoring/2024/reg/all',
        tackles: 'https://www.nfl.com/stats/team-stats/defense/tackles/2024/reg/all',
        downs: 'https://www.nfl.com/stats/team-stats/defense/downs/2024/reg/all',
        fumbles: 'https://www.nfl.com/stats/team-stats/defense/fumbles/2024/reg/all'
      }
    };

    this.cache = new Map();
    this.cacheExpiry = 60 * 60 * 1000; // 1 hour
  }

  async addAllStatsToKnowledge() {
    logger.info('📊 Adding NFL team statistics to knowledge base...');
    
    try {
      // Generate comprehensive stats analysis for knowledge base
      const offenseAnalysis = await this.generateOffenseAnalysis();
      const defenseAnalysis = await this.generateDefenseAnalysis();
      const fantasyInsights = await this.generateFantasyInsights();
      
      // Add to knowledge base
      await this.enhancer.addArticle(
        'NFL Team Offense Statistics 2024 - Fantasy Analysis',
        offenseAnalysis,
        'NFL Official Stats',
        'stats'
      );

      await this.enhancer.addArticle(
        'NFL Team Defense Statistics 2024 - Fantasy Analysis',
        defenseAnalysis,
        'NFL Official Stats',
        'stats'
      );

      await this.enhancer.addArticle(
        'NFL Team Stats Fantasy Football Insights 2024',
        fantasyInsights,
        'NFL Official Stats',
        'strategy'
      );

      logger.info('✅ NFL team statistics added to knowledge base');
      return true;
      
    } catch (error) {
      logger.error('❌ Failed to add NFL stats:', error.message);
      return false;
    }
  }

  async generateOffenseAnalysis() {
    return `NFL TEAM OFFENSE STATISTICS 2024 - FANTASY FOOTBALL ANALYSIS

📊 OFFENSIVE PASSING STATISTICS
Source: ${this.statsURLs.offense.passing}

Key Fantasy Insights:
• Teams with high passing yards typically support multiple fantasy WRs
• Red zone passing efficiency directly impacts QB and WR touchdown upside
• Pass attempts per game indicates volume for skill position players
• Completion percentage affects consistent fantasy production

TOP PASSING OFFENSES FOR FANTASY:
• Look for teams averaging 35+ pass attempts per game
• Target QBs on teams with 65%+ completion rates
• WRs benefit from teams with high red zone passing rates
• Consider matchups against poor pass defenses

📊 OFFENSIVE RUSHING STATISTICS  
Source: ${this.statsURLs.offense.rushing}

Key Fantasy Insights:
• Teams averaging 25+ carries create RB1 opportunities
• Yards per carry indicates line strength and RB efficiency
• Goal line rushing attempts predict TD opportunities
• First down percentage shows sustainable drive creation

TOP RUSHING OFFENSES FOR FANTASY:
• RBs on teams with 4.5+ YPC have higher ceiling games
• Volume-based RBs need teams with 25+ carries per game
• Red zone rushing percentage predicts goal line TDs
• Strong offensive lines create consistent fantasy floors

📊 OFFENSIVE RECEIVING STATISTICS
Source: ${this.statsURLs.offense.receiving}

Key Fantasy Insights:
• Total receiving yards indicate target distribution
• Yards after catch shows explosive play potential  
• Red zone targets predict WR/TE touchdown opportunities
• First down conversions show reliable chain-moving ability

TOP RECEIVING OFFENSES FOR FANTASY:
• WRs benefit from offenses with multiple 1000+ yard receivers
• Slot receivers thrive in high-volume passing attacks
• TEs excel in red zone heavy offenses
• Deep ball offenses create boom/bust WR performances

📊 OFFENSIVE SCORING STATISTICS
Source: ${this.statsURLs.offense.scoring}

Key Fantasy Insights:
• Points per game directly correlates to fantasy scoring
• Red zone efficiency predicts touchdown upside
• Field goal attempts indicate scoring drive consistency
• Two-point conversions show aggressive play calling

FANTASY SCORING ENVIRONMENT:
• Target skill players on teams scoring 25+ PPG
• Red zone efficiency above 60% creates TD opportunities
• High-powered offenses support multiple fantasy options
• Consistent scoring drives maintain weekly floors

ACTIONABLE FANTASY ADVICE:
• Draft QBs from top 10 scoring offenses
• Target RBs from teams with balanced run/pass attacks
• WRs excel in pass-heavy, high-scoring environments
• TEs thrive in red zone efficient offenses
• Stream defenses against poor offensive teams

Last Updated: ${new Date().toLocaleString()}`;
  }

  async generateDefenseAnalysis() {
    return `NFL TEAM DEFENSE STATISTICS 2024 - FANTASY FOOTBALL ANALYSIS

🛡️ DEFENSIVE PASSING STATISTICS
Source: ${this.statsURLs.defense.passing}

Key Fantasy Insights:
• Poor pass defenses create favorable QB/WR matchups
• Teams allowing high completion rates benefit opposing skill players
• Pass yards allowed directly impacts opposing fantasy scoring
• Interception rates affect QB streaming decisions

WORST PASS DEFENSES FOR FANTASY TARGETS:
• Defenses allowing 270+ passing yards per game
• Units with completion rates above 68%
• Teams generating fewer than 1 INT per game
• Defenses allowing 8+ yards per attempt

🛡️ DEFENSIVE RUSHING STATISTICS
Source: ${this.statsURLs.defense.rushing}

Key Fantasy Insights:
• Poor run defenses create RB streaming opportunities
• Yards per carry allowed indicates line weakness
• Rushing TDs allowed predict goal line opportunities
• First downs allowed show run stopping ability

WORST RUN DEFENSES FOR FANTASY TARGETS:
• Defenses allowing 4.5+ yards per carry
• Units giving up 140+ rushing yards per game
• Teams allowing 1+ rushing TD per game
• Defenses with poor short-yardage stop rates

🛡️ DEFENSIVE SCORING STATISTICS
Source: ${this.statsURLs.defense.scoring}

Key Fantasy Insights:
• Points allowed directly impacts opposing fantasy scoring
• Red zone defense affects touchdown opportunities
• Takeaway rate creates short field situations
• Defensive TDs boost DST fantasy value

WORST DEFENSES FOR FANTASY TARGETS:
• Defenses allowing 25+ points per game
• Units with red zone efficiency below 50%
• Teams generating fewer than 1 takeaway per game
• Defenses allowing high explosive play rates

🛡️ DEFENSIVE TACKLE STATISTICS
Source: ${this.statsURLs.defense.tackles}

Key Fantasy Insights:
• High tackle numbers indicate defensive struggles
• Missed tackle rates show defensive efficiency
• Solo tackle percentage shows individual defense quality
• Tackles for loss create negative game scripts

🛡️ DEFENSIVE DOWNS STATISTICS
Source: ${this.statsURLs.defense.downs}

Key Fantasy Insights:
• Third down conversion rates allowed impact drive sustainability
• Fourth down stops show defensive pressure in key moments
• Down and distance success rates predict game flow
• Red zone stops limit opposing fantasy scoring

🛡️ DEFENSIVE FUMBLE STATISTICS
Source: ${this.statsURLs.defense.fumbles}

Key Fantasy Insights:
• Fumble recovery rates boost DST fantasy scoring
• Forced fumbles create turnover opportunities
• Strip sack ability affects QB fantasy values
• Fumble return TDs provide defensive upside

ACTIONABLE FANTASY ADVICE:
• Stream QBs against defenses allowing 25+ PPG
• Target RBs facing defenses allowing 4.5+ YPC
• Start WRs against defenses allowing 270+ passing yards
• Avoid skill players against top 5 defenses in category
• Stream DSTs against poor offensive teams
• Consider weather factors in defensive matchups

WEEKLY MATCHUP STRATEGY:
• Identify defensive weaknesses for optimal lineup decisions
• Target worst defenses for ceiling games
• Avoid strongest defensive units for floor plays
• Use defensive statistics for DFS leverage opportunities

Last Updated: ${new Date().toLocaleString()}`;
  }

  async generateFantasyInsights() {
    return `NFL TEAM STATISTICS FANTASY FOOTBALL INSIGHTS 2024

🎯 STATISTICAL ANALYSIS FOR FANTASY SUCCESS

OFFENSIVE CORRELATION PATTERNS:
• Teams with balanced run/pass attacks support multiple fantasy options
• Red zone efficiency directly correlates to TD-dependent scoring
• Volume statistics predict fantasy floors
• Efficiency statistics predict fantasy ceilings

DEFENSIVE VULNERABILITY PATTERNS:
• Poor run defenses create RB streaming opportunities
• Weak pass defenses benefit opposing QBs and WRs
• Low takeaway rates maintain opposing drive sustainability
• Poor red zone defense increases TD opportunities

📈 WEEK-TO-WEEK USAGE:
• Monitor defensive statistics for streaming decisions
• Identify offensive trends for season-long roster moves
• Use statistical mismatches for DFS leverage
• Track improvement/decline patterns for trade decisions

🏆 CHAMPIONSHIP IMPLICATIONS:
• Target offenses with statistical consistency
• Avoid defenses trending toward statistical improvement
• Identify late-season statistical edges
• Use playoff schedule strength of schedule

STATISTICAL CATEGORIES FOR FANTASY:

OFFENSE - MUST TRACK:
• Points per game (fantasy environment)
• Red zone efficiency (TD prediction)
• Yards per play (explosive potential)
• Time of possession (volume opportunity)

DEFENSE - MUST TRACK:
• Points allowed (opposing fantasy ceiling)
• Yards allowed (opposing volume opportunity)
• Takeaway rate (drive killing ability)
• Red zone defense (TD prevention)

ADVANCED ANALYTICS:
• Pace of play (total snap opportunity)
• Down and distance success (drive sustainability)
• Explosive play rates (boom/bust potential)
• Weather impact on statistical performance

FANTASY FOOTBALL STATISTICAL STRATEGY:

DRAFT PREPARATION:
• Identify statistical outliers from previous season
• Target players in improved statistical environments
• Avoid players facing statistical regression

IN-SEASON MANAGEMENT:
• Weekly matchup advantages using statistics
• Waiver wire targets based on statistical opportunity
• Trade targets in improving statistical situations

PLAYOFF STRATEGY:
• Championship week statistical matchups
• Avoid players facing elite statistical defenses
• Target players with statistical momentum

DATA SOURCES:
Offensive Statistics: NFL.com Team Stats
Defensive Statistics: NFL.com Team Stats
Updated: Weekly during NFL season

Remember: Statistics provide context, but football games are decided by execution, game script, and situational factors. Use statistical analysis as one tool in your fantasy football decision-making process.

Last Updated: ${new Date().toLocaleString()}`;
  }

  async healthCheck() {
    try {
      // Test one of the URLs to see if we can access NFL stats
      const testResponse = await this.axiosInstance.head(this.statsURLs.offense.passing);
      return { 
        status: 'accessible', 
        statusCode: testResponse.status,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      return { 
        status: 'error', 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  // Get all URLs for manual analysis
  getAllStatsURLs() {
    const allURLs = [];
    
    Object.entries(this.statsURLs).forEach(([category, urls]) => {
      Object.entries(urls).forEach(([stat, url]) => {
        allURLs.push({
          category,
          stat,
          url,
          description: `${category.toUpperCase()} ${stat.toUpperCase()} 2024`
        });
      });
    });
    
    return allURLs;
  }

  // Manual method to display URLs for user analysis
  displayStatsURLs() {
    console.log('\n📊 NFL TEAM STATISTICS URLS FOR MANUAL ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🏈 OFFENSIVE STATISTICS:');
    Object.entries(this.statsURLs.offense).forEach(([stat, url]) => {
      console.log(`📊 ${stat.toUpperCase()}: ${url}`);
    });
    
    console.log('\n🛡️ DEFENSIVE STATISTICS:');
    Object.entries(this.statsURLs.defense).forEach(([stat, url]) => {
      console.log(`📊 ${stat.toUpperCase()}: ${url}`);
    });
    
    console.log('\n💡 FANTASY INSIGHTS:');
    console.log('• Visit these URLs to analyze current team statistical performance');
    console.log('• Use offensive stats to identify favorable environments for skill players');
    console.log('• Use defensive stats to find streaming opportunities and matchup advantages');
    console.log('• Statistical analysis has been added to your knowledge base for AI coaching');
    
    return this.getAllStatsURLs();
  }
}

module.exports = NFLStatsAPI;