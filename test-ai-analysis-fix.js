const DiscordNotifier = require('./src/alerts/discord-bot');

async function testAIAnalysisFix() {
  console.log('🤖 TESTING AI ANALYSIS CHANNEL FIX...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    console.log('🔍 Checking AI Analysis webhook:');
    console.log('URL:', discordBot.webhooks.aiAnalysis ? 'Configured ✅' : 'Missing ❌');
    console.log('');
    
    // Test 1: Direct AI Analysis Alert
    console.log('1️⃣ Testing AI_RECOMMENDATIONS with enhanced data...');
    const aiAlert = await discordBot.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'HIGH',
      data: {
        recommendations: [
          '🔥 Josh Jacobs (RB, LV) - Elite volume floor, 320+ touches projected, weak schedule ahead',
          '⚡ DeVonta Smith (WR, PHI) - Target monster with 140+ targets, elite separation metrics',
          '💪 George Kittle (TE, SF) - Premium TE1 upside when healthy, red zone magnet'
        ],
        topRecommendation: 'Josh Jacobs (RB, LV)',
        teamNeeds: 'URGENT: RB depth critically needed after missing top tier, WR2 slot wide open, TE upgrade available',
        strategy: 'PRIORITY: Secure RB in next 2 picks before tier break, then pivot to high-upside WR in rounds 3-4. Avoid QB early.'
      }
    });
    console.log('AI Analysis Result:', aiAlert ? '✅ SENT' : '❌ FAILED');
    console.log('');
    
    await delay(3000);
    
    // Test 2: Enhanced AI Analysis with more detail
    console.log('2️⃣ Testing enhanced AI analysis with full breakdown...');
    const detailedAI = await discordBot.sendMultiChannelAlert({
      type: 'AI_RECOMMENDATIONS',
      urgency: 'CRITICAL',
      data: {
        recommendations: [
          '🎯 ROUND 2 TARGET: Josh Jacobs (RB, LV)\n   • 322 touch projection (league-leading volume)\n   • Soft schedule: 28th ranked run defense matchups\n   • Zero competition for touches\n   • RB6 floor, RB3 ceiling',
          
          '⚡ ALTERNATIVE: DeVonta Smith (WR, PHI)\n   • 142 target projection in Hurts offense\n   • Elite 72% catch rate on contested balls\n   • WR12 floor, WR6 ceiling in explosive offense\n   • Perfect WR1 complement',
          
          '🔒 SAFE PICK: George Kittle (TE, SF)\n   • Only TE with true WR1 upside\n   • 85% snap rate when healthy\n   • Red zone monster: 12+ TD upside\n   • Immediate TE advantage over league'
        ],
        topRecommendation: 'Josh Jacobs (RB, LV) - Best combination of floor and upside',
        teamNeeds: 'CRITICAL ANALYSIS:\n🚨 RB: Zero depth after missing Tier 1, MUST address\n📊 WR: Solid WR1, need explosive WR2 upside\n🎯 TE: Huge advantage available at position\n⚠️ QB: AVOID - deep position this year',
        strategy: 'OPTIMAL PATH: RB-WR-RB-WR through Round 4, then target QB value in Round 6-8. This maximizes weekly ceiling while securing safe floor.'
      }
    });
    console.log('Detailed AI Result:', detailedAI ? '✅ SENT' : '❌ FAILED');
    console.log('');
    
    await delay(3000);
    
    // Test 3: Test other channels to compare
    console.log('3️⃣ Testing draft central for comparison...');
    const draftTest = await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 23,
        round: 2,
        timeRemaining: 60,
        topRecommendation: 'Josh Jacobs (RB, LV) - AI CONFIDENT PICK'
      }
    });
    console.log('Draft Central Result:', draftTest ? '✅ SENT' : '❌ FAILED');
    console.log('');
    
    console.log('🔍 DIAGNOSIS:');
    if (aiAlert && detailedAI) {
      console.log('✅ AI Analysis channel is working - may have been temporary Discord issue');
    } else {
      console.log('❌ AI Analysis channel has persistent issues - checking configuration...');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testAIAnalysisFix();