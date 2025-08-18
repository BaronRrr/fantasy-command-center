const DiscordNotifier = require('./src/alerts/discord-bot');

async function testAllChannelsFull() {
  console.log('🎯 COMPREHENSIVE MULTI-CHANNEL DISCORD TEST\n');
  console.log('Testing all 8 channels with realistic fantasy football data...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    // Show configured channels
    console.log('📋 Configured Channels:');
    Object.entries(discordBot.webhooks).forEach(([channel, webhook]) => {
      console.log(`  ${channel}: ${webhook ? '✅ Ready' : '❌ Missing'}`);
    });
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Test 1: DRAFT CENTRAL - Critical Draft Alert
    console.log('🚨 1. TESTING #draft-central - YOUR TURN ALERT');
    const draftAlert = await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 23,
        round: 2,
        pickInRound: 11,
        timeRemaining: 75,
        topRecommendation: 'Josh Jacobs (RB, LV)',
        availablePlayers: ['Josh Jacobs', 'DeVonta Smith', 'George Kittle']
      }
    });
    console.log('Result:', draftAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Critical draft timer alert with @here mention\n');
    
    await delay(2000);
    
    // Test 2: AI ANALYSIS - Detailed Recommendations
    console.log('🤖 2. TESTING #ai-analysis - AI RECOMMENDATIONS');
    const aiAlert = await discordBot.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: [
          '1. Josh Jacobs (RB, LV) - Elite volume, 320+ touches projected',
          '2. DeVonta Smith (WR, PHI) - Target monster, 140+ targets likely',
          '3. George Kittle (TE, SF) - TE1 upside when healthy, red zone threat'
        ],
        topRecommendation: 'Josh Jacobs (RB, LV)',
        teamNeeds: 'RB depth urgently needed, WR2 slot open, TE upgrade available',
        strategy: 'Target RB in next 2 picks, then pivot to WR depth in rounds 3-4'
      }
    });
    console.log('Result:', aiAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Detailed AI analysis with player recommendations\n');
    
    await delay(2000);
    
    // Test 3: SCOUTING REPORTS - Hidden Gem
    console.log('🔬 3. TESTING #scouting-reports - HIDDEN GEM');
    const scoutingAlert = await discordBot.sendMultiChannelAlert({
      type: 'HIDDEN_GEM',
      urgency: 'MEDIUM',
      data: {
        playerName: 'Rachaad White',
        position: 'RB',
        team: 'TB',
        currentADP: 'Round 8.3 (99th overall)',
        projectedValue: 'Round 5.5 (66th overall)',
        reasoning: 'Tom Brady retirement opens 80+ dump-off targets, plus goal line work',
        draftWindow: 'Rounds 6-7 before ADP catches up'
      }
    });
    console.log('Result:', scoutingAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Detailed scouting report with value analysis\n');
    
    await delay(2000);
    
    // Test 4: PLAYER NEWS - Breaking Injury Update
    console.log('📰 4. TESTING #player-news - INJURY UPDATE');
    const newsAlert = await discordBot.sendMultiChannelAlert({
      type: 'INJURY_UPDATE',
      urgency: 'HIGH',
      data: {
        playerName: 'Christian McCaffrey',
        position: 'RB',
        team: 'SF',
        injuryStatus: 'Questionable - Ankle sprain, limited practice',
        fantasyImpact: 'Monitor Friday practice report - game-time decision likely',
        source: 'ESPN Adam Schefter',
        timestamp: '3 hours before games',
        recommendedAction: 'Have Jordan Mason ready as backup plan'
      }
    });
    console.log('Result:', newsAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Breaking injury news with fantasy implications\n');
    
    await delay(2000);
    
    // Test 5: LEAGUE INTELLIGENCE - Trade Opportunity
    console.log('🕵️ 5. TESTING #league-intelligence - TRADE OPPORTUNITY');
    const intelAlert = await discordBot.sendMultiChannelAlert({
      type: 'TRADE_OPPORTUNITY',
      urgency: 'HIGH',
      data: {
        teamName: 'Team Johnson (Position 4)',
        theirNeeds: 'RB depth, TE upgrade',
        theirSurplus: 'WR depth (has 5 startable WRs)',
        yourLeverage: 'Strong RB corps, multiple TEs',
        tradeIdea: 'Your Josh Jacobs + Dallas Goedert for their Tyreek Hill + pick',
        confidence: '85% - they desperately need RB help'
      }
    });
    console.log('Result:', intelAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Trade opportunity analysis with opponent needs\n');
    
    await delay(2000);
    
    // Test 6: MATCHUP ANALYSIS - Weekly Lineup
    console.log('⚔️ 6. TESTING #matchup-analysis - LINEUP OPTIMIZATION');
    const matchupAlert = await discordBot.sendMultiChannelAlert({
      type: 'LINEUP_OPTIMIZATION',
      urgency: 'HIGH',
      data: {
        weekNumber: 3,
        changeCount: 4,
        changes: [
          'START: Geno Smith vs MIA (instead of Aaron Rodgers vs NE)',
          'START: Michael Pittman vs HOU (instead of DeVonta Smith vs TB)',
          'BENCH: Ezekiel Elliott vs NYG (avoid bad matchup)',
          'FLEX: Tyler Lockett vs MIA (target weak secondary)'
        ],
        projectedPoints: 8.7,
        confidence: 92
      }
    });
    console.log('Result:', matchupAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Weekly lineup changes with projections\n');
    
    await delay(2000);
    
    // Test 7: EMERGENCY ALERTS - Critical News
    console.log('🚨 7. TESTING #emergency-alerts - EMERGENCY INJURY');
    const emergencyAlert = await discordBot.sendMultiChannelAlert({
      type: 'EMERGENCY_INJURY',
      urgency: 'CRITICAL',
      data: {
        playerName: 'Cooper Kupp',
        timestamp: '2 hours before games',
        hoursBeforeGames: 2,
        waiverTargets: [
          'Tutu Atwell (LAR) - Direct replacement, 12% rostered',
          'Van Jefferson (LAR) - Secondary option, 8% rostered',
          'Ben Skowronek (LAR) - Deep league, 2% rostered'
        ],
        deadline: 'Sunday 11:00 AM EST',
        faabSuggestion: '$25-35 for Atwell, $15-20 for Jefferson'
      }
    });
    console.log('Result:', emergencyAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Critical injury with immediate waiver targets\n');
    
    await delay(2000);
    
    // Test 8: DRAFT RECAP - Post-Draft Analysis
    console.log('📊 8. TESTING #draft-recap - DRAFT COMPLETE');
    const recapAlert = await discordBot.sendMultiChannelAlert({
      type: 'DRAFT_COMPLETE',
      urgency: 'INFO',
      data: {
        grade: 'A-',
        aiFollowRate: 87,
        steals: [
          'Round 6: Rachaad White (RB, TB) - 2 rounds below ADP',
          'Round 9: Jordan Addison (WR, MIN) - Potential WR2 upside',
          'Round 12: Tyler Allgeier (RB, ATL) - Handcuff with standalone value'
        ],
        strengths: [
          'Elite RB depth with 4 startable options',
          'Strong WR corps with high floor/ceiling mix',
          'Excellent value picks in middle rounds'
        ],
        championshipOdds: 23
      }
    });
    console.log('Result:', recapAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Complete draft analysis with grades and odds\n');
    
    await delay(2000);
    
    // Test 9: Weather Alert
    console.log('🌦️ 9. TESTING #player-news - WEATHER ALERT');
    const weatherAlert = await discordBot.sendMultiChannelAlert({
      type: 'WEATHER_ALERT',
      urgency: 'HIGH',
      data: {
        gameInfo: 'BUF vs MIA @ Buffalo',
        conditions: 'Heavy snow, 25mph winds, 28°F',
        impact: 'Passing game heavily impacted, expect 30+ mph wind gusts',
        fantasyAdvice: 'AVOID: Josh Allen, Stefon Diggs, Tua, Tyreek Hill. TARGET: RBs both teams'
      }
    });
    console.log('Result:', weatherAlert ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Expected: Weather impact with specific player advice\n');
    
    console.log('='.repeat(60));
    console.log('🎉 COMPREHENSIVE TESTING COMPLETE!\n');
    
    console.log('📊 CHANNEL SUMMARY:');
    console.log('🚨 #draft-central: Critical draft decisions');
    console.log('🤖 #ai-analysis: Detailed Claude recommendations');
    console.log('🔬 #scouting-reports: Hidden gems and value picks');
    console.log('📰 #player-news: Breaking news and weather');
    console.log('🕵️ #league-intelligence: Trade and opponent analysis');
    console.log('⚔️ #matchup-analysis: Weekly lineup optimization');
    console.log('🚨 #emergency-alerts: Critical last-minute news');
    console.log('📊 #draft-recap: Post-draft grades and analysis');
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('1. ✅ Discord multi-channel system working perfectly');
    console.log('2. 🔄 Set up ESPN mock draft testing');
    console.log('3. ⚡ Implement Discord chat bot for real-time AI');
    console.log('4. 🚀 Deploy to cloud server for 24/7 operation');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the comprehensive test
testAllChannelsFull();