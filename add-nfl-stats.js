const NFLStatsAPI = require('./src/api/nfl-stats-api');

async function main() {
  console.log('📊 NFL TEAM STATISTICS INTEGRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const nflStats = new NFLStatsAPI();
  
  // Display all the statistical URLs you provided
  console.log('\n🔗 YOUR PROVIDED NFL STATISTICS URLS:');
  const urls = nflStats.displayStatsURLs();
  
  console.log('\n⚡ ADDING STATISTICAL ANALYSIS TO KNOWLEDGE BASE...');
  
  // Add comprehensive statistical analysis to knowledge base
  const success = await nflStats.addAllStatsToKnowledge();
  
  if (success) {
    console.log('✅ NFL team statistics analysis added successfully!');
    console.log('\n🎯 YOUR DISCORD AI NOW UNDERSTANDS:');
    console.log('• Team offensive statistical performance');
    console.log('• Team defensive vulnerabilities');
    console.log('• Fantasy-relevant statistical correlations');
    console.log('• Weekly matchup advantages');
    console.log('• Statistical streaming opportunities');
    
    console.log('\n🤖 TRY THESE DISCORD COMMANDS:');
    console.log('• !coach Which teams have the worst run defense?');
    console.log('• !coach Show me high-scoring offensive environments');
    console.log('• !coach What defenses should I target for streaming?');
    console.log('• !coach Statistical matchup for [player name]');
    
    console.log('\n💡 MANUAL ANALYSIS:');
    console.log('Visit the URLs above to get real-time statistical data');
    console.log('Use the knowledge base insights for draft and lineup decisions');
    
  } else {
    console.log('❌ Failed to add NFL statistics to knowledge base');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 Ready for enhanced statistical fantasy analysis!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = NFLStatsAPI;