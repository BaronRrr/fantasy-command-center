const FantasyKnowledgeEnhancer = require('./src/knowledge/fantasy-enhancer');
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

class BatchSheetsIntegrator {
  constructor() {
    this.enhancer = new FantasyKnowledgeEnhancer();
    this.sheets = [
      {
        id: 1,
        url: 'https://docs.google.com/spreadsheets/d/18GZQQ7DPXBhBLtoRBBqNZV7KXVseVPB_udfyfU4K6vY/copy',
        name: 'Fantasy Sheet 1'
      },
      {
        id: 2,
        url: 'https://docs.google.com/spreadsheets/d/1ShkqqyWcP_h-t3utB0oTN9NNNgXdQ-7__vlIC-4Swoo/edit?gid=1972685948#gid=1972685948',
        name: 'Fantasy Sheet 2'
      }
    ];
  }

  async addAllSheets() {
    console.log('\n📊 BATCH GOOGLE SHEETS INTEGRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔗 YOUR GOOGLE SHEETS:');
    this.sheets.forEach(sheet => {
      console.log(`${sheet.id}. ${sheet.url}`);
    });
    
    console.log('\n📋 INTEGRATION PROCESS:');
    console.log('For each sheet, you\'ll:');
    console.log('1. Open the link in your browser');
    console.log('2. Copy the relevant data');
    console.log('3. Paste it here for AI integration');
    
    for (const sheet of this.sheets) {
      await this.addSingleSheet(sheet);
      console.log('\n' + '─'.repeat(50));
    }
    
    console.log('\n✅ ALL SHEETS INTEGRATED!');
    console.log('🤖 Your Discord AI now has access to both spreadsheets');
    console.log('💡 Restart Discord bot to use new data: npm run discord');
  }

  async addSingleSheet(sheet) {
    console.log(`\n📊 SHEET ${sheet.id} INTEGRATION`);
    console.log(`🔗 URL: ${sheet.url}`);
    
    const title = await ask(`\nTitle for Sheet ${sheet.id} (e.g., "Draft Rankings 2024"): `);
    const category = await ask('Category (rankings, projections, sleepers, strategy): ');
    
    console.log('\n📋 Steps:');
    console.log('1. Open the URL above in your browser');
    console.log('2. Copy the fantasy data you want to add');
    console.log('3. Paste it below and press Enter twice when done\n');
    
    let content = '';
    let emptyLines = 0;
    
    return new Promise(resolve => {
      const lineHandler = async (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            rl.removeListener('line', lineHandler);
            
            try {
              const formattedContent = this.formatSheetContent(content, title, sheet.url);
              
              const id = await this.enhancer.addArticle(
                title,
                formattedContent,
                `Google Sheets ${sheet.id}`,
                category
              );
              
              console.log(`✅ Sheet ${sheet.id} added with ID: ${id}`);
              console.log(`📊 Title: ${title}`);
              resolve();
            } catch (error) {
              console.error(`❌ Error adding Sheet ${sheet.id}:`, error.message);
              resolve();
            }
          }
        } else {
          emptyLines = 0;
          content += line + '\n';
        }
      };
      
      rl.on('line', lineHandler);
    });
  }

  formatSheetContent(content, title, url) {
    return `GOOGLE SHEETS FANTASY DATA: ${title}

Original Source: ${url}

SPREADSHEET DATA:
${content}

FANTASY APPLICATION:
• Use this data for draft preparation and player evaluation
• Cross-reference with live NFL statistics and news
• Apply insights to weekly lineup and start/sit decisions
• Consider in trade evaluations and waiver wire pickups

INTEGRATION DETAILS:
• Data imported from Google Sheets
• Available for AI analysis and recommendations
• Updated: ${new Date().toLocaleString()}
• Accessible through Discord bot conversations

DISCORD USAGE EXAMPLES:
• !coach analyze [player name] using sheet data
• !coach compare players from my rankings
• !coach draft strategy based on spreadsheet insights
• !coach who are the top sleepers from my data`;
  }

  async showQuickStart() {
    console.log('\n⚡ QUICK START GUIDE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔗 YOUR LINKS:');
    this.sheets.forEach(sheet => {
      console.log(`${sheet.id}. ${sheet.url}`);
    });
    
    console.log('\n📋 FASTEST METHOD:');
    console.log('1. Right-click each link → "Open in new tab"');
    console.log('2. Copy data from each sheet');
    console.log('3. Use this tool to paste and integrate');
    console.log('4. Your AI coach will know the data instantly!');
    
    console.log('\n💡 NO DOWNLOADS NEEDED:');
    console.log('• Work directly in your browser');
    console.log('• Copy and paste is all you need');
    console.log('• Data integrates immediately');
    
    console.log('\n🎯 RESULT:');
    console.log('Your Discord AI will be able to:');
    console.log('• Reference your custom rankings');
    console.log('• Use your sleeper picks');
    console.log('• Apply your strategy insights');
    console.log('• Make recommendations based on your data');
  }
}

async function main() {
  const integrator = new BatchSheetsIntegrator();
  
  console.log('📊 GOOGLE SHEETS BATCH INTEGRATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\nOPTIONS:');
  console.log('1. Add both spreadsheets to knowledge base');
  console.log('2. Show quick start guide');
  console.log('3. Exit\n');
  
  const choice = await ask('Choose option (1-3): ');
  
  switch (choice) {
    case '1':
      await integrator.addAllSheets();
      break;
    case '2':
      await integrator.showQuickStart();
      break;
    case '3':
      console.log('\n👋 Exiting batch integration tool');
      break;
    default:
      console.log('❌ Invalid option');
  }
  
  rl.close();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BatchSheetsIntegrator;