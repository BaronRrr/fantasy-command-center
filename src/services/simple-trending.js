const axios = require('axios');
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

class SimpleTrendingAnalyzer {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes cache
  }

  async getTrendingPlayers() {
    try {
      // Check cache first
      const cached = this.cache.get('trending');
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data;
      }

      logger.info('🔍 Fetching trending players from Reddit...');
      
      const url = 'https://www.reddit.com/r/fantasyfootball/hot.json?limit=50';
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'FantasyCommandCenter/1.0.0'
        },
        timeout: 15000
      });

      const trending = this.parseRedditPosts(response.data);
      
      // Cache the result
      this.cache.set('trending', {
        data: trending,
        timestamp: Date.now()
      });

      return trending;

    } catch (error) {
      logger.error('Failed to fetch trending players:', error.message);
      return this.getFallbackTrending();
    }
  }

  parseRedditPosts(redditData) {
    const playerMentions = new Map();
    const posts = redditData.data.children;

    // Common NFL player names to look for
    const playerNames = [
      'Josh Allen', 'Lamar Jackson', 'Patrick Mahomes', 'Dak Prescott', 'Joe Burrow',
      'Justin Herbert', 'Tua Tagovailoa', 'Anthony Richardson', 'Daniel Jones', 'Russell Wilson',
      'Christian McCaffrey', 'Derrick Henry', 'Josh Jacobs', 'Saquon Barkley', 'Austin Ekeler',
      'Tony Pollard', 'Alvin Kamara', 'Joe Mixon', 'Kenneth Walker', 'Nick Chubb',
      'Cooper Kupp', 'Davante Adams', 'Tyreek Hill', 'Stefon Diggs', 'CeeDee Lamb',
      'Justin Jefferson', 'Ja\'Marr Chase', 'A.J. Brown', 'Mike Evans', 'Chris Olave',
      'Puka Nacua', 'Amon-Ra St. Brown', 'DeVonta Smith', 'DK Metcalf', 'Jaylen Waddle',
      'Travis Kelce', 'Mark Andrews', 'George Kittle', 'Sam LaPorta', 'Evan Engram',
      'T.J. Hockenson', 'Kyle Pitts', 'Isaiah Likely', 'Dalton Kincaid', 'Jake Ferguson',
      'De\'Von Achane', 'Raheem Mostert', 'Tank Dell', 'Nico Collins', 'Jalen McMillan',
      'Rome Odunze', 'Caleb Williams', 'Jayden Daniels', 'Bo Nix', 'Drake Maye'
    ];

    for (const post of posts) {
      const title = post.data.title;
      const score = post.data.score;
      const comments = post.data.num_comments;
      const created = post.data.created_utc;
      
      // Only consider recent posts (last 24 hours) with decent engagement
      const hoursOld = (Date.now() / 1000 - created) / 3600;
      if (hoursOld > 24 || score < 5) continue;

      // Check if title mentions any players
      for (const playerName of playerNames) {
        if (title.toLowerCase().includes(playerName.toLowerCase())) {
          
          if (!playerMentions.has(playerName)) {
            playerMentions.set(playerName, {
              name: playerName,
              mentions: 0,
              totalScore: 0,
              totalComments: 0,
              posts: [],
              reasons: []
            });
          }

          const player = playerMentions.get(playerName);
          player.mentions += 1;
          player.totalScore += score;
          player.totalComments += comments;
          player.posts.push({
            title: title,
            score: score,
            comments: comments,
            hoursOld: hoursOld
          });

          // Extract trending reason from title
          const reason = this.extractTrendingReason(playerName, title);
          if (reason && !player.reasons.includes(reason)) {
            player.reasons.push(reason);
          }
        }
      }
    }

    // Convert to sorted array
    const trending = Array.from(playerMentions.values())
      .filter(player => player.mentions >= 1) // At least 1 mention
      .map(player => ({
        ...player,
        avgScore: Math.round(player.totalScore / player.mentions),
        engagement: player.totalScore + (player.totalComments * 1.5),
        primaryReason: player.reasons[0] || 'General discussion',
        topPost: player.posts.sort((a, b) => b.score - a.score)[0]
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 8); // Top 8

    return {
      players: trending,
      generated: new Date().toISOString(),
      source: 'reddit-r-fantasyfootball'
    };
  }

  extractTrendingReason(playerName, title) {
    const lowerTitle = title.toLowerCase();
    const lowerName = playerName.toLowerCase();

    // Remove player name from title for cleaner analysis
    const titleWithoutName = lowerTitle.replace(lowerName, '').trim();

    // Check for specific reasons
    if (lowerTitle.includes('waiver') || lowerTitle.includes('pickup') || lowerTitle.includes('add')) {
      return 'Waiver wire target';
    }
    
    if (lowerTitle.includes('start') && lowerTitle.includes('sit')) {
      return 'Start/sit decision';
    }
    
    if (lowerTitle.includes('trade')) {
      return 'Trade discussion';
    }
    
    if (lowerTitle.includes('injury') || lowerTitle.includes('injured') || lowerTitle.includes('hurt')) {
      return 'Injury concern';
    }
    
    if (lowerTitle.includes('breakout') || lowerTitle.includes('sleeper')) {
      return 'Breakout potential';
    }
    
    if (lowerTitle.includes('drop') || lowerTitle.includes('cut')) {
      return 'Drop candidate';
    }
    
    if (lowerTitle.includes('news') || lowerTitle.includes('update')) {
      return 'News update';
    }
    
    if (lowerTitle.includes('discussion') || lowerTitle.includes('thoughts') || lowerTitle.includes('opinion')) {
      return 'Community discussion';
    }
    
    if (lowerTitle.includes('vs') || lowerTitle.includes('or') || lowerTitle.includes('better')) {
      return 'Player comparison';
    }
    
    if (lowerTitle.includes('outlook') || lowerTitle.includes('season') || lowerTitle.includes('rest of')) {
      return 'Season outlook';
    }

    // If no specific reason found, try to extract key phrase
    if (titleWithoutName.length > 10 && titleWithoutName.length < 50) {
      return titleWithoutName.charAt(0).toUpperCase() + titleWithoutName.slice(1);
    }

    return 'General discussion';
  }

  formatForDiscord(analysis) {
    if (!analysis.players || analysis.players.length === 0) {
      return 'No trending players found in recent Reddit discussions.';
    }

    let response = `**🔥 Trending Players (Reddit r/fantasyfootball)**\n\n`;

    analysis.players.slice(0, 6).forEach((player, index) => {
      const teamInfo = this.getPlayerTeam(player.name);
      
      response += `**${index + 1}. ${player.name}**${teamInfo}\n`;
      response += `📈 **${player.primaryReason}**\n`;
      response += `💬 ${player.mentions} posts, ${Math.round(player.engagement)} engagement\n`;
      
      if (player.topPost && player.topPost.title.length < 80) {
        response += `🔥 "${player.topPost.title}"\n`;
      }
      
      response += `\n`;
    });

    response += `📊 Generated: ${new Date(analysis.generated).toLocaleTimeString()}\n`;
    response += `📱 Source: Reddit r/fantasyfootball`;

    return response;
  }

  getPlayerTeam(playerName) {
    // Basic team mapping for common players
    const teams = {
      'Josh Allen': ' (QB, BUF)',
      'Lamar Jackson': ' (QB, BAL)',
      'Patrick Mahomes': ' (QB, KC)',
      'Dak Prescott': ' (QB, DAL)',
      'Joe Burrow': ' (QB, CIN)',
      'Justin Herbert': ' (QB, LAC)',
      'Tua Tagovailoa': ' (QB, MIA)',
      'Anthony Richardson': ' (QB, IND)',
      'Daniel Jones': ' (QB, NYG)',
      'Russell Wilson': ' (QB, PIT)',
      'Christian McCaffrey': ' (RB, SF)',
      'Derrick Henry': ' (RB, BAL)',
      'Josh Jacobs': ' (RB, GB)',
      'Saquon Barkley': ' (RB, PHI)',
      'Austin Ekeler': ' (RB, WAS)',
      'Tony Pollard': ' (RB, TEN)',
      'Alvin Kamara': ' (RB, NO)',
      'Joe Mixon': ' (RB, HOU)',
      'Kenneth Walker': ' (RB, SEA)',
      'Nick Chubb': ' (RB, CLE)',
      'Cooper Kupp': ' (WR, LAR)',
      'Davante Adams': ' (WR, NYJ)',
      'Tyreek Hill': ' (WR, MIA)',
      'Stefon Diggs': ' (WR, HOU)',
      'CeeDee Lamb': ' (WR, DAL)',
      'Justin Jefferson': ' (WR, MIN)',
      'Ja\'Marr Chase': ' (WR, CIN)',
      'A.J. Brown': ' (WR, PHI)',
      'Mike Evans': ' (WR, TB)',
      'Chris Olave': ' (WR, NO)',
      'Puka Nacua': ' (WR, LAR)',
      'Amon-Ra St. Brown': ' (WR, DET)',
      'DeVonta Smith': ' (WR, PHI)',
      'DK Metcalf': ' (WR, SEA)',
      'Jaylen Waddle': ' (WR, MIA)',
      'Travis Kelce': ' (TE, KC)',
      'Mark Andrews': ' (TE, BAL)',
      'George Kittle': ' (TE, SF)',
      'Sam LaPorta': ' (TE, DET)',
      'Evan Engram': ' (TE, JAX)',
      'T.J. Hockenson': ' (TE, MIN)',
      'Kyle Pitts': ' (TE, ATL)',
      'Isaiah Likely': ' (TE, BAL)',
      'Dalton Kincaid': ' (TE, BUF)',
      'De\'Von Achane': ' (RB, MIA)',
      'Raheem Mostert': ' (RB, MIA)',
      'Tank Dell': ' (WR, HOU)',
      'Nico Collins': ' (WR, HOU)',
      'Jalen McMillan': ' (WR, TB)',
      'Rome Odunze': ' (WR, CHI)',
      'Caleb Williams': ' (QB, CHI)',
      'Jayden Daniels': ' (QB, WAS)',
      'Bo Nix': ' (QB, DEN)',
      'Drake Maye': ' (QB, NE)'
    };

    return teams[playerName] || '';
  }

  getFallbackTrending() {
    return {
      players: [],
      generated: new Date().toISOString(),
      source: 'fallback',
      message: 'Unable to fetch trending data at this time. Please try again in a few minutes.'
    };
  }
}

module.exports = SimpleTrendingAnalyzer;