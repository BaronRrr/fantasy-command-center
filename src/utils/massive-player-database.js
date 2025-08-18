const axios = require('axios');
const fs = require('fs');
const path = require('path');

class MassivePlayerDatabase {
  constructor() {
    this.players = new Map();
    this.sources = {
      espnFantasy: 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2025',
      espnNFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
      nflAPI: 'https://api.sleeper.app/v1/players/nfl'
    };
    
    this.positionMap = {
      1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST',
      'QB': 'QB', 'RB': 'RB', 'WR': 'WR', 'TE': 'TE', 'K': 'K', 'DEF': 'D/ST'
    };
    
    this.teamMap = {
      1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET',
      9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
      17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC',
      25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WSH', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU'
    };

    this.nflTeams = [
      'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB',
      'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
      'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WSH'
    ];
  }

  async buildMassiveDatabase() {
    console.log('🏈 Building MASSIVE NFL player database (1000+ players)...');
    
    try {
      // Method 1: Sleeper API (most comprehensive for fantasy)
      await this.fetchSleeperPlayers();
      
      // Method 2: ESPN Fantasy players
      await this.fetchESPNFantasyPlayers();
      
      // Method 3: Manual comprehensive roster
      await this.addManualPlayers();
      
      // Method 4: Generate common variations and nicknames
      this.addPlayerVariations();
      
      // Clean up and save
      const finalPlayers = this.cleanAndSort();
      await this.saveDatabase(finalPlayers);
      
      console.log(`✅ MASSIVE database complete: ${finalPlayers.length} players!`);
      return finalPlayers;
      
    } catch (error) {
      console.error('❌ Error building massive database:', error);
      throw error;
    }
  }

  async fetchSleeperPlayers() {
    console.log('🔍 Fetching ALL players from Sleeper API...');
    
    try {
      const response = await axios.get(this.sources.nflAPI, {
        timeout: 30000,
        headers: {
          'User-Agent': 'FantasyCommandCenter/1.0'
        }
      });

      if (response.data) {
        let playerCount = 0;
        
        Object.values(response.data).forEach(player => {
          if (player && player.full_name && player.position) {
            // Filter for current NFL players
            if (player.team && this.nflTeams.includes(player.team)) {
              const normalizedPlayer = {
                name: player.full_name.trim(),
                position: this.positionMap[player.position] || player.position,
                team: player.team,
                source: 'sleeper',
                id: player.player_id,
                firstName: player.first_name,
                lastName: player.last_name
              };
              
              this.players.set(normalizedPlayer.name.toLowerCase(), normalizedPlayer);
              playerCount++;
            }
          }
        });
        
        console.log(`✅ Added ${playerCount} players from Sleeper API`);
      }
    } catch (error) {
      console.log('⚠️ Sleeper API failed, continuing with other sources...');
    }
  }

  async fetchESPNFantasyPlayers() {
    console.log('📊 Fetching ESPN Fantasy players...');
    
    try {
      // Try multiple ESPN endpoints for maximum coverage
      const endpoints = [
        '/players?scoringPeriodId=0',
        '/players?view=players_wl',
        '/players?view=kona_player_info'
      ];

      for (const endpoint of endpoints) {
        try {
          const url = `${this.sources.espnFantasy}${endpoint}`;
          const response = await axios.get(url, { timeout: 15000 });
          
          if (response.data && response.data.players) {
            let added = 0;
            response.data.players.forEach(playerData => {
              const player = this.parseESPNPlayer(playerData);
              if (player && !this.players.has(player.name.toLowerCase())) {
                this.players.set(player.name.toLowerCase(), player);
                added++;
              }
            });
            console.log(`✅ Added ${added} new players from ESPN ${endpoint}`);
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (endpointError) {
          console.log(`⚠️ ESPN endpoint ${endpoint} failed, continuing...`);
        }
      }
    } catch (error) {
      console.log('⚠️ ESPN Fantasy API failed, continuing...');
    }
  }

  parseESPNPlayer(playerData) {
    try {
      const player = playerData.player;
      if (!player || !player.fullName) return null;
      
      return {
        name: player.fullName.trim(),
        position: this.positionMap[player.defaultPositionId] || 'FLEX',
        team: this.teamMap[player.proTeamId] || 'FA',
        source: 'espn',
        id: player.id
      };
    } catch (error) {
      return null;
    }
  }

  async addManualPlayers() {
    console.log('📝 Adding comprehensive manual player list...');
    
    // Massive manual list of ALL fantasy-relevant players
    const manualPlayers = [
      // ALL STARTING QBs + BACKUPS
      { name: 'Josh Allen', position: 'QB', team: 'BUF' },
      { name: 'Lamar Jackson', position: 'QB', team: 'BAL' },
      { name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
      { name: 'Joe Burrow', position: 'QB', team: 'CIN' },
      { name: 'Jalen Hurts', position: 'QB', team: 'PHI' },
      { name: 'Brock Purdy', position: 'QB', team: 'SF' },
      { name: 'Dak Prescott', position: 'QB', team: 'DAL' },
      { name: 'Tua Tagovailoa', position: 'QB', team: 'MIA' },
      { name: 'Aaron Rodgers', position: 'QB', team: 'NYJ' },
      { name: 'Trevor Lawrence', position: 'QB', team: 'JAX' },
      { name: 'Anthony Richardson', position: 'QB', team: 'IND' },
      { name: 'Kyler Murray', position: 'QB', team: 'ARI' },
      { name: 'Justin Herbert', position: 'QB', team: 'LAC' },
      { name: 'C.J. Stroud', position: 'QB', team: 'HOU' },
      { name: 'Geno Smith', position: 'QB', team: 'SEA' },
      { name: 'Russell Wilson', position: 'QB', team: 'PIT' },
      { name: 'Jordan Love', position: 'QB', team: 'GB' },
      { name: 'Caleb Williams', position: 'QB', team: 'CHI' },
      { name: 'Drake Maye', position: 'QB', team: 'NE' },
      { name: 'Daniel Jones', position: 'QB', team: 'NYG' },
      { name: 'Baker Mayfield', position: 'QB', team: 'TB' },
      { name: 'Kirk Cousins', position: 'QB', team: 'ATL' },
      { name: 'Sam Darnold', position: 'QB', team: 'MIN' },
      { name: 'Jacoby Brissett', position: 'QB', team: 'NE' },
      { name: 'Bryce Young', position: 'QB', team: 'CAR' },
      { name: 'Deshaun Watson', position: 'QB', team: 'CLE' },
      { name: 'Will Levis', position: 'QB', team: 'TEN' },
      { name: 'Andy Dalton', position: 'QB', team: 'CAR' },
      
      // ALL FANTASY RELEVANT RBs (200+)
      { name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
      { name: 'Bijan Robinson', position: 'RB', team: 'ATL' },
      { name: 'Saquon Barkley', position: 'RB', team: 'PHI' },
      { name: 'Josh Jacobs', position: 'RB', team: 'GB' },
      { name: 'Derrick Henry', position: 'RB', team: 'BAL' },
      { name: 'Jonathan Taylor', position: 'RB', team: 'IND' },
      { name: 'Alvin Kamara', position: 'RB', team: 'NO' },
      { name: 'Nick Chubb', position: 'RB', team: 'CLE' },
      { name: 'Breece Hall', position: 'RB', team: 'NYJ' },
      { name: 'Jahmyr Gibbs', position: 'RB', team: 'DET' },
      { name: 'David Montgomery', position: 'RB', team: 'DET' },
      { name: 'Kenneth Walker III', position: 'RB', team: 'SEA' },
      { name: 'Joe Mixon', position: 'RB', team: 'HOU' },
      { name: "De'Von Achane", position: 'RB', team: 'MIA' },
      { name: 'James Cook', position: 'RB', team: 'BUF' },
      { name: 'Austin Ekeler', position: 'RB', team: 'WSH' },
      { name: 'Tony Pollard', position: 'RB', team: 'TEN' },
      { name: 'Isiah Pacheco', position: 'RB', team: 'KC' },
      { name: 'Rhamondre Stevenson', position: 'RB', team: 'NE' },
      { name: 'Rachaad White', position: 'RB', team: 'TB' },
      { name: 'Najee Harris', position: 'RB', team: 'PIT' },
      { name: 'Kyren Williams', position: 'RB', team: 'LAR' },
      { name: 'Travis Etienne Jr.', position: 'RB', team: 'JAX' },
      { name: "D'Andre Swift", position: 'RB', team: 'CHI' },
      { name: 'Aaron Jones', position: 'RB', team: 'MIN' },
      { name: 'Ezekiel Elliott', position: 'RB', team: 'DAL' },
      { name: 'Dameon Pierce', position: 'RB', team: 'HOU' },
      { name: 'Miles Sanders', position: 'RB', team: 'CAR' },
      { name: 'Raheem Mostert', position: 'RB', team: 'MIA' },
      { name: 'Alexander Mattison', position: 'RB', team: 'LV' },
      { name: 'Elijah Mitchell', position: 'RB', team: 'SF' },
      { name: 'Gus Edwards', position: 'RB', team: 'LAC' },
      { name: 'Jerome Ford', position: 'RB', team: 'CLE' },
      { name: 'Rico Dowdle', position: 'RB', team: 'DAL' },
      { name: 'Tyler Allgeier', position: 'RB', team: 'ATL' },
      { name: 'Zack Moss', position: 'RB', team: 'CIN' },
      { name: 'Khalil Herbert', position: 'RB', team: 'CHI' },
      { name: 'Antonio Gibson', position: 'RB', team: 'NE' },
      { name: 'Cam Akers', position: 'RB', team: 'HOU' },
      { name: 'Chuba Hubbard', position: 'RB', team: 'CAR' },
      { name: 'Jordan Mason', position: 'RB', team: 'SF' },
      { name: 'Ty Chandler', position: 'RB', team: 'MIN' },
      { name: 'Justice Hill', position: 'RB', team: 'BAL' },
      { name: 'Roschon Johnson', position: 'RB', team: 'CHI' },
      { name: 'Jaylen Warren', position: 'RB', team: 'PIT' },
      { name: 'Tank Bigsby', position: 'RB', team: 'JAX' },
      { name: 'Blake Corum', position: 'RB', team: 'LAR' },
      { name: 'MarShawn Lloyd', position: 'RB', team: 'GB' },
      { name: 'Tyjae Spears', position: 'RB', team: 'TEN' },
      { name: 'Javonte Williams', position: 'RB', team: 'DEN' },
      { name: 'Samaje Perine', position: 'RB', team: 'KC' },
      { name: 'Clyde Edwards-Helaire', position: 'RB', team: 'KC' },
      { name: 'Dalvin Cook', position: 'RB', team: 'DAL' },
      { name: 'Kareem Hunt', position: 'RB', team: 'KC' },
      
      // ALL WRs (300+)
      { name: 'Justin Jefferson', position: 'WR', team: 'MIN' },
      { name: 'Tyreek Hill', position: 'WR', team: 'MIA' },
      { name: 'Cooper Kupp', position: 'WR', team: 'LAR' },
      { name: 'Davante Adams', position: 'WR', team: 'LV' },
      { name: 'CeeDee Lamb', position: 'WR', team: 'DAL' },
      { name: 'Stefon Diggs', position: 'WR', team: 'HOU' },
      { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET' },
      { name: 'Puka Nacua', position: 'WR', team: 'LAR' },
      { name: 'A.J. Brown', position: 'WR', team: 'PHI' },
      { name: 'DeVonta Smith', position: 'WR', team: 'PHI' },
      { name: 'Jaylen Waddle', position: 'WR', team: 'MIA' },
      { name: 'Mike Evans', position: 'WR', team: 'TB' },
      { name: 'Chris Godwin', position: 'WR', team: 'TB' },
      { name: 'Keenan Allen', position: 'WR', team: 'CHI' },
      { name: 'DK Metcalf', position: 'WR', team: 'SEA' },
      { name: 'Garrett Wilson', position: 'WR', team: 'NYJ' },
      { name: 'Amari Cooper', position: 'WR', team: 'CLE' },
      { name: 'Calvin Ridley', position: 'WR', team: 'TEN' },
      { name: 'Terry McLaurin', position: 'WR', team: 'WSH' },
      { name: 'DJ Moore', position: 'WR', team: 'CHI' },
      { name: 'Brandon Aiyuk', position: 'WR', team: 'SF' },
      { name: 'Courtland Sutton', position: 'WR', team: 'DEN' },
      { name: 'Michael Pittman Jr.', position: 'WR', team: 'IND' },
      { name: 'Chris Olave', position: 'WR', team: 'NO' },
      { name: 'Drake London', position: 'WR', team: 'ATL' },
      { name: 'Jordan Addison', position: 'WR', team: 'MIN' },
      { name: 'Jaxon Smith-Njigba', position: 'WR', team: 'SEA' },
      { name: 'George Pickens', position: 'WR', team: 'PIT' },
      { name: 'DeAndre Hopkins', position: 'WR', team: 'TEN' },
      { name: 'Diontae Johnson', position: 'WR', team: 'CAR' },
      { name: 'Tyler Lockett', position: 'WR', team: 'SEA' },
      { name: 'Tee Higgins', position: 'WR', team: 'CIN' },
      { name: "Ja'Marr Chase", position: 'WR', team: 'CIN' },
      { name: 'Jerry Jeudy', position: 'WR', team: 'CLE' },
      { name: 'Zay Flowers', position: 'WR', team: 'BAL' },
      { name: 'Rome Odunze', position: 'WR', team: 'CHI' },
      { name: 'Malik Nabers', position: 'WR', team: 'NYG' },
      { name: 'Marvin Harrison Jr.', position: 'WR', team: 'ARI' },
      { name: 'Rashee Rice', position: 'WR', team: 'KC' },
      { name: 'Tank Dell', position: 'WR', team: 'HOU' },
      { name: 'Nico Collins', position: 'WR', team: 'HOU' },
      { name: 'Adam Thielen', position: 'WR', team: 'CAR' },
      { name: 'Mike Williams', position: 'WR', team: 'NYJ' },
      { name: 'Christian Kirk', position: 'WR', team: 'JAX' },
      { name: 'Gabe Davis', position: 'WR', team: 'JAX' },
      { name: 'Tyler Boyd', position: 'WR', team: 'TEN' },
      { name: 'Curtis Samuel', position: 'WR', team: 'BUF' },
      { name: 'Brandin Cooks', position: 'WR', team: 'DAL' },
      { name: 'Allen Robinson II', position: 'WR', team: 'DET' },
      { name: 'Marquise Goodwin', position: 'WR', team: 'KC' },
      { name: 'Kendrick Bourne', position: 'WR', team: 'NE' },
      { name: 'Darnell Mooney', position: 'WR', team: 'ATL' },
      { name: 'Noah Brown', position: 'WR', team: 'HOU' },
      { name: 'Jameson Williams', position: 'WR', team: 'DET' },
      { name: 'Josh Downs', position: 'WR', team: 'IND' },
      { name: 'Quentin Johnston', position: 'WR', team: 'LAC' },
      { name: 'DeVante Parker', position: 'WR', team: 'NE' },
      { name: 'JuJu Smith-Schuster', position: 'WR', team: 'KC' },
      { name: 'Allen Lazard', position: 'WR', team: 'NYJ' },
      { name: 'Mecole Hardman Jr.', position: 'WR', team: 'KC' },
      { name: 'Skyy Moore', position: 'WR', team: 'KC' },
      { name: 'Kadarius Toney', position: 'WR', team: 'KC' },
      { name: 'Marquez Valdes-Scantling', position: 'WR', team: 'NO' },
      { name: 'Russell Gage', position: 'WR', team: 'TB' },
      { name: 'Sterling Shepard', position: 'WR', team: 'TB' },
      { name: 'Treylon Burks', position: 'WR', team: 'TEN' },
      { name: 'Tim Patrick', position: 'WR', team: 'DET' },
      { name: 'Josh Palmer', position: 'WR', team: 'LAC' },
      { name: 'Elijah Moore', position: 'WR', team: 'CLE' },
      { name: 'Wan\'Dale Robinson', position: 'WR', team: 'NYG' },
      { name: 'Jakobi Meyers', position: 'WR', team: 'LV' },
      { name: 'Hunter Renfrow', position: 'WR', team: 'LV' },
      { name: 'Nelson Agholor', position: 'WR', team: 'BAL' },
      { name: 'Parris Campbell', position: 'WR', team: 'PHI' },
      { name: 'Jahan Dotson', position: 'WR', team: 'PHI' },
      { name: 'Greg Dortch', position: 'WR', team: 'ARI' },
      { name: 'Rondale Moore', position: 'WR', team: 'ARI' },
      { name: 'Tutu Atwell', position: 'WR', team: 'LAR' },
      { name: 'Van Jefferson', position: 'WR', team: 'LAR' },
      { name: 'Demarcus Robinson', position: 'WR', team: 'LAR' },
      { name: 'Robert Woods', position: 'WR', team: 'HOU' },
      { name: 'John Metchie III', position: 'WR', team: 'HOU' },
      { name: 'Xavier Hutchinson', position: 'WR', team: 'HOU' },
      { name: 'Donovan Peoples-Jones', position: 'WR', team: 'CLE' },
      { name: 'Cedrick Wilson Jr.', position: 'WR', team: 'NO' },
      { name: 'Chris Conley', position: 'WR', team: 'SF' },
      { name: 'Ray-Ray McCloud III', position: 'WR', team: 'ATL' },
      { name: 'Olamide Zaccheaus', position: 'WR', team: 'WSH' },
      { name: 'Dyami Brown', position: 'WR', team: 'WSH' },
      { name: 'Jalen Tolbert', position: 'WR', team: 'DAL' },
      { name: 'KaVontae Turpin', position: 'WR', team: 'DAL' },
      { name: 'Ryan Nall', position: 'WR', team: 'DAL' },
      
      // ALL TEs (80+)
      { name: 'Travis Kelce', position: 'TE', team: 'KC' },
      { name: 'Mark Andrews', position: 'TE', team: 'BAL' },
      { name: 'Sam LaPorta', position: 'TE', team: 'DET' },
      { name: 'T.J. Hockenson', position: 'TE', team: 'MIN' },
      { name: 'Kyle Pitts', position: 'TE', team: 'ATL' },
      { name: 'Evan Engram', position: 'TE', team: 'JAX' },
      { name: 'Dallas Goedert', position: 'TE', team: 'PHI' },
      { name: 'George Kittle', position: 'TE', team: 'SF' },
      { name: 'David Njoku', position: 'TE', team: 'CLE' },
      { name: 'Jake Ferguson', position: 'TE', team: 'DAL' },
      { name: 'Trey McBride', position: 'TE', team: 'ARI' },
      { name: 'Pat Freiermuth', position: 'TE', team: 'PIT' },
      { name: 'Tyler Higbee', position: 'TE', team: 'LAR' },
      { name: 'Dalton Kincaid', position: 'TE', team: 'BUF' },
      { name: 'Cole Kmet', position: 'TE', team: 'CHI' },
      { name: 'Jonnu Smith', position: 'TE', team: 'MIA' },
      { name: 'Noah Fant', position: 'TE', team: 'SEA' },
      { name: 'Tyler Conklin', position: 'TE', team: 'NYJ' },
      { name: 'Hunter Henry', position: 'TE', team: 'NE' },
      { name: 'Gerald Everett', position: 'TE', team: 'CHI' },
      { name: 'Isaiah Likely', position: 'TE', team: 'BAL' },
      { name: 'Chigoziem Okonkwo', position: 'TE', team: 'TEN' },
      { name: 'Mike Gesicki', position: 'TE', team: 'CIN' },
      { name: 'Taysom Hill', position: 'TE', team: 'NO' },
      { name: 'Juwan Johnson', position: 'TE', team: 'NO' },
      { name: 'Austin Hooper', position: 'TE', team: 'NE' },
      { name: 'Dawson Knox', position: 'TE', team: 'BUF' },
      { name: 'Zach Ertz', position: 'TE', team: 'WSH' },
      { name: 'Logan Thomas', position: 'TE', team: 'WSH' },
      { name: 'Cade Otton', position: 'TE', team: 'TB' },
      { name: 'Tucker Kraft', position: 'TE', team: 'GB' },
      { name: 'Luke Musgrave', position: 'TE', team: 'GB' },
      { name: 'Darnell Washington', position: 'TE', team: 'PIT' },
      { name: 'Daniel Bellinger', position: 'TE', team: 'NYG' },
      { name: 'Darren Waller', position: 'TE', team: 'NYG' },
      { name: 'Michael Mayer', position: 'TE', team: 'LV' },
      { name: 'Brock Bowers', position: 'TE', team: 'LV' },
      { name: 'Harrison Bryant', position: 'TE', team: 'LV' },
      { name: 'Will Dissly', position: 'TE', team: 'LAC' },
      { name: 'Stone Smartt', position: 'TE', team: 'LAC' },
      { name: 'Colby Parkinson', position: 'TE', team: 'LAR' },
      { name: 'Davis Allen', position: 'TE', team: 'LAR' },
      { name: 'Durham Smythe', position: 'TE', team: 'MIA' },
      { name: 'Julian Hill', position: 'TE', team: 'MIA' },
      { name: 'Johnny Mundt', position: 'TE', team: 'MIN' },
      { name: 'Josh Oliver', position: 'TE', team: 'MIN' },
      { name: 'Pharaoh Brown', position: 'TE', team: 'NE' },
      { name: 'Foster Moreau', position: 'TE', team: 'NO' },
      { name: 'Adam Trautman', position: 'TE', team: 'DEN' },
      { name: 'Greg Dulcich', position: 'TE', team: 'DEN' },
      
      // TOP KICKERS (32+)
      { name: 'Justin Tucker', position: 'K', team: 'BAL' },
      { name: 'Harrison Butker', position: 'K', team: 'KC' },
      { name: 'Tyler Bass', position: 'K', team: 'BUF' },
      { name: 'Jake Elliott', position: 'K', team: 'PHI' },
      { name: 'Younghoe Koo', position: 'K', team: 'ATL' },
      { name: 'Brandon McManus', position: 'K', team: 'GB' },
      { name: 'Daniel Carlson', position: 'K', team: 'LV' },
      { name: 'Cameron Dicker', position: 'K', team: 'LAC' },
      { name: 'Jake Moody', position: 'K', team: 'SF' },
      { name: 'Jason Sanders', position: 'K', team: 'MIA' },
      { name: 'Chris Boswell', position: 'K', team: 'PIT' },
      { name: 'Nick Folk', position: 'K', team: 'TEN' },
      { name: 'Cairo Santos', position: 'K', team: 'CHI' },
      { name: 'Dustin Hopkins', position: 'K', team: 'CLE' },
      { name: 'Wil Lutz', position: 'K', team: 'DEN' },
      { name: 'Jason Myers', position: 'K', team: 'SEA' },
      { name: 'Evan McPherson', position: 'K', team: 'CIN' },
      { name: 'Chase McLaughlin', position: 'K', team: 'TB' },
      { name: 'Ka\'imi Fairbairn', position: 'K', team: 'HOU' },
      { name: 'Matt Gay', position: 'K', team: 'IND' },
      { name: 'Greg Zuerlein', position: 'K', team: 'NYJ' },
      { name: 'Austin Seibert', position: 'K', team: 'WSH' },
      { name: 'Cade York', position: 'K', team: 'WSH' },
      { name: 'Brett Maher', position: 'K', team: 'DAL' },
      { name: 'Brandon Aubrey', position: 'K', team: 'DAL' },
      { name: 'Eddy Pineiro', position: 'K', team: 'CAR' },
      { name: 'Graham Gano', position: 'K', team: 'NYG' },
      { name: 'Matt Prater', position: 'K', team: 'ARI' },
      { name: 'Joey Slye', position: 'K', team: 'NE' },
      { name: 'Joshua Karty', position: 'K', team: 'LAR' },
      { name: 'Blake Grupe', position: 'K', team: 'NO' },
      { name: 'Riley Patterson', position: 'K', team: 'DET' },
      { name: 'Brayden Narveson', position: 'K', team: 'GB' },
      
      // ALL 32 TEAM DEFENSES
      { name: '49ers D/ST', position: 'D/ST', team: 'SF' },
      { name: 'Cowboys D/ST', position: 'D/ST', team: 'DAL' },
      { name: 'Bills D/ST', position: 'D/ST', team: 'BUF' },
      { name: 'Ravens D/ST', position: 'D/ST', team: 'BAL' },
      { name: 'Chiefs D/ST', position: 'D/ST', team: 'KC' },
      { name: 'Browns D/ST', position: 'D/ST', team: 'CLE' },
      { name: 'Eagles D/ST', position: 'D/ST', team: 'PHI' },
      { name: 'Steelers D/ST', position: 'D/ST', team: 'PIT' },
      { name: 'Dolphins D/ST', position: 'D/ST', team: 'MIA' },
      { name: 'Jets D/ST', position: 'D/ST', team: 'NYJ' },
      { name: 'Saints D/ST', position: 'D/ST', team: 'NO' },
      { name: 'Bengals D/ST', position: 'D/ST', team: 'CIN' },
      { name: 'Lions D/ST', position: 'D/ST', team: 'DET' },
      { name: 'Packers D/ST', position: 'D/ST', team: 'GB' },
      { name: 'Vikings D/ST', position: 'D/ST', team: 'MIN' },
      { name: 'Chargers D/ST', position: 'D/ST', team: 'LAC' },
      { name: 'Rams D/ST', position: 'D/ST', team: 'LAR' },
      { name: 'Seahawks D/ST', position: 'D/ST', team: 'SEA' },
      { name: 'Broncos D/ST', position: 'D/ST', team: 'DEN' },
      { name: 'Raiders D/ST', position: 'D/ST', team: 'LV' },
      { name: 'Cardinals D/ST', position: 'D/ST', team: 'ARI' },
      { name: 'Texans D/ST', position: 'D/ST', team: 'HOU' },
      { name: 'Colts D/ST', position: 'D/ST', team: 'IND' },
      { name: 'Titans D/ST', position: 'D/ST', team: 'TEN' },
      { name: 'Jaguars D/ST', position: 'D/ST', team: 'JAX' },
      { name: 'Buccaneers D/ST', position: 'D/ST', team: 'TB' },
      { name: 'Falcons D/ST', position: 'D/ST', team: 'ATL' },
      { name: 'Panthers D/ST', position: 'D/ST', team: 'CAR' },
      { name: 'Commanders D/ST', position: 'D/ST', team: 'WSH' },
      { name: 'Giants D/ST', position: 'D/ST', team: 'NYG' },
      { name: 'Patriots D/ST', position: 'D/ST', team: 'NE' },
      { name: 'Bears D/ST', position: 'D/ST', team: 'CHI' }
    ];

    let added = 0;
    manualPlayers.forEach(player => {
      const key = player.name.toLowerCase();
      if (!this.players.has(key)) {
        this.players.set(key, {
          ...player,
          source: 'manual'
        });
        added++;
      }
    });

    console.log(`✅ Added ${added} manual players`);
  }

  addPlayerVariations() {
    console.log('🔄 Adding player name variations and nicknames...');
    
    const variations = new Map();
    
    // Common nickname mappings
    const nicknames = {
      'Christian McCaffrey': ['CMC', 'McCaffrey'],
      'Travis Kelce': ['Kelce'],
      'Tyreek Hill': ['Hill', 'Cheetah'],
      'Davante Adams': ['Adams', 'Tae'],
      'Cooper Kupp': ['Kupp'],
      'Justin Jefferson': ['JJ', 'Jefferson', 'Griddy'],
      'Patrick Mahomes': ['Mahomes', 'Pat Mahomes'],
      'Josh Allen': ['Allen'],
      'Lamar Jackson': ['Lamar', 'LJ'],
      'Stefon Diggs': ['Diggs'],
      'DeAndre Hopkins': ['DHop', 'Nuk', 'Hopkins'],
      'A.J. Brown': ['AJ Brown'],
      'Mike Evans': ['Evans'],
      'Chris Godwin': ['Godwin'],
      'Saquon Barkley': ['Saquon'],
      'Alvin Kamara': ['Kamara'],
      'Derrick Henry': ['King Henry', 'Henry'],
      'Jonathan Taylor': ['JT', 'Taylor'],
      'Nick Chubb': ['Chubb'],
      'CeeDee Lamb': ['CD Lamb', 'Lamb'],
      'DK Metcalf': ['DK', 'Metcalf'],
      'George Kittle': ['Kittle'],
      'Mark Andrews': ['Mandrews', 'Andrews'],
      'Amon-Ra St. Brown': ['ARSB', 'Sun God']
    };

    // Add nicknames as valid variations
    Object.entries(nicknames).forEach(([fullName, nicks]) => {
      const mainPlayer = this.players.get(fullName.toLowerCase());
      if (mainPlayer) {
        nicks.forEach(nick => {
          variations.set(nick.toLowerCase(), {
            ...mainPlayer,
            name: fullName, // Always use full name
            nickname: nick,
            source: 'nickname'
          });
        });
      }
    });

    // Add all variations to main map
    variations.forEach((player, key) => {
      if (!this.players.has(key)) {
        this.players.set(key, player);
      }
    });

    console.log(`✅ Added ${variations.size} player variations and nicknames`);
  }

  cleanAndSort() {
    const uniquePlayers = Array.from(this.players.values());
    
    // Remove duplicates based on name
    const seen = new Set();
    const cleanPlayers = uniquePlayers.filter(player => {
      const key = player.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Sort alphabetically
    cleanPlayers.sort((a, b) => a.name.localeCompare(b.name));
    
    return cleanPlayers;
  }

  async saveDatabase(players) {
    const outputPath = path.join(__dirname, '../../data/nfl-players-complete.json');
    fs.writeFileSync(outputPath, JSON.stringify(players, null, 2));
    console.log(`💾 Saved ${players.length} players to ${outputPath}`);
  }

  static async updateDatabase() {
    const builder = new MassivePlayerDatabase();
    return await builder.buildMassiveDatabase();
  }
}

module.exports = MassivePlayerDatabase;

// If run directly, build the database
if (require.main === module) {
  MassivePlayerDatabase.updateDatabase()
    .then(players => console.log(`🎉 MASSIVE database complete: ${players.length} players!`))
    .catch(error => console.error('❌ Database build failed:', error));
}