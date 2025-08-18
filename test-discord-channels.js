const DiscordNotifier = require('./src/alerts/discord-bot');

async function testDiscordChannels() {
  console.log('🎯 Testing Multi-Channel Discord System...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    console.log('📋 Configured Webhooks:');
    Object.entries(discordBot.webhooks).forEach(([channel, webhook]) => {
      console.log(`  ${channel}: ${webhook ? '✅ Configured' : '❌ Missing'}`);
    });
    console.log('');
    
    // Test 1: Draft Central Alert (CRITICAL)
    console.log('1️⃣ Testing #draft-central with MY_TURN alert...');
    const draftAlert = await discordBot.sendDraftAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 15,
        timeRemaining: 90,
        topRecommendation: 'Josh Jacobs (RB, LV)',
        round: 2,
        pickInRound: 3
      }
    });
    console.log('Draft Alert Result:', draftAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 2: AI Analysis Alert (HIGH)
    console.log('2️⃣ Testing #ai-analysis with AI_RECOMMENDATIONS...');
    const aiAlert = await discordBot.sendAIAnalysis({
      recommendations: [
        '1. Josh Jacobs (RB, LV) - Elite volume, weak schedule',
        '2. DeVonta Smith (WR, PHI) - Target monster, Hurts connection', 
        '3. George Kittle (TE, SF) - TE1 upside when healthy'
      ],
      topPick: 'Josh Jacobs (RB, LV)',
      teamNeeds: 'RB depth, WR2, TE upgrade',
      strategy: 'Target RB in next 2 picks, then pivot to WR'
    });
    console.log('AI Analysis Result:', aiAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 3: Player News Alert (HIGH)
    console.log('3️⃣ Testing #player-news with INJURY_UPDATE...');
    const newsAlert = await discordBot.sendPlayerNewsAlert('Christian McCaffrey', {
      urgency: 'HIGH',
      status: 'Questionable - Ankle',
      impact: 'Monitor practice reports closely',
      source: 'ESPN'
    });
    console.log('Player News Result:', newsAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 4: Weather Alert (MEDIUM)
    console.log('4️⃣ Testing #player-news with WEATHER_ALERT...');
    const weatherAlert = await discordBot.sendWeatherAlert('BUF vs MIA', {
      conditions: 'Snow and High Winds',
      severity: 'SEVERE',
      impact: 'Heavy snow and 25mph winds will significantly impact passing game',
      fantasyAdvice: 'Target RBs heavily, avoid WRs and kickers'
    });
    console.log('Weather Alert Result:', weatherAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 5: Multiple Channel Test
    console.log('5️⃣ Testing multiple channels simultaneously...');
    const multiTest = await discordBot.testAllChannels();
    console.log('Multi-Channel Test Results:');
    multiTest.forEach((test, index) => {
      const success = test.result && Array.isArray(test.result) && test.result.some(r => r.success);
      console.log(`  ${index + 1}. ${test.alert}: ${success ? '✅ Success' : '❌ Failed'}`);
    });
    console.log('');
    
    console.log('✅ Discord Multi-Channel System Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('  🚨 Draft Central: Time-sensitive alerts');
    console.log('  🤖 AI Analysis: Detailed recommendations'); 
    console.log('  📰 Player News: Injury/trade updates');
    console.log('  🌦️ Weather Alerts: Game day conditions');
    console.log('\n🎯 Next Steps:');
    console.log('  1. Create remaining Discord channels if needed');
    console.log('  2. Test ESPN mock draft integration');
    console.log('  3. Fine-tune notification timing and content');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
testDiscordChannels();