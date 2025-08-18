const DiscordNotifier = require('./src/alerts/discord-bot');

async function testEnhancedAlerts() {
  console.log('🔥 TESTING ALL CHANNELS WITH ENHANCED DETAILED ALERTS!\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    // Test 1: DRAFT CENTRAL - Enhanced Your Turn Alert
    console.log('🚨 1. ENHANCED #draft-central Alert...');
    await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 27,
        round: 3,
        pickInRound: 3,
        timeRemaining: 85,
        topRecommendation: 'Travis Etienne (RB, JAX) - Elite upside in high-powered offense',
        availablePlayers: ['Travis Etienne', 'Mike Evans', 'Darren Waller', 'Jalen Hurts']
      }
    });
    console.log('✅ Enhanced draft alert sent with full pick details!\n');
    
    await delay(2000);
    
    // Test 2: AI ANALYSIS - Super detailed recommendations
    console.log('🤖 2. ENHANCED #ai-analysis with comprehensive breakdown...');
    await discordBot.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: [
          '🔥 ELITE PICK: Travis Etienne (RB, JAX)\n   • 285 touch projection in explosive Jags offense\n   • Zero backfield competition after Robinson trade\n   • Schedule: 4 bottom-10 run defenses in first 6 weeks\n   • RB8 floor with RB3 ceiling - perfect Round 3 value',
          
          '⚡ HIGH UPSIDE: Mike Evans (WR, TB)\n   • Red zone monster: 15+ TD projection\n   • Tom Brady connection = guaranteed targets\n   • 115+ target floor with Godwin injury questions\n   • WR10 floor, WR5 ceiling in pass-heavy offense',
          
          '🎯 POSITIONAL ADVANTAGE: Darren Waller (TE, LV)\n   • Only true TE1 available at this draft slot\n   • 130+ target projection in McDaniels system\n   • Immediate 8+ point weekly advantage over streaming\n   • TE2 overall upside with elite consistency'
        ],
        topRecommendation: 'Travis Etienne - Perfect storm of opportunity and talent',
        teamNeeds: '🔍 CRITICAL ANALYSIS:\n🚨 RB: Solid RB1, need explosive RB2 upside\n📊 WR: Strong WR1/WR2, could use red zone threat\n🎯 TE: Streaming options available but huge edge possible\n✅ QB: Deep position, wait until Round 6+',
        strategy: '🧠 OPTIMAL STRATEGY: Secure Etienne for explosive RB2, then target 2 WRs in Rounds 4-5 before position runs. This lineup gives league-winning upside with safe weekly floor.'
      }
    });
    console.log('✅ Enhanced AI analysis with detailed player breakdowns!\n');
    
    await delay(2000);
    
    // Test 3: SCOUTING REPORTS - Detailed hidden gem
    console.log('🔬 3. ENHANCED #scouting-reports with deep analysis...');
    await discordBot.sendMultiChannelAlert({
      type: 'HIDDEN_GEM',
      urgency: 'MEDIUM',
      data: {
        playerName: 'Jaylen Warren',
        position: 'RB',
        team: 'PIT',
        currentADP: 'Round 11.2 (134th overall)',
        projectedValue: 'Round 7.5 (89th overall)',
        reasoning: '🔍 DEEP DIVE ANALYSIS:\n• Najee Harris durability concerns (500+ touches in 2 years)\n• Warren: 5.3 YPC vs Harris 3.9 YPC in limited action\n• Steelers implementing more RBBC after coaching change\n• Warren profiles as 3rd down back + red zone vulture\n• Potential for 60% snap share if Harris struggles',
        draftWindow: 'Rounds 9-10 before ADP adjusts - league-winning handcuff with standalone value'
      }
    });
    console.log('✅ Enhanced scouting report with detailed opportunity analysis!\n');
    
    await delay(2000);
    
    // Test 4: PLAYER NEWS - Breaking injury with full implications
    console.log('📰 4. ENHANCED #player-news with comprehensive impact...');
    await discordBot.sendMultiChannelAlert({
      type: 'INJURY_UPDATE',
      urgency: 'HIGH',
      data: {
        playerName: 'Keenan Allen',
        position: 'WR',
        team: 'LAC',
        injuryStatus: 'QUESTIONABLE - Hamstring strain, limited practice Wednesday/Thursday',
        fantasyImpact: '🏥 FULL IMPACT ANALYSIS:\n• Hamstring injuries typically linger 2-3 weeks\n• Allen has missed 8 games in last 2 seasons\n• Mike Williams becomes WR2 with 25+ target upside\n• DeAndre Carter moves into slot role\n• Herbert may lean more on Ekeler in passing game',
        source: 'Ian Rapoport, confirmed by Lynn Bowden Sr.',
        timestamp: '4 hours ago',
        recommendedAction: '🎯 IMMEDIATE ACTIONS:\n1. Bench Allen for safer floor plays\n2. Target Mike Williams as tournament pivot\n3. Consider Ekeler slight upgrade in PPR\n4. Monitor Friday practice report for final status'
      }
    });
    console.log('✅ Enhanced injury report with full domino effect analysis!\n');
    
    await delay(2000);
    
    // Test 5: LEAGUE INTELLIGENCE - Detailed trade breakdown
    console.log('🕵️ 5. ENHANCED #league-intelligence with trade strategy...');
    await discordBot.sendMultiChannelAlert({
      type: 'TRADE_OPPORTUNITY',
      urgency: 'HIGH',
      data: {
        teamName: 'Team Sarah (Draft Position 8)',
        theirNeeds: '🎯 CRITICAL NEEDS:\n• RB2: Only has Najee Harris, then handcuffs\n• TE: Streaming with Logan Thomas/Hayden Hurst\n• QB: Streaming after missing top tier',
        theirSurplus: '📈 EXCESS DEPTH:\n• WR: Davante Adams, Tyreek Hill, DK Metcalf, Gabe Davis, Elijah Moore\n• K/DST: Rostered 2 of each (can\'t start both)',
        yourLeverage: '💪 YOUR ADVANTAGES:\n• RB depth: Etienne, Pollard, Hunt available\n• TE: Have Darren Waller + backup options\n• They\'re 0-2, desperate for wins NOW',
        tradeIdea: '🤝 PROPOSED DEAL:\nYOU SEND: Travis Etienne + Darren Waller\nYOU GET: Davante Adams + Gabe Davis\n\n📊 TRADE ANALYSIS:\n• You upgrade to elite WR1\n• You get depth WR with upside\n• They get immediate RB2 + TE1\n• Both teams improve starting lineups',
        confidence: '92% success rate - addresses both teams\' biggest needs'
      }
    });
    console.log('✅ Enhanced trade opportunity with full strategic breakdown!\n');
    
    await delay(2000);
    
    // Test 6: MATCHUP ANALYSIS - Detailed weekly optimization
    console.log('⚔️ 6. ENHANCED #matchup-analysis with advanced metrics...');
    await discordBot.sendMultiChannelAlert({
      type: 'LINEUP_OPTIMIZATION',
      urgency: 'HIGH',
      data: {
        weekNumber: 4,
        changeCount: 5,
        changes: [
          '🔥 START: Geno Smith vs NYG (instead of Tua vs CIN)\n   • NYG allows 285 pass YPG (30th ranked)\n   • Smith: 8.2 YPA vs zone coverage (NYG base)\n   • Projected: 267 yards, 2.1 TDs (+4.8 vs Tua)',
          
          '⚡ START: Tyler Lockett vs NYG (instead of Courtland Sutton vs LV)\n   • Slot coverage mismatch vs Adoree Jackson\n   • 11 targets per game in Wilson\'s last 3\n   • Projected: 7 catches, 89 yards, 0.8 TDs (+3.2 vs Sutton)',
          
          '🎯 FLEX: Rhamondre Stevenson vs DAL (instead of Ezekiel Elliott vs NE)\n   • Elliott revenge game narrative overblown\n   • Stevenson: 78% snap rate, 15 touches per game\n   • DAL allows 4.6 YPC to RBs (22nd ranked)\n   • Projected: 14 carries, 4 catches, 1.1 TDs (+5.1 vs Zeke)',
          
          '🛡️ DEFENSE: Giants DST vs SEA (instead of Patriots vs DAL)\n   • Geno Smith: 3 turnovers in last 2 road games\n   • SEA O-line injuries: 2 sacks per game likely\n   • Home dome environment favors pass rush\n   • Projected: 2 sacks, 1 turnover, 8.2 points',
          
          '🦵 KICKER: Jason Myers vs NYG (instead of Nick Folk vs DAL)\n   • Dome game = no weather concerns\n   • SEA red zone efficiency improving\n   • 3+ FG attempts projected in likely shootout\n   • Projected: 2 FGs, 3 XPs, 9.1 points'
        ],
        projectedPoints: 12.4,
        confidence: 89
      }
    });
    console.log('✅ Enhanced matchup analysis with advanced projections!\n');
    
    await delay(2000);
    
    // Test 7: EMERGENCY ALERTS - Critical situation management
    console.log('🚨 7. ENHANCED #emergency-alerts with immediate action plan...');
    await discordBot.sendMultiChannelAlert({
      type: 'EMERGENCY_INJURY',
      urgency: 'CRITICAL',
      data: {
        playerName: 'Jonathan Taylor',
        timestamp: '90 minutes before games',
        hoursBeforeGames: 1.5,
        waiverTargets: [
          '🔥 PRIORITY #1: Deon Jackson (IND) - 23% rostered\n   • Direct Taylor replacement in Colts system\n   • 15+ touch upside with goal line work\n   • Matt Ryan checkdown safety valve\n   • FAAB: $45-55 (league winner potential)',
          
          '⚡ PRIORITY #2: Nyheim Hines (IND) - 15% rostered\n   • Receiving back role secure\n   • 8+ targets in negative game script\n   • PPR floor with TD upside\n   • FAAB: $25-35 (safe weekly starter)',
          
          '🎯 DEEP LEAGUE: Jordan Wilkins (IND) - 3% rostered\n   • Goal line specialist role\n   • Vulture potential in red zone\n   • Handcuff for Jackson if he gets hurt\n   • FAAB: $8-12 (lottery ticket only)'
        ],
        deadline: 'Sunday 12:00 PM EST (45 minutes!)',
        faabSuggestion: '💰 FAAB STRATEGY:\n• Jackson: $45-55 (season-changing pickup)\n• Hines: $25-35 (weekly starter value)\n• Wilkins: $8-12 (deep league dart throw)\n\n🚨 DROP CANDIDATES:\n• Bench QBs/DSTs you\'re not starting\n• Lottery ticket WRs with no path to targets\n• Injured players with multi-week timelines'
      }
    });
    console.log('✅ Enhanced emergency alert with comprehensive action plan!\n');
    
    await delay(2000);
    
    // Test 8: DRAFT RECAP - Comprehensive post-draft analysis
    console.log('📊 8. ENHANCED #draft-recap with full breakdown...');
    await discordBot.sendMultiChannelAlert({
      type: 'DRAFT_COMPLETE',
      urgency: 'INFO',
      data: {
        grade: 'A',
        aiFollowRate: 91,
        steals: [
          '🔥 ROUND 6 STEAL: Rachaad White (RB, TB)\n   • ADP: Round 8.2, Value: 2.2 rounds early\n   • Tom Brady targets + goal line work = RB2 upside\n   • Zero competition in backfield',
          
          '⚡ ROUND 9 STEAL: Jordan Addison (WR, MIN)\n   • ADP: Round 11.5, Value: 2.5 rounds early\n   • Justin Jefferson attention = single coverage\n   • 90+ target floor with WR2 ceiling',
          
          '💎 ROUND 12 STEAL: Tyler Allgeier (RB, ATL)\n   • ADP: Round 14.8, Value: 2.8 rounds early\n   • Cordarrelle Patterson age concerns\n   • Arthur Smith system loves power running'
        ],
        strengths: [
          '🏆 ELITE RB CORPS: Taylor, Etienne, White, Allgeier\n   • 4 players with RB1/RB2 upside\n   • Perfect mix of floor and ceiling\n   • Injury protection with quality depth',
          
          '📈 HIGH-UPSIDE WRs: Adams, Lockett, Addison, Moore\n   • Davante provides elite floor\n   • Lockett = weekly boom potential\n   • Addison/Moore = league-winning breakouts',
          
          '🎯 STRATEGIC EXCELLENCE:\n   • Avoided QB/TE early (smart in deep position years)\n   • Targeted value picks in dead zone (Rounds 6-9)\n   • Built roster for both consistency and upside'
        ],
        championshipOdds: 28
      }
    });
    console.log('✅ Enhanced draft recap with comprehensive team analysis!\n');
    
    console.log('🎉 ALL 8 CHANNELS TESTED WITH ENHANCED DETAILED ALERTS!');
    console.log('\n📊 ENHANCEMENT SUMMARY:');
    console.log('✅ Rich detailed descriptions instead of "No details available"');
    console.log('✅ Comprehensive player analysis and projections');
    console.log('✅ Strategic recommendations with reasoning');
    console.log('✅ Full context and actionable advice');
    console.log('✅ Professional fantasy football presentation');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testEnhancedAlerts();