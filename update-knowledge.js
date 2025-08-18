const ArticleFetcher = require('./src/knowledge/article-fetcher');
const FantasyKnowledgeEnhancer = require('./src/knowledge/fantasy-enhancer');
const ProjectionsFetcher = require('./src/knowledge/projections-fetcher');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

class KnowledgeUpdater {
  constructor() {
    this.fetcher = new ArticleFetcher();
    this.enhancer = new FantasyKnowledgeEnhancer();
    this.projectionsFetcher = new ProjectionsFetcher();
  }

  async updateFromURL() {
    console.log('\n📰 ADD ARTICLE FROM URL\n');
    
    const url = await ask('Article URL: ');
    const title = await ask('Article Title: ');
    const source = await ask('Source (ESPN, FantasyPros, etc.): ');
    const category = await ask('Category (rankings, strategy, news, sleepers): ');
    
    console.log('\n📋 Copy and paste the article content below:');
    console.log('(Press Enter twice when finished)\n');
    
    let content = '';
    let emptyLines = 0;
    
    return new Promise(resolve => {
      rl.on('line', async (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            try {
              const id = await this.enhancer.addArticle(title, content, source, category);
              console.log(`✅ Article added with ID: ${id}`);
              console.log(`🔗 URL: ${url}`);
              resolve();
            } catch (error) {
              console.error('❌ Error adding article:', error.message);
              resolve();
            }
          }
        } else {
          emptyLines = 0;
          content += line + '\n';
        }
      });
    });
  }

  async addESPNDraftContent() {
    console.log('\n📊 Adding ESPN Draft Guide Content...\n');
    
    const results = await this.fetcher.addESPNDraftGuideArticles();
    
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ Added: ${result.title}`);
      } else {
        console.log(`❌ Failed: ${result.title} - ${result.error}`);
      }
    });
    
    console.log('\n📈 ESPN Draft Guide content added to knowledge base!');
  }

  async addESPNProjections() {
    console.log('\n📊 Adding ESPN Player Projections Knowledge...\n');
    
    const success = await this.projectionsFetcher.addESPNProjectionsKnowledge();
    
    if (success) {
      console.log('✅ ESPN Projections knowledge added successfully!');
      console.log('🎯 Your AI now understands projection methodology');
      console.log('📈 Position-specific projection factors included');
      console.log('🔗 Visit: https://fantasy.espn.com/football/players/projections');
      console.log('💡 Use "Add from URL" to add specific projection insights');
    } else {
      console.log('❌ Failed to add ESPN projections knowledge');
    }
  }

  async batchUpdateFromLinks() {
    console.log('\n🔗 BATCH ADD FROM MULTIPLE LINKS\n');
    console.log('Paste links one per line, press Enter twice when done:\n');
    
    let links = [];
    let emptyLines = 0;
    
    return new Promise(resolve => {
      rl.on('line', (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            this.processBatchLinks(links).then(resolve);
          }
        } else {
          emptyLines = 0;
          if (line.trim().startsWith('http')) {
            links.push(line.trim());
            console.log(`📎 Added: ${line.trim()}`);
          }
        }
      });
    });
  }

  async processBatchLinks(links) {
    console.log(`\n📊 Processing ${links.length} links...\n`);
    
    for (const link of links) {
      console.log(`🔗 ${link}`);
      console.log('   → Ready for manual content addition');
      console.log('   → Use individual URL method for each link\n');
    }
    
    console.log('💡 TIP: Use the "Add from URL" option to add each article individually');
  }

  async showStats() {
    const stats = await this.enhancer.getStats();
    console.log('\n📊 CURRENT KNOWLEDGE BASE STATS:');
    console.log(`📰 Articles: ${stats.articles}`);
    console.log(`📊 ADP Sources: ${stats.adpSources}`);
    console.log(`🏈 Draft Records: ${stats.drafts}`);
    console.log(`💾 Total Knowledge: ${stats.totalKnowledge}\n`);
  }

  async searchKnowledge() {
    console.log('\n🔍 SEARCH KNOWLEDGE BASE\n');
    
    const query = await ask('Search query: ');
    const results = await this.enhancer.searchKnowledge(query);
    
    console.log(`\n📋 Found ${results.length} results:\n`);
    
    results.slice(0, 10).forEach((result, index) => {
      console.log(`${index + 1}. ${result.title || result.source}`);
      console.log(`   Source: ${result.source} | Relevance: ${result.relevance}`);
      if (result.content) {
        console.log(`   Preview: ${result.content.substring(0, 150)}...`);
      }
      console.log('');
    });
  }

  async restartDiscordBot() {
    console.log('\n🤖 Restarting Discord AI bot with updated knowledge...\n');
    
    // Kill existing bot processes
    const { exec } = require('child_process');
    exec('pkill -f "node start-discord-bot.js"', (error) => {
      if (error) {
        console.log('No existing bot process found');
      } else {
        console.log('🛑 Stopped existing Discord bot');
      }
      
      // Start new bot process
      exec('node start-discord-bot.js &', (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Failed to restart bot:', error.message);
        } else {
          console.log('✅ Discord AI bot restarted with updated knowledge!');
          console.log('🎯 Test with: !coach What are ESPN top sleepers for 2025?');
        }
      });
    });
  }
}

async function main() {
  const updater = new KnowledgeUpdater();
  
  console.log('🧠 FANTASY KNOWLEDGE UPDATER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Keep your Fantasy AI updated with the latest content!\n');
  
  await updater.showStats();
  
  while (true) {
    console.log('OPTIONS:');
    console.log('1. Add article from URL (manual content)');
    console.log('2. Add ESPN Draft Guide content (quick)');
    console.log('3. Add ESPN Player Projections knowledge');
    console.log('4. Batch add from multiple links');
    console.log('5. Search knowledge base');
    console.log('6. Show current stats');
    console.log('7. Restart Discord bot with updates');
    console.log('8. Exit\n');
    
    const choice = await ask('Choose option (1-8): ');
    
    switch (choice) {
      case '1':
        await updater.updateFromURL();
        break;
      case '2':
        await updater.addESPNDraftContent();
        break;
      case '3':
        await updater.addESPNProjections();
        break;
      case '4':
        await updater.batchUpdateFromLinks();
        break;
      case '5':
        await updater.searchKnowledge();
        break;
      case '6':
        await updater.showStats();
        break;
      case '7':
        await updater.restartDiscordBot();
        break;
      case '8':
        console.log('\n👋 Knowledge updater closed!');
        rl.close();
        return;
      default:
        console.log('❌ Invalid option, please try again.\n');
    }
    
    console.log('\n' + '━'.repeat(50) + '\n');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = KnowledgeUpdater;