const DiscordNotifier = require('./src/alerts/discord-bot');

async function testEnhancedDraftCentral() {
  console.log('🚨 TESTING ENHANCED DRAFT CENTRAL WITH MULTIPLE PICK OPTIONS...\n');
  
  const discordBot = new DiscordNotifier();
  
  try {
    // Test 1: Draft Central with multiple detailed options
    console.log('1️⃣ Testing enhanced MY_TURN alert with 3 pick options...');
    await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 31,
        round: 3,
        pickInRound: 7,
        timeRemaining: 75,
        teamNeeds: 'RB2 depth, WR2 upside, TE upgrade',
        pickOptions: [
          { 
            name: 'Travis Etienne (RB, JAX)', 
            reason: 'Zero backfield competition, 285+ touch upside, explosive Jags offense, perfect RB2 with RB1 weeks' 
          },
          { 
            name: 'Chris Olave (WR, NO)', 
            reason: 'Target monster in Saints system, 120+ targets guaranteed, WR2 floor with elite upside in dome games' 
          },
          { 
            name: 'Dallas Goedert (TE, PHI)', 
            reason: 'Proven red zone target, Hurts loves TEs, top-5 TE upside, immediate positional advantage over league' 
          }
        ]
      }
    });
    console.log('✅ Enhanced draft central alert sent!\n');
    
    await delay(3000);
    
    // Test 2: Later round picks with different options
    console.log('2️⃣ Testing Round 6 pick with value options...');
    await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 67,
        round: 6,
        pickInRound: 7,
        timeRemaining: 60,
        teamNeeds: 'RB depth, QB, late-round WR flyers',
        pickOptions: [
          { 
            name: 'Rachaad White (RB, TB)', 
            reason: 'Tom Brady dump-off king, 80+ targets, goal line work, stealing snaps from Fournette, Round 8 ADP' 
          },
          { 
            name: 'Jalen Hurts (QB, PHI)', 
            reason: 'Rushing floor = QB1 overall ceiling, 1000+ rush yards, goal line vulture, elite fantasy QB in Round 6' 
          },
          { 
            name: 'Jordan Addison (WR, MIN)', 
            reason: 'Justin Jefferson gravity = single coverage, 90+ targets, Vikings love slot WRs, WR2 breakout potential' 
          }
        ]
      }
    });
    console.log('✅ Round 6 value picks alert sent!\n');
    
    await delay(3000);
    
    // Test 3: Late round dart throws
    console.log('3️⃣ Testing Round 12 dart throw options...');
    await discordBot.sendMultiChannelAlert({
      type: 'MY_TURN',
      urgency: 'CRITICAL',
      data: {
        pickNumber: 139,
        round: 12,
        pickInRound: 7,
        timeRemaining: 45,
        teamNeeds: 'Handcuffs, lottery tickets, DST',
        pickOptions: [
          { 
            name: 'Tyler Allgeier (RB, ATL)', 
            reason: 'Cordarrelle Patterson age 31, Arthur Smith loves power running, goal line back, handcuff with standalone value' 
          },
          { 
            name: 'Romeo Doubs (WR, GB)', 
            reason: 'Aaron Rodgers connection building, slot role open, 70+ targets possible, Packers desperate for WR2' 
          },
          { 
            name: 'Bills DST vs LAR', 
            reason: 'Von Miller returning, home opener, Matthew Stafford struggles vs pressure, 10+ point ceiling defense' 
          }
        ]
      }
    });
    console.log('✅ Late round lottery ticket alert sent!\n');
    
    console.log('🎉 ENHANCED DRAFT CENTRAL TESTING COMPLETE!');
    console.log('\n📊 NEW FEATURES:');
    console.log('✅ 3 detailed pick options instead of just 1');
    console.log('✅ Specific reasoning for each player');
    console.log('✅ Team needs context');
    console.log('✅ Round-appropriate recommendations');
    console.log('✅ Urgency and timer pressure');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

testEnhancedDraftCentral();