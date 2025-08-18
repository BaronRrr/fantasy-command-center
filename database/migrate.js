const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'fantasy.db');

function createTables() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    const migrations = [
      // Players table
      `CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY,
        espn_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        team TEXT,
        injury_status TEXT,
        adp REAL,
        projected_points REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Draft picks table
      `CREATE TABLE IF NOT EXISTS draft_picks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        overall_pick INTEGER NOT NULL,
        round INTEGER NOT NULL,
        pick_in_round INTEGER NOT NULL,
        player_id INTEGER,
        team_id INTEGER,
        team_name TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`,

      // Teams table
      `CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY,
        espn_id INTEGER UNIQUE,
        name TEXT NOT NULL,
        owner TEXT,
        draft_position INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // League info table
      `CREATE TABLE IF NOT EXISTS league_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        espn_league_id INTEGER,
        name TEXT,
        size INTEGER,
        scoring_type TEXT,
        season INTEGER,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // AI recommendations table
      `CREATE TABLE IF NOT EXISTS ai_recommendations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        draft_pick INTEGER,
        player_name TEXT,
        position TEXT,
        urgency TEXT,
        reasoning TEXT,
        value_rating INTEGER,
        risk_level TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Player enrichment data table
      `CREATE TABLE IF NOT EXISTS player_enrichment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER,
        source TEXT,
        data_type TEXT,
        data_json TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id)
      )`,

      // Notifications log table
      `CREATE TABLE IF NOT EXISTS notifications_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        urgency TEXT,
        title TEXT,
        message TEXT,
        sent_successfully BOOLEAN,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Draft sessions table
      `CREATE TABLE IF NOT EXISTS draft_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        league_id INTEGER,
        started_at DATETIME,
        ended_at DATETIME,
        total_picks INTEGER,
        my_team_id INTEGER,
        status TEXT,
        FOREIGN KEY (league_id) REFERENCES league_info(id)
      )`
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_players_position ON players(position)',
      'CREATE INDEX IF NOT EXISTS idx_players_team ON players(team)',
      'CREATE INDEX IF NOT EXISTS idx_draft_picks_overall ON draft_picks(overall_pick)',
      'CREATE INDEX IF NOT EXISTS idx_draft_picks_player ON draft_picks(player_id)',
      'CREATE INDEX IF NOT EXISTS idx_ai_recommendations_pick ON ai_recommendations(draft_pick)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications_log(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_player_enrichment_player ON player_enrichment(player_id)'
    ];

    // Run migrations
    db.serialize(() => {
      migrations.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            console.error(`Migration ${index + 1} failed:`, err.message);
          } else {
            console.log(`✅ Migration ${index + 1} completed`);
          }
        });
      });

      // Create indexes
      indexes.forEach((sql, index) => {
        db.run(sql, (err) => {
          if (err) {
            console.error(`Index ${index + 1} failed:`, err.message);
          } else {
            console.log(`✅ Index ${index + 1} created`);
          }
        });
      });

      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Database setup complete');
          resolve();
        }
      });
    });
  });
}

function seedData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    const samplePlayers = [
      [4046, 'Christian McCaffrey', 'RB', 'SF', 'ACTIVE', 1.2, 285.5],
      [4035, 'Josh Allen', 'QB', 'BUF', 'ACTIVE', 45.8, 320.2],
      [3116, 'Cooper Kupp', 'WR', 'LAR', 'ACTIVE', 15.3, 245.8],
      [3138, 'Travis Kelce', 'TE', 'KC', 'ACTIVE', 25.1, 195.4],
      [4040, 'Tyreek Hill', 'WR', 'MIA', 'ACTIVE', 12.7, 255.9]
    ];

    db.serialize(() => {
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO players (espn_id, name, position, team, injury_status, adp, projected_points)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      samplePlayers.forEach(player => {
        stmt.run(player, (err) => {
          if (err) {
            console.error('Error inserting player:', err.message);
          }
        });
      });

      stmt.finalize();

      // Insert sample league info
      db.run(`
        INSERT OR IGNORE INTO league_info (espn_league_id, name, size, scoring_type, season, status)
        VALUES (123456, 'Sample Fantasy League', 12, 'PPR', 2025, 'ACTIVE')
      `);

      console.log('✅ Sample data seeded');
      
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
}

if (require.main === module) {
  console.log('🗄️ Setting up Fantasy Command Center database...');
  
  createTables()
    .then(() => seedData())
    .then(() => {
      console.log('🎉 Database setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database setup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createTables, seedData };