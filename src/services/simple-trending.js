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
    this.cacheExpiry = 1 * 60 * 1000; // 1 minute cache for testing
    logger.info('🔥 SimpleTrendingAnalyzer initialized - new version with Reddit post titles');
  }

  async getTrendingPlayers() {
    try {
      // Check cache first
      const cached = this.cache.get('trending');
      if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
        return cached.data;
      }

      logger.info('🔍 Gathering trending players from multiple sources...');
      
      // Get data from multiple sources
      const [redditTrending, newsCrossRef] = await Promise.all([
        this.getRedditTrending(),
        this.getNewsCrossReference()
      ]);
      
      // Combine and correlate the data
      const combined = this.correlateTrendingData(redditTrending, newsCrossRef);
      
      // Cache the result
      this.cache.set('trending', {
        data: combined,
        timestamp: Date.now()
      });

      return combined;

    } catch (error) {
      logger.error('Failed to fetch trending players:', error.message);
      return this.getFallbackTrending();
    }
  }

  // Get trending players from Reddit
  async getRedditTrending() {
    try {
      const url = 'https://www.reddit.com/r/fantasyfootball/hot.json?limit=50';
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'FantasyCommandCenter/1.0.0'
        },
        timeout: 15000
      });

      return this.parseRedditPosts(response.data);
    } catch (error) {
      logger.warn('Failed to get Reddit trending:', error.message);
      return [];
    }
  }

  // Cross-reference with news sources for additional context
  async getNewsCrossReference() {
    try {
      // Get current NFL news to cross-reference
      const newsResponse = await axios.get('https://www.nfl.com/news/', {
        headers: {
          'User-Agent': 'FantasyCommandCenter/1.0.0'
        },
        timeout: 10000
      });

      // Extract player mentions from headlines
      const cheerio = require('cheerio');
      const $ = cheerio.load(newsResponse.data);
      const newsPlayers = [];

      $('h1, h2, h3, h4, .headline, .title').each((i, element) => {
        const headline = $(element).text().trim();
        const players = this.extractPlayerNamesFromText(headline);
        
        players.forEach(player => {
          newsPlayers.push({
            name: player,
            source: 'NFL.com',
            context: headline,
            url: 'https://www.nfl.com/news/',
            type: 'news_mention'
          });
        });
      });

      return newsPlayers;
    } catch (error) {
      logger.warn('Failed to get news cross-reference:', error.message);
      return [];
    }
  }

  // Correlate trending data from multiple sources
  correlateTrendingData(redditTrending, newsCrossRef) {
    const combined = [...redditTrending];
    
    // Enhance Reddit trending with news context
    combined.forEach(player => {
      const newsMatches = newsCrossRef.filter(news => 
        news.name.toLowerCase().includes(player.name.toLowerCase()) ||
        player.name.toLowerCase().includes(news.name.toLowerCase())
      );
      
      if (newsMatches.length > 0) {
        player.sources = player.sources || ['Reddit'];
        player.sources.push('NFL.com');
        player.newsContext = newsMatches[0].context;
        player.newsUrl = newsMatches[0].url;
        player.crossReferenced = true;
      }
    });

    // Add news-only trending players not found on Reddit
    newsCrossRef.forEach(newsPlayer => {
      const existsInReddit = combined.some(player => 
        player.name.toLowerCase().includes(newsPlayer.name.toLowerCase()) ||
        newsPlayer.name.toLowerCase().includes(player.name.toLowerCase())
      );
      
      if (!existsInReddit && newsPlayer.name.length > 5) {
        combined.push({
          name: newsPlayer.name,
          reason: newsPlayer.context,
          sources: ['NFL.com'],
          newsContext: newsPlayer.context,
          newsUrl: newsPlayer.url,
          mentions: 1,
          newsOnly: true
        });
      }
    });

    // Sort by cross-referenced players first, then by mentions
    return combined.sort((a, b) => {
      if (a.crossReferenced && !b.crossReferenced) return -1;
      if (!a.crossReferenced && b.crossReferenced) return 1;
      return (b.mentions || 0) - (a.mentions || 0);
    }).slice(0, 10);
  }

  // Extract player names from text using common patterns
  extractPlayerNamesFromText(text) {
    const players = [];
    
    // Look for patterns like "FirstName LastName" 
    const namePattern = /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g;
    let match;
    
    while ((match = namePattern.exec(text)) !== null) {
      const name = match[1];
      
      // Filter out common false positives
      if (!name.includes('NFL') && 
          !name.includes('New York') && 
          !name.includes('Green Bay') &&
          !name.includes('Las Vegas') &&
          !name.includes('Pro Bowl') &&
          name.length > 6) {
        players.push(name);
      }
    }
    
    return players;
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
            hoursOld: hoursOld,
            permalink: post.data.permalink
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

    // Check for specific actionable reasons first
    if (lowerTitle.includes('waiver') || lowerTitle.includes('pickup') || lowerTitle.includes('add')) {
      return 'Waiver wire target';
    }
    
    if (lowerTitle.includes('start') && (lowerTitle.includes('sit') || lowerTitle.includes('bench'))) {
      return 'Start/sit decision';
    }
    
    if (lowerTitle.includes('trade') && !lowerTitle.includes('traded')) {
      return 'Trade discussion';
    }
    
    if (lowerTitle.includes('injury') || lowerTitle.includes('injured') || lowerTitle.includes('hurt') || lowerTitle.includes('questionable')) {
      return 'Injury concern';
    }
    
    if (lowerTitle.includes('breakout') || lowerTitle.includes('sleeper') || lowerTitle.includes('deep')) {
      return 'Breakout potential';
    }
    
    if (lowerTitle.includes('drop') || lowerTitle.includes('cut') || lowerTitle.includes('droppable')) {
      return 'Drop candidate';
    }
    
    if (lowerTitle.includes('buy low') || lowerTitle.includes('sell high')) {
      return 'Buy/sell advice';
    }
    
    if (lowerTitle.includes('outlook') || lowerTitle.includes('ros') || lowerTitle.includes('rest of season')) {
      return 'Season outlook';
    }

    // Try to extract the actual question or topic from the title
    const patterns = [
      /what.{0,20}think/i,
      /should.{0,20}start/i,
      /worth.{0,20}keeping/i,
      /time.{0,20}sell/i,
      /anyone.{0,20}worried/i,
      /concerns.{0,20}about/i,
      /thoughts.{0,20}on/i
    ];

    for (const pattern of patterns) {
      if (pattern.test(title)) {
        // Extract a meaningful snippet around the pattern
        const match = title.match(pattern);
        if (match) {
          const start = Math.max(0, match.index - 10);
          const end = Math.min(title.length, match.index + match[0].length + 20);
          let snippet = title.substring(start, end).trim();
          
          // Clean up the snippet
          snippet = snippet.replace(/^[^a-zA-Z]*/, '').replace(/[^a-zA-Z]*$/, '');
          
          if (snippet.length > 15 && snippet.length < 60) {
            return snippet.charAt(0).toUpperCase() + snippet.slice(1);
          }
        }
      }
    }

    // Fallback: just return the full title if it's reasonably short
    if (title.length > 10 && title.length < 70) {
      return title;
    }

    return 'Fantasy discussion';
  }

  formatForDiscord(analysis) {
    if (!analysis.players || analysis.players.length === 0) {
      return 'No trending players found in recent Reddit discussions.';
    }

    let response = `**🔥 Trending Players (Reddit r/fantasyfootball)**\n\n`;

    analysis.players.slice(0, 6).forEach((player, index) => {
      const teamInfo = this.getPlayerTeam(player.name);
      
      response += `**${index + 1}. ${player.name}**${teamInfo}\n`;
      
      // Show the actual Reddit post title instead of generic categories
      if (player.topPost && player.topPost.title) {
        let title = player.topPost.title;
        if (title.length > 120) {
          title = title.substring(0, 117) + '...';
        }
        response += `🔥 "${title}"\n`;
        
        // Add Reddit link if available
        if (player.topPost.permalink) {
          response += `🔗 [Read Discussion](https://reddit.com${player.topPost.permalink})\n`;
        }
      } else {
        response += `📈 **${player.primaryReason}**\n`;
      }
      
      response += `💬 ${player.mentions} posts, ${Math.round(player.engagement)} engagement\n`;
      
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