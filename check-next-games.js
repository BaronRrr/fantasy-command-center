const axios = require('axios');

async function checkNextGames() {
  console.log('🏈 Checking for next NFL games...\n');
  
  try {
    // Check today and tomorrow for games
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      const dateStr = checkDate.toISOString().slice(0, 10).replace(/-/g, '');
      
      console.log(`📅 Checking ${checkDate.toLocaleDateString()}...`);
      
      try {
        const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateStr}`, {
          timeout: 10000
        });
        
        const games = response.data.events || [];
        
        if (games.length > 0) {
          console.log(`✅ Found ${games.length} games on ${checkDate.toLocaleDateString()}:\n`);
          
          games.forEach((game, i) => {
            const homeTeam = game.competitions[0].competitors.find(team => team.homeAway === 'home');
            const awayTeam = game.competitions[0].competitors.find(team => team.homeAway === 'away');
            const gameTime = new Date(game.date);
            const gameType = game.season.type === 1 ? 'Preseason' : 'Regular Season';
            
            console.log(`${i + 1}. **${awayTeam.team.displayName}** @ **${homeTeam.team.displayName}**`);
            console.log(`   🕒 ${gameTime.toLocaleString()}`);
            console.log(`   📺 ${gameType} - ${game.status.type.description}`);
            console.log(`   🏟️ ${game.competitions[0].venue?.fullName || 'TBD'}`);
            if (game.competitions[0].broadcasts?.[0]) {
              console.log(`   📻 ${game.competitions[0].broadcasts[0].names.join(', ')}`);
            }
            console.log('');
          });
          
          // If this is the first day with games, these are the next games
          if (dayOffset === 0) {
            console.log('🎯 **NEXT GAMES ARE TODAY!**');
          } else if (dayOffset === 1) {
            console.log('🎯 **NEXT GAMES ARE TOMORROW!**');
          } else {
            console.log(`🎯 **NEXT GAMES ARE IN ${dayOffset} DAYS**`);
          }
          break;
        } else {
          console.log(`   ❌ No games found`);
        }
      } catch (error) {
        console.log(`   ⚠️ Error checking date: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Failed to check next games:', error.message);
  }
}

checkNextGames();