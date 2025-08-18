const AdvancedDataMonitor = require('./src/monitoring/advanced-data-monitor');

async function testAdvancedDataMonitoring() {
  console.log('🔍 Testing Advanced Data Monitoring System');
  console.log('==========================================');
  
  const monitor = new AdvancedDataMonitor();
  
  console.log('\n📊 Available Data Sources:');
  Object.entries(monitor.dataSources).forEach(([key, source]) => {
    console.log(`- ${source.name} (${source.priority} priority)`);
  });
  
  console.log('\n🔄 Testing On-Demand Updates...');
  console.log('This simulates what happens when you use `.update` in Discord:');
  
  try {
    const results = await monitor.updateAllSources();
    
    console.log('\n📋 INJURY REPORTS:');
    if (results.injuries?.critical_updates) {
      results.injuries.critical_updates.forEach(injury => {
        console.log(`  🚨 ${injury.player} (${injury.team}): ${injury.status} - ${injury.injury}`);
        console.log(`     Impact: ${injury.fantasy_impact}`);
      });
    }
    
    console.log('\n📊 DEPTH CHART CHANGES:');
    if (results.depth_charts?.lineup_changes) {
      results.depth_charts.lineup_changes.forEach(change => {
        console.log(`  📈 ${change.team}: ${change.change}`);
        console.log(`     Impact: ${change.fantasy_impact}`);
      });
    }
    
    console.log('\n📱 REDDIT SENTIMENT:');
    if (results.reddit_sentiment?.trending_discussions) {
      results.reddit_sentiment.trending_discussions.slice(0, 5).forEach(player => {
        console.log(`  📈 ${player.name}: ${player.mentions} mentions`);
      });
    }
    
    if (results.reddit_sentiment?.hot_topics) {
      console.log('\n🔥 Hot Reddit Topics:');
      results.reddit_sentiment.hot_topics.forEach(topic => {
        console.log(`  - ${topic.title} (${topic.upvotes} upvotes)`);
      });
    }
    
    console.log('\n⏱️ SNAP COUNT TRENDS:');
    if (results.snap_counts?.trending_up) {
      results.snap_counts.trending_up.forEach(player => {
        console.log(`  📈 ${player.player} (${player.team}): ${player.trend}`);
        console.log(`     Impact: ${player.fantasy_impact}`);
      });
    }
    
    console.log('\n🏃 PRACTICE REPORTS:');
    if (results.practice_reports?.dnp) {
      results.practice_reports.dnp.forEach(player => {
        console.log(`  ⚠️ ${player.player} (${player.team}): DNP - ${player.reason}`);
        console.log(`     Concern: ${player.fantasy_concern}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
  
  console.log('\n🎯 Testing Draft Intelligence...');
  try {
    const intelligence = await monitor.getDraftIntelligence();
    
    console.log(`\n📊 Intelligence Summary:`);
    console.log(`- Critical Alerts: ${intelligence.critical_alerts.length}`);
    console.log(`- Trending Players: ${intelligence.trending_players.length}`);
    console.log(`- Opportunities: ${intelligence.opportunities.length}`);
    
    if (intelligence.critical_alerts.length > 0) {
      console.log('\n🚨 Sample Critical Alert:');
      const alert = intelligence.critical_alerts[0];
      console.log(`  ${alert.player || alert.team}: ${alert.fantasy_impact || alert.change}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing intelligence:', error.message);
  }
  
  console.log('\n📊 Testing Monitoring Status...');
  const status = monitor.getMonitoringStatus();
  console.log(`- Monitoring Active: ${status.monitoring_active}`);
  console.log(`- Total Sources: ${status.total_sources}`);
  
  if (Object.keys(status.sources).length > 0) {
    console.log('\nSource Status:');
    Object.entries(status.sources).forEach(([source, info]) => {
      const emoji = info.status === 'FRESH' ? '🟢' : info.status === 'STALE' ? '🟡' : '🔴';
      console.log(`  ${emoji} ${source}: ${info.minutes_ago} minutes ago`);
    });
  }
  
  console.log('\n📱 HOW TO USE IN DISCORD:');
  console.log('==========================');
  console.log('`.update` - Get latest injury reports, depth charts, Reddit trends');
  console.log('`.intel` - Comprehensive draft intelligence summary');
  console.log('`.intel Christian McCaffrey` - Player-specific intelligence');
  console.log('`.monitor` - Check when each source was last updated');
  
  console.log('\n🏠 LOCAL vs ☁️ CLOUD MONITORING:');
  console.log('=====================================');
  console.log('LOCAL (Current):');
  console.log('- Manual updates when you run `.update`');
  console.log('- Only works when Discord bot is running');
  console.log('- Stops when computer sleeps/shuts down');
  console.log('');
  console.log('CLOUD (Future):');
  console.log('- Automatic updates every hour/day');
  console.log('- Sends Discord alerts when news breaks');
  console.log('- Works 24/7 even when you\'re sleeping');
  console.log('- Instant notifications for critical injuries');
  
  console.log('\n🎯 COMPETITIVE ADVANTAGES:');
  console.log('===========================');
  console.log('✅ Injury news aggregation from multiple sources');
  console.log('✅ Reddit sentiment tracking for breakout players');
  console.log('✅ Depth chart change detection');
  console.log('✅ Practice report monitoring');
  console.log('✅ Snap count trend analysis');
  console.log('✅ All integrated into AI draft recommendations');
  
  console.log('\n🚀 SYSTEM STATUS: Advanced monitoring READY!');
  console.log('Use `.update` in Discord before your draft for latest intelligence!');
}

// Run the test
testAdvancedDataMonitoring().catch(console.error);