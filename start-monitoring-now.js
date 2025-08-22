/**
 * Start Live Game Monitoring RIGHT NOW
 */

const LiveGameMonitor = require('./src/monitoring/live-game-monitor');

async function startMonitoringNow() {
  console.log('🚀 STARTING LIVE GAME MONITORING RIGHT NOW...\n');
  
  try {
    // Create monitor instance
    const monitor = new LiveGameMonitor();
    
    // Set webhook URL to correct channel
    const webhookUrl = 'https://discord.com/api/webhooks/1407801106297520149/9O8DNPDq4TWp8ynQu2R2n7nVL9DQFQLEk59KLycaGwzot3I8sjzhksZfynkkif9M2tmz';
    
    // Add popular players to watchlist
    const watchedPlayers = [
      'Saquon Barkley', 'Christian McCaffrey', 'CeeDee Lamb', 'Tyreek Hill',
      'Josh Allen', 'Patrick Mahomes', 'Travis Kelce', 'Derrick Henry',
      'Stefon Diggs', 'Cooper Kupp', 'Davante Adams', 'A.J. Brown',
      'Josh Jacobs', 'Austin Ekeler', 'Tony Pollard', 'Courtland Sutton'
    ];
    
    monitor.addPlayersToWatchlist(watchedPlayers);
    console.log(`🎯 Added ${watchedPlayers.length} players to watchlist`);
    
    // Start monitoring
    console.log('🔄 Starting monitoring with webhook...');
    await monitor.startMonitoring(webhookUrl);
    
    console.log('✅ LIVE GAME MONITORING IS NOW ACTIVE!\n');
    console.log('📊 Monitor status:', monitor.getStatus());
    
    // Keep the script running and show status
    console.log('\n🔄 Monitoring will run continuously...');
    console.log('You should start seeing Discord alerts within 15 seconds!');
    console.log('Press Ctrl+C to stop\n');
    
    // Status updates every 30 seconds
    setInterval(() => {
      const status = monitor.getStatus();
      console.log(`📊 Status: ${status.monitoring ? 'ACTIVE' : 'INACTIVE'} | Live Games: ${status.activeGames} | Watched: ${status.watchedPlayers} | Time: ${new Date().toLocaleTimeString()}`);
    }, 30000);
    
    // Cleanup on exit
    process.on('SIGINT', () => {
      console.log('\n⏹️ Stopping live game monitoring...');
      monitor.stopMonitoring();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start monitoring:', error);
  }
}

// Start immediately
startMonitoringNow();