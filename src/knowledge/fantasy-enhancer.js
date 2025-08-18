const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

class FantasyKnowledgeEnhancer {
  constructor() {
    this.knowledgeBase = new Map();
    this.dataDir = path.join(__dirname, '../../data');
    this.articlesDir = path.join(this.dataDir, 'articles');
    this.adpDir = path.join(this.dataDir, 'adp');
    this.draftsDir = path.join(this.dataDir, 'other-drafts');
    this.gameDataDir = path.join(this.dataDir, 'game-data');
    
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.articlesDir, { recursive: true });
      await fs.mkdir(this.adpDir, { recursive: true });
      await fs.mkdir(this.draftsDir, { recursive: true });
      await fs.mkdir(this.gameDataDir, { recursive: true });
      logger.info('Knowledge base directories initialized');
    } catch (error) {
      logger.error('Failed to initialize directories:', error.message);
    }
  }

  // Add preseason articles to knowledge base
  async addArticle(title, content, source, category = 'general') {
    try {
      const article = {
        title,
        content,
        source,
        category,
        timestamp: new Date().toISOString(),
        id: `article-${Date.now()}`
      };

      const filename = `${article.id}.json`;
      const filepath = path.join(this.articlesDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(article, null, 2));
      
      // Store in memory for quick access
      this.knowledgeBase.set(article.id, article);
      
      logger.info(`Article added: ${title} (${source})`);
      return article.id;
    } catch (error) {
      logger.error('Failed to add article:', error.message);
      throw error;
    }
  }

  // Add ADP data for comparison
  async addADPData(source, year, data) {
    try {
      const adpData = {
        source,
        year,
        data,
        timestamp: new Date().toISOString(),
        id: `adp-${source}-${year}`
      };

      const filename = `${adpData.id}.json`;
      const filepath = path.join(this.adpDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(adpData, null, 2));
      
      logger.info(`ADP data added: ${source} ${year}`);
      return adpData.id;
    } catch (error) {
      logger.error('Failed to add ADP data:', error.message);
      throw error;
    }
  }

  // Add other people's draft data (anonymized)
  async addDraftData(draftInfo, picks) {
    try {
      const draftData = {
        leagueSize: draftInfo.size,
        scoringType: draftInfo.scoring,
        date: draftInfo.date,
        picks: picks.map(pick => ({
          overall: pick.overall,
          round: pick.round,
          player: pick.player,
          position: pick.position,
          adp: pick.adp,
          value: pick.value
        })),
        timestamp: new Date().toISOString(),
        id: `draft-${Date.now()}`
      };

      const filename = `${draftData.id}.json`;
      const filepath = path.join(this.draftsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(draftData, null, 2));
      
      logger.info(`Draft data added: ${draftInfo.size}-team ${draftInfo.scoring}`);
      return draftData.id;
    } catch (error) {
      logger.error('Failed to add draft data:', error.message);
      throw error;
    }
  }

  // Search knowledge base for relevant info
  async searchKnowledge(query, category = null) {
    try {
      const results = [];
      
      // Search articles
      const articleFiles = await fs.readdir(this.articlesDir);
      for (const file of articleFiles) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.articlesDir, file);
          const article = JSON.parse(await fs.readFile(filepath, 'utf8'));
          
          if (category && article.category !== category) continue;
          
          if (this.matchesQuery(article, query)) {
            results.push({
              type: 'article',
              ...article,
              relevance: this.calculateRelevance(article, query)
            });
          }
        }
      }
      
      // Search ADP data
      const adpFiles = await fs.readdir(this.adpDir);
      for (const file of adpFiles) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.adpDir, file);
          const adpData = JSON.parse(await fs.readFile(filepath, 'utf8'));
          
          if (this.matchesQueryADP(adpData, query)) {
            results.push({
              type: 'adp',
              ...adpData,
              relevance: this.calculateRelevanceADP(adpData, query)
            });
          }
        }
      }

      // Sort by relevance
      return results.sort((a, b) => b.relevance - a.relevance);
    } catch (error) {
      logger.error('Failed to search knowledge:', error.message);
      return [];
    }
  }

  matchesQuery(article, query) {
    const searchText = `${article.title} ${article.content}`.toLowerCase();
    const queryWords = query.toLowerCase().split(' ');
    
    return queryWords.some(word => searchText.includes(word));
  }

  matchesQueryADP(adpData, query) {
    const queryLower = query.toLowerCase();
    
    // Check if query mentions draft/pick/first
    if (queryLower.includes('draft') || queryLower.includes('pick') || queryLower.includes('first')) {
      return true;
    }
    
    // Check if query mentions specific players
    if (adpData.adp_data) {
      // Handle new ADP format
      return Object.values(adpData.adp_data).some(playerData => 
        playerData.player && playerData.player.toLowerCase().includes(queryLower) ||
        queryLower.includes(playerData.player?.toLowerCase() || '')
      );
    } else if (adpData.data) {
      // Handle old ADP format
      return adpData.data.some(player => 
        player.name.toLowerCase().includes(queryLower) ||
        queryLower.includes(player.name.toLowerCase())
      );
    }
    
    return false;
  }

  calculateRelevance(article, query) {
    const searchText = `${article.title} ${article.content}`.toLowerCase();
    const queryWords = query.toLowerCase().split(' ');
    
    let score = 0;
    queryWords.forEach(word => {
      const matches = (searchText.match(new RegExp(word, 'g')) || []).length;
      score += matches;
    });
    
    // Boost ESPN 2025 projections and draft strategy content
    if (searchText.includes('espn 2025') || searchText.includes('2025 projections')) {
      score += 10;
    }
    if (searchText.includes('draft') && (searchText.includes('first') || searchText.includes('pick'))) {
      score += 5;
    }
    if (article.category === 'draft_strategy' || article.category === 'projections') {
      score += 3;
    }
    
    return score;
  }

  calculateRelevanceADP(adpData, query) {
    const queryLower = query.toLowerCase();
    let score = 0;
    
    adpData.data.forEach(player => {
      if (player.name.toLowerCase().includes(queryLower)) {
        score += 10;
      }
    });
    
    return score;
  }

  // Get draft comparison data for a player
  async getPlayerDraftComparison(playerName) {
    try {
      const draftFiles = await fs.readdir(this.draftsDir);
      const comparisons = [];
      
      for (const file of draftFiles) {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.draftsDir, file);
          const draft = JSON.parse(await fs.readFile(filepath, 'utf8'));
          
          const playerPick = draft.picks.find(pick => 
            pick.player.toLowerCase().includes(playerName.toLowerCase())
          );
          
          if (playerPick) {
            comparisons.push({
              leagueSize: draft.leagueSize,
              scoring: draft.scoringType,
              date: draft.date,
              overall: playerPick.overall,
              round: playerPick.round,
              adp: playerPick.adp,
              value: playerPick.value
            });
          }
        }
      }
      
      return comparisons;
    } catch (error) {
      logger.error('Failed to get draft comparison:', error.message);
      return [];
    }
  }

  // Add NFL game data from spreadsheets
  async addGameData(title, gameDataText, source) {
    try {
      const gameData = {
        title,
        content: gameDataText,
        source,
        category: 'game_data',
        timestamp: new Date().toISOString(),
        id: `gamedata-${Date.now()}`
      };

      const filename = `${gameData.id}.json`;
      const filepath = path.join(this.gameDataDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(gameData, null, 2));
      
      // Store in memory for quick access
      this.knowledgeBase.set(gameData.id, gameData);
      
      logger.info(`Game data added: ${title} (${source})`);
      return gameData.id;
    } catch (error) {
      logger.error('Failed to add game data:', error.message);
      throw error;
    }
  }

  // Get knowledge base stats
  async getStats() {
    try {
      const articleFiles = await fs.readdir(this.articlesDir);
      const adpFiles = await fs.readdir(this.adpDir);
      const draftFiles = await fs.readdir(this.draftsDir);
      const gameDataFiles = await fs.readdir(this.gameDataDir);
      
      return {
        articles: articleFiles.filter(f => f.endsWith('.json')).length,
        adpSources: adpFiles.filter(f => f.endsWith('.json')).length,
        drafts: draftFiles.filter(f => f.endsWith('.json')).length,
        gameData: gameDataFiles.filter(f => f.endsWith('.json')).length,
        totalKnowledge: this.knowledgeBase.size
      };
    } catch (error) {
      logger.error('Failed to get stats:', error.message);
      return { articles: 0, adpSources: 0, drafts: 0, gameData: 0, totalKnowledge: 0 };
    }
  }
}

module.exports = FantasyKnowledgeEnhancer;