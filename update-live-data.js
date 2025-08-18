const ESPNPublicAPI = require('./src/api/espn-public-api');
const FantasyKnowledgeEnhancer = require('./src/knowledge/fantasy-enhancer');

class LiveDataUpdater {
  constructor() {
    this.espnAPI = new ESPNPublicAPI();
    this.enhancer = new FantasyKnowledgeEnhancer();
  }

  async updateNews() {
    console.log('📰 UPDATING LIVE NFL NEWS...\n');
    
    try {
      const newsCount = await this.espnAPI.addNewsToKnowledgeBase();
      console.log(`✅ Added ${newsCount} new fantasy-relevant articles`);
      
      // Show latest news
      const latestNews = await this.espnAPI.getFantasyRelevantNews();
      console.log('\n🔥 LATEST FANTASY NEWS:');
      
      latestNews.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. ${article.headline}`);
        console.log(`   Impact: ${article.fantasyImpact}`);
        console.log(`   Published: ${new Date(article.published).toLocaleString()}\n`);
      });
      
    } catch (error) {
      console.error('❌ Failed to update news:', error.message);
    }
  }

  async updateScores() {
    console.log('🏈 UPDATING LIVE NFL SCORES...\n');
    
    try {
      const games = await this.espnAPI.getScoreboard();
      
      console.log(`📊 Found ${games.length} NFL games:\n`);
      
      games.slice(0, 10).forEach((game, index) => {
        console.log(`${index + 1}. ${game.shortName}`);
        console.log(`   Score: ${game.away.team} ${game.away.score} - ${game.home.score} ${game.home.team}`);
        console.log(`   Status: ${game.status}`);
        if (game.weather) {
          console.log(`   Weather: ${JSON.stringify(game.weather)}`);
        }
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Failed to update scores:', error.message);
    }
  }

  async updateTeams() {
    console.log('🏈 UPDATING NFL TEAMS DATA...\n');
    
    try {
      const teams = await this.espnAPI.getAllTeams();
      
      console.log(`📊 Found ${teams.length} NFL teams\n`);
      
      // Add team info to knowledge base
      const teamContent = teams.map(team => 
        `${team.name} (${team.abbreviation}): ${team.standingSummary || 'No record available'}`
      ).join('\n');
      
      await this.enhancer.addArticle(
        'NFL Teams 2025 - Current Standings and Info',
        `NFL TEAMS CURRENT STATUS:\n\n${teamContent}\n\nLast Updated: ${new Date().toLocaleString()}`,
        'ESPN NFL API',
        'teams'
      );
      
      console.log('✅ Added NFL teams data to knowledge base');
      
    } catch (error) {
      console.error('❌ Failed to update teams:', error.message);
    }
  }

  async testAPIs() {
    console.log('🧪 TESTING ESPN PUBLIC APIs...\n');
    
    try {
      // Test health
      const health = await this.espnAPI.healthCheck();
      console.log(`🔍 API Health: ${health.status}`);
      
      if (health.status === 'connected') {
        console.log('✅ ESPN Public APIs are working perfectly!');
        console.log('\n🎯 Available data:');
        console.log('   • Live NFL scores and game status');
        console.log('   • Real-time NFL news and injury reports');
        console.log('   • Team rosters and standings');
        console.log('   • Fantasy-relevant article filtering');
        
        console.log('\n🤖 Your Discord AI now has access to:');
        console.log('   • !coach latest NFL news');
        console.log('   • !coach current game scores');
        console.log('   • !coach injury updates');
        console.log('   • !coach team news for [team]');
      } else {
        console.log('❌ API connection failed:', health.error);
      }
      
    } catch (error) {
      console.error('❌ API test failed:', error.message);
    }
  }

  async runFullUpdate() {
    console.log('🚀 RUNNING FULL LIVE DATA UPDATE...\n');
    
    await this.testAPIs();
    console.log('\n' + '━'.repeat(50));
    
    await this.updateNews();
    console.log('\n' + '━'.repeat(50));
    
    await this.updateScores();
    console.log('\n' + '━'.repeat(50));
    
    await this.updateTeams();
    
    console.log('\n🎉 LIVE DATA UPDATE COMPLETE!');
    console.log('💡 Run this script regularly to keep your AI current');
    console.log('🔄 Recommend: Every 30 minutes during game days');
  }
}

async function main() {
  const updater = new LiveDataUpdater();
  
  const args = process.argv.slice(2);
  
  if (args.includes('--news')) {
    await updater.updateNews();
  } else if (args.includes('--scores')) {
    await updater.updateScores();
  } else if (args.includes('--teams')) {
    await updater.updateTeams();
  } else if (args.includes('--test')) {
    await updater.testAPIs();
  } else {
    await updater.runFullUpdate();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = LiveDataUpdater;