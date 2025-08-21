/**
 * ESPN 2025 Fantasy Football Draft Guide Knowledge Base
 * Source: https://www.espn.com/fantasy/football/story/_/page/FFDraftGuide25-45508190/2025-fantasy-football-rankings-mock-draft-cheat-sheets-sleepers
 * Last Updated: August 21, 2025
 */

const ESPN_2025_DRAFT_GUIDE = {
  // Core Draft Strategy from Mike Clay
  draftStrategy: {
    philosophy: "Position-by-position approach with emphasis on elite skill position players early",
    qbStrategy: "Draft quarterbacks later - value exists in middle rounds",
    rbStrategy: "Target elite RBs early, especially in standard leagues",
    wrStrategy: "Focus on proven WR1s and high-target players",
    teStrategy: "Consider value vs scarcity - Kelce still elite but age concern",
    
    formatConsiderations: {
      ppr: "WRs gain significant value, target high-target players",
      superflex: "QBs become premium picks, draft early",
      standard: "RBs maintain higher value than PPR formats",
      bestBall: "Target ceiling players over floor players"
    }
  },

  // Top Rookie Targets
  rookieTargets: {
    topTier: {
      ashtonJeanty: {
        name: "Ashton Jeanty",
        position: "RB",
        team: "Las Vegas Raiders",
        analysis: "Some experts rank ahead of Saquon Barkley - immediate impact expected",
        adp: "Late 1st/Early 2nd round",
        upside: "RB1 potential with volume in Raiders offense"
      }
    },
    
    qbSleepers: {
      drakeMaye: {
        name: "Drake Maye",
        position: "QB",
        team: "New England Patriots",
        analysis: "Potential top-10 QB in Year 2 - major developmental leap expected",
        adp: "QB12-15 range",
        upside: "QB1 ceiling with rushing upside"
      },
      
      jaxsonDart: {
        name: "Jaxson Dart",
        position: "QB",
        analysis: "Deep sleeper with significant upside potential",
        target: "Late round flyer or waiver pickup"
      }
    },
    
    wrSleepers: {
      adonaiMitchell: {
        name: "Adonai Mitchell",
        position: "WR",
        analysis: "Deep sleeper with breakout potential",
        target: "Late round pick with upside"
      },
      
      toryHorton: {
        name: "Tory Horton",
        position: "WR", 
        analysis: "Sleeper candidate for 2025 breakout",
        target: "Waiver wire or late round"
      }
    }
  },

  // Undervalued Veterans
  undervaluedPlayers: {
    quarterback: {
      joeBurrow: {
        name: "Joe Burrow",
        position: "QB",
        team: "Cincinnati Bengals",
        analysis: "Injury concerns creating value - elite talent when healthy",
        adp: "QB6-8 range",
        recommendation: "Target in middle rounds for QB1 upside"
      }
    },
    
    receivers: {
      laddMcConkey: {
        name: "Ladd McConkey",
        position: "WR",
        team: "Los Angeles Chargers",
        analysis: "Undervalued in current ADP - strong target share expected",
        target: "Mid-round value pick"
      },
      
      jaylenWaddle: {
        name: "Jaylen Waddle", 
        position: "WR",
        team: "Miami Dolphins",
        analysis: "High target volume with Tua healthy - PPR value",
        recommendation: "Reliable WR2 with WR1 weeks"
      }
    },
    
    tightEnd: {
      travisKelce: {
        name: "Travis Kelce",
        position: "TE", 
        team: "Kansas City Chiefs",
        analysis: "Age concerns creating value - still elite when motivated",
        recommendation: "Premium pick if targeting TE early"
      }
    },
    
    runningBack: {
      treVeyonHenderson: {
        name: "TreVeyon Henderson",
        position: "RB",
        team: "Ohio State", 
        analysis: "Undervalued player with upside potential",
        target: "Value pick in mid rounds"
      }
    }
  },

  // Players to Avoid (Overvalued)
  bustCandidates: {
    christianMcCaffrey: {
      name: "Christian McCaffrey",
      position: "RB", 
      team: "San Francisco 49ers",
      concern: "Age, injury history, and potential TD regression",
      adp: "1st round",
      recommendation: "Consider fading at current ADP"
    },
    
    markAndrews: {
      name: "Mark Andrews",
      position: "TE",
      team: "Baltimore Ravens", 
      concern: "Target share concerns and potential regression",
      recommendation: "Avoid at current ADP - better value elsewhere"
    },
    
    generalConcerns: {
      tdRegressionCandidates: "Players who scored unusually high TDs in 2024",
      injuryReturns: "Players coming back from significant injuries",
      ageDecline: "RBs over 28, WRs over 30 with heavy usage"
    }
  },

  // Year 2 Breakout Candidates
  year2Breakouts: {
    qbs: ["Drake Maye"],
    wrs: ["Marvin Harrison Jr.", "Rome Odunze", "Adonai Mitchell"],
    rbs: ["TBD - monitor rookie RB performances"],
    
    reasoning: "Second-year players often make significant developmental leaps"
  },

  // Draft Position Strategy
  draftPositionStrategy: {
    earlyPicks: {
      rounds12: "Target elite RBs or top-tier WRs - avoid QB unless superflex",
      strategy: "Lock in foundational players with high floor and ceiling"
    },
    
    middlePicks: {
      rounds12: "Best available skill position players - more flexibility",
      strategy: "Target players falling due to ADP inefficiencies"
    },
    
    latePicks: {
      rounds12: "Double up on one position if elite players available", 
      strategy: "Be aggressive on players you believe in"
    }
  },

  // League Format Adjustments
  leagueFormatTips: {
    eightTeam: "Target ceiling players - depth available on waivers",
    tenTeam: "Balanced approach - standard draft strategy applies",
    twelveTeam: "Value becomes premium - target safe floors early",
    
    scoringAdjustments: {
      ppr: "WRs increase in value significantly",
      halfPpr: "Moderate boost to pass catchers", 
      standard: "RBs maintain premium value",
      superflex: "QBs become first round picks",
      tep: "Rookie WRs gain significant value"
    }
  },

  // Key Monitoring Points
  draftDayConsiderations: {
    injuries: "Monitor training camp injury reports closely",
    depthCharts: "Track starting role clarity", 
    adp: "Target players falling below expected value",
    news: "Stay updated on contract situations and team changes",
    
    redFlags: [
      "Holdouts affecting preparation",
      "Unclear backfield situations", 
      "Quarterback competitions",
      "Offensive coordinator changes"
    ]
  },

  // Expert Consensus
  expertInsights: {
    mikeClayStrategy: "Position-by-position approach with late QB strategy",
    tristanCockcroftRounds: "Specific recommendations for rounds 1-2 by league size",
    consensusApproach: "Balance floor and ceiling based on draft position"
  },

  lastUpdated: "2025-08-21",
  source: "ESPN Fantasy Football 2025 Draft Guide"
};

module.exports = ESPN_2025_DRAFT_GUIDE;