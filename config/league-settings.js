const leagueConfigurations = {
  '12-team-ppr': {
    size: 12,
    scoringType: 'PPR',
    rosterPositions: {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      K: 1,
      DST: 1
    },
    benchSize: 6,
    draftRounds: 16,
    waiversType: 'FAAB',
    tradeDeadline: 'Week 11',
    playoffWeeks: [14, 15, 16, 17],
    positionLimits: {
      QB: 4,
      RB: 8,
      WR: 8,
      TE: 3,
      K: 2,
      DST: 2
    }
  },

  '10-team-half-ppr': {
    size: 10,
    scoringType: 'Half-PPR',
    rosterPositions: {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      FLEX: 1,
      K: 1,
      DST: 1
    },
    benchSize: 5,
    draftRounds: 15,
    waiversType: 'Rolling',
    tradeDeadline: 'Week 12',
    playoffWeeks: [15, 16, 17],
    positionLimits: {
      QB: 3,
      RB: 6,
      WR: 7,
      TE: 2,
      K: 2,
      DST: 2
    }
  }
};

const positionAnalysis = {
  QB: {
    startable: 12,
    mustHave: 24,
    depthNeeded: 2,
    draftStrategy: 'Late rounds unless elite option available',
    scarcityRounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  },
  RB: {
    startable: 24,
    mustHave: 36,
    depthNeeded: 4,
    draftStrategy: 'High priority early, handcuffs later',
    scarcityRounds: [1, 2, 3, 4, 5, 6]
  },
  WR: {
    startable: 36,
    mustHave: 48,
    depthNeeded: 5,
    draftStrategy: 'Balance with RB, target upside in middle rounds',
    scarcityRounds: [1, 2, 3, 4, 5, 6, 7]
  },
  TE: {
    startable: 12,
    mustHave: 18,
    depthNeeded: 2,
    draftStrategy: 'Elite early or stream late',
    scarcityRounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  },
  K: {
    startable: 12,
    mustHave: 24,
    depthNeeded: 1,
    draftStrategy: 'Last 2 rounds only',
    scarcityRounds: [15, 16]
  },
  DST: {
    startable: 12,
    mustHave: 24,
    depthNeeded: 1,
    draftStrategy: 'Stream or target elite option late',
    scarcityRounds: [13, 14, 15, 16]
  }
};

const draftStrategies = {
  'zero-rb': {
    description: 'Avoid RBs early, load up on WR/QB/TE',
    rounds: {
      1: ['WR', 'TE'],
      2: ['WR', 'QB'],
      3: ['WR', 'QB'],
      4: ['RB', 'WR'],
      5: ['RB', 'WR']
    },
    riskLevel: 'High',
    successConditions: ['Late round RB hits', 'WR depth stays healthy']
  },
  'rb-heavy': {
    description: 'Lock up RB1/RB2 early, find WR value later',
    rounds: {
      1: ['RB'],
      2: ['RB'],
      3: ['WR', 'RB'],
      4: ['WR', 'RB'],
      5: ['WR', 'TE']
    },
    riskLevel: 'Medium',
    successConditions: ['RBs stay healthy', 'Find WR2/3 value']
  },
  'balanced': {
    description: 'Mix of best available with positional needs',
    rounds: {
      1: ['RB', 'WR'],
      2: ['RB', 'WR'],
      3: ['RB', 'WR'],
      4: ['WR', 'RB', 'TE'],
      5: ['WR', 'RB', 'TE']
    },
    riskLevel: 'Low',
    successConditions: ['Solid across all positions', 'No major busts']
  }
};

module.exports = {
  leagueConfigurations,
  positionAnalysis,
  draftStrategies
};