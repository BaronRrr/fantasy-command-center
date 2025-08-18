const DiscordNotifier = require('./src/alerts/discord-bot');

async function testScoutingChannel() {
  console.log('🔬 Testing Scouting Reports Channel...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    // Test 1: Hidden Gem Alert
    console.log('1️⃣ Testing HIDDEN_GEM alert...');
    const hiddenGemAlert = await discordBot.sendMultiChannelAlert({
      type: 'HIDDEN_GEM',
      urgency: 'MEDIUM',
      data: {
        playerName: 'Rachaad White',
        position: 'RB',
        team: 'TB',
        currentADP: 'Round 8',
        projectedValue: 'Round 5',
        reasoning: 'Tom Brady retirement opens up dump-off opportunities',
        draftWindow: 'Rounds 6-7'
      }
    });
    console.log('Hidden Gem Result:', hiddenGemAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 2: Breakout Candidate Alert  
    console.log('2️⃣ Testing BREAKOUT_CANDIDATE alert...');
    const breakoutAlert = await discordBot.sendMultiChannelAlert({
      type: 'BREAKOUT_CANDIDATE',
      urgency: 'MEDIUM',
      data: {
        playerName: 'Jordan Addison',
        position: 'WR',
        team: 'MIN',
        ownership: '15',
        catalyst: 'Justin Jefferson injury opens targets',
        ceiling: 'WR2 with WR1 weeks',
        targetRounds: '9-11'
      }
    });
    console.log('Breakout Candidate Result:', breakoutAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    await delay(2000);
    
    // Test 3: Value Opportunity Alert
    console.log('3️⃣ Testing VALUE_OPPORTUNITY alert...');
    const valueAlert = await discordBot.sendMultiChannelAlert({
      type: 'VALUE_OPPORTUNITY', 
      urgency: 'INFO',
      data: {
        playerName: 'Gus Edwards',
        position: 'RB',
        team: 'BAL',
        situation: 'Late-round RB with goal line role',
        value: 'Potential TD vulture in Ravens offense',
        recommendation: 'Handcuff for Lamar Jackson fantasy teams'
      }
    });
    console.log('Value Opportunity Result:', valueAlert ? '✅ Sent' : '❌ Failed');
    console.log('');
    
    console.log('✅ Scouting Reports Channel Testing Complete!');
    console.log('\n📊 Scouting Channel Types:');
    console.log('  💎 Hidden Gems: Players available below their value');
    console.log('  🔮 Breakout Candidates: Under-the-radar upside plays');
    console.log('  📈 Value Opportunities: Late-round steals');
    console.log('  📊 ADP Anomalies: Market inefficiencies');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testScoutingChannel();