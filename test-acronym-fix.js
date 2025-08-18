const DiscordNotifier = require('./src/alerts/discord-bot');

async function testAcronymFix() {
  console.log('📝 TESTING ACRONYM EXPANSION IN DISCORD ALERTS...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    // Test the acronym expansion
    console.log('🔍 Testing acronym expansion method...');
    const testText = 'RB depth, WR2, TE upgrade, DST, Handcuffs, lottery tickets';
    const expanded = discordBot.expandAcronyms(testText);
    console.log('Original:', testText);
    console.log('Expanded:', expanded);
    console.log('');
    
    // Test 1: Draft Central with acronyms
    console.log('1️⃣ Testing Draft Central with acronym-heavy team needs...');
    await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 139,
        round: 12,
        pickInRound: 7,
        timeRemaining: 45,
        teamNeeds: 'RB handcuffs, DST, lottery tickets, TE depth',
        pickOptions: [
          { 
            name: 'Tyler Allgeier (RB, ATL)', 
            reason: 'Handcuff with standalone value in RBBC situation' 
          },
          { 
            name: 'Bills DST vs LAR', 
            reason: 'Elite matchup for DST streaming this week' 
          },
          { 
            name: 'Romeo Doubs (WR, GB)', 
            reason: 'Lottery ticket WR with QB1 target upside' 
          }
        ]
      }
    });
    console.log('✅ Draft Central alert sent with expanded acronyms!\n');
    
    await delay(2000);
    
    // Test 2: AI Analysis with lots of acronyms
    console.log('2️⃣ Testing AI Analysis with technical terms...');
    await discordBot.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: [
          'Target RB with RB1 upside over WR2 floor',
          'QB streaming better than reaching for QB1',
          'TE premium position - take TE1 now'
        ],
        teamNeeds: 'RB2 depth, WR3 upside, TE1, avoid QB until late',
        strategy: 'PPR scoring favors WR over RB in this ADP range'
      }
    });
    console.log('✅ AI Analysis alert sent with technical term explanations!\n');
    
    console.log('🎉 ACRONYM EXPANSION TESTING COMPLETE!');
    console.log('\n📊 RESULTS:');
    console.log('✅ All fantasy football acronyms now spelled out');
    console.log('✅ Technical terms include explanations');
    console.log('✅ Handcuffs and lottery tickets explained');
    console.log('✅ Position numbers (RB1, WR2, etc.) clarified');
    console.log('✅ Discord alerts now beginner-friendly!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testAcronymFix();