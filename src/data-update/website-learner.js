const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

class FantasyWebsiteLearner {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.websites = {
      draftsharks_rookies: 'https://www.draftsharks.com/adp/rookie/ppr/sleeper/12',
      draftsharks_bestball: 'https://www.draftsharks.com/adp/best-ball/half-ppr/underdog/12',
      fantasypros_rankings: 'https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php',
      fantasypros_adp: 'https://www.fantasypros.com/nfl/adp/overall.php'
    };
    this.learnedData = {};
  }

  async learnAllWebsites() {
    console.log('🔍 Learning from fantasy football websites...');
    
    for (const [site, url] of Object.entries(this.websites)) {
      try {
        console.log(`📚 Learning from ${site}...`);
        const data = await this.learnWebsite(site, url);
        this.learnedData[site] = data;
        console.log(`✅ ${site}: ${data.players?.length || 0} players learned`);
      } catch (error) {
        console.log(`⚠️ Failed to learn from ${site}: ${error.message}`);
        this.learnedData[site] = { error: error.message };
      }
    }

    await this.saveLearnedData();
    return this.learnedData;
  }

  async learnWebsite(site, url) {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    
    switch (site) {
      case 'draftsharks_rookies':
        return this.parseDraftSharksRookies($);
      case 'draftsharks_bestball':
        return this.parseDraftSharksBestBall($);
      case 'fantasypros_rankings':
        return this.parseFantasyProsRankings($);
      case 'fantasypros_adp':
        return this.parseFantasyProsADP($);
      default:
        throw new Error(`Unknown site: ${site}`);
    }
  }

  parseDraftSharksRookies($) {
    const players = [];
    
    // DraftSharks typically uses tables for ADP data
    $('table tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const rank = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const team = $(cells[2]).text().trim();
        const position = $(cells[3]).text().trim();
        const adp = $(cells[4]).text().trim();
        
        if (name && team && position) {
          players.push({
            rank: parseInt(rank) || 0,
            name: name,
            team: team,
            position: position,
            adp: parseFloat(adp) || 0,
            type: 'rookie',
            source: 'draftsharks'
          });
        }
      }
    });

    return {
      players: players,
      type: 'rookie_adp',
      format: 'PPR',
      platform: 'Sleeper',
      teams: 12,
      lastUpdated: new Date().toISOString()
    };
  }

  parseDraftSharksBestBall($) {
    const players = [];
    
    $('table tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 4) {
        const rank = $(cells[0]).text().trim();
        const name = $(cells[1]).text().trim();
        const team = $(cells[2]).text().trim();
        const position = $(cells[3]).text().trim();
        const adp = $(cells[4]).text().trim();
        
        if (name && team && position) {
          players.push({
            rank: parseInt(rank) || 0,
            name: name,
            team: team,
            position: position,
            adp: parseFloat(adp) || 0,
            type: 'best_ball',
            source: 'draftsharks'
          });
        }
      }
    });

    return {
      players: players,
      type: 'best_ball_adp',
      format: 'Half-PPR',
      platform: 'Underdog',
      teams: 12,
      lastUpdated: new Date().toISOString()
    };
  }

  parseFantasyProsRankings($) {
    const players = [];
    
    // FantasyPros consensus rankings
    $('.player-label').each((i, element) => {
      const $element = $(element);
      const name = $element.text().trim();
      const rank = i + 1;
      
      // Try to find associated team/position info
      const $row = $element.closest('tr');
      const team = $row.find('.team').text().trim();
      const position = $row.find('.position').text().trim();
      
      if (name) {
        players.push({
          rank: rank,
          name: name,
          team: team,
          position: position,
          type: 'consensus_ranking',
          source: 'fantasypros'
        });
      }
    });

    return {
      players: players,
      type: 'consensus_rankings',
      lastUpdated: new Date().toISOString()
    };
  }

  parseFantasyProsADP($) {
    const players = [];
    
    // FantasyPros ADP data
    $('table tbody tr').each((i, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      
      if (cells.length >= 3) {
        const rank = $(cells[0]).text().trim();
        const playerInfo = $(cells[1]).text().trim();
        const adp = $(cells[2]).text().trim();
        
        // Parse player name, team, position from combined cell
        const matches = playerInfo.match(/(.+?)\s+([A-Z]{2,3})\s+([A-Z]{1,3})$/);
        
        if (matches) {
          const [, name, team, position] = matches;
          
          players.push({
            rank: parseInt(rank) || 0,
            name: name.trim(),
            team: team,
            position: position,
            adp: parseFloat(adp) || 0,
            type: 'adp',
            source: 'fantasypros'
          });
        }
      }
    });

    return {
      players: players,
      type: 'adp_data',
      lastUpdated: new Date().toISOString()
    };
  }

  async saveLearnedData() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const outputFile = path.join(this.dataDir, 'learned-website-data.json');
    
    const data = {
      lastUpdated: new Date().toISOString(),
      websites: this.learnedData,
      summary: {
        totalPlayers: Object.values(this.learnedData)
          .reduce((sum, site) => sum + (site.players?.length || 0), 0),
        sourcesLearned: Object.keys(this.learnedData).length
      }
    };

    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));
    console.log(`💾 Learned data saved to ${outputFile}`);
  }

  getLearnedInsights() {
    const insights = {
      rookieTargets: [],
      bestBallStrategy: [],
      valuePicksByADP: [],
      consensusDisagreements: []
    };

    // Analyze rookie data
    if (this.learnedData.draftsharks_rookies?.players) {
      insights.rookieTargets = this.learnedData.draftsharks_rookies.players
        .filter(p => p.adp > 100) // Late round rookies
        .slice(0, 5);
    }

    // Analyze best ball vs standard differences
    if (this.learnedData.draftsharks_bestball?.players) {
      insights.bestBallStrategy = this.learnedData.draftsharks_bestball.players
        .slice(0, 20); // Top 20 best ball picks
    }

    return insights;
  }
}

// Run if called directly
if (require.main === module) {
  const learner = new FantasyWebsiteLearner();
  learner.learnAllWebsites()
    .then(() => {
      console.log('✅ Website learning complete');
      const insights = learner.getLearnedInsights();
      console.log('📊 Key Insights:', JSON.stringify(insights, null, 2));
    })
    .catch(error => console.error('❌ Learning failed:', error));
}

module.exports = FantasyWebsiteLearner;