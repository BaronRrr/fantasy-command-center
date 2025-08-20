const LiveGameMonitor = require('./src/monitoring/live-game-monitor');

async function testLiveGameMonitor() {
  console.log('🏈 Testing Live Game Monitor...\n');
  
  // Your live webhook URL
  const liveWebhookUrl = 'https://discord.com/api/webhooks/1407801106297520149/9O8DNPDq4TWp8ynQu2R2n7nVL9DQFQLEk59KLycaGwzot3I8sjzhksZfynkkif9M2tmz';
  
  // Create monitor instance
  const monitor = new LiveGameMonitor();
  
  // Add some test players to watchlist
  console.log('📋 Adding test players to watchlist...');
  monitor.addPlayersToWatchlist([
    'Christian McCaffrey',
    'Saquon Barkley', 
    'Josh Allen',
    'Travis Kelce',
    'Tyreek Hill'
  ]);
  
  // Start monitoring with webhook
  console.log('🚀 Starting live game monitoring...');
  await monitor.startMonitoring(liveWebhookUrl);
  
  // Check status
  console.log('📊 Monitor Status:', monitor.getStatus());
  
  // Test game checking
  console.log('\n🔍 Checking for active games...');
  await monitor.checkActiveGames();
  
  console.log('✅ Live game monitoring test complete!');
  console.log('📱 Monitor will now run continuously checking for:');
  console.log('   • Live NFL games (preseason & regular season)');
  console.log('   • Score updates every 30 seconds');
  console.log('   • Player stats every 15 seconds');
  console.log('   • Snap counts, targets, red zone usage');
  console.log('   • Live injury updates');
  
  // Keep running for a few minutes to test
  console.log('\n⏰ Running for 5 minutes to test live monitoring...');
  setTimeout(() => {
    console.log('⏹️ Stopping test monitor');
    monitor.stopMonitoring();
    process.exit(0);
  }, 5 * 60 * 1000); // 5 minutes
}

testLiveGameMonitor().catch(console.error);