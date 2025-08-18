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

class SpreadsheetDataIntegrator {
  constructor() {
    this.enhancer = new FantasyKnowledgeEnhancer();
  }

  async addSpreadsheetData() {
    console.log('\n📊 GOOGLE SHEETS DATA INTEGRATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔗 Your Google Sheets Link:');
    console.log('https://docs.google.com/spreadsheets/d/18GZQQ7DPXBhBLtoRBBqNZV7KXVseVPB_udfyfU4K6vY/copy');
    
    console.log('\n📋 To integrate this spreadsheet data:');
    console.log('1. Open the Google Sheets link');
    console.log('2. Make a copy to your Google account');
    console.log('3. Copy the relevant data/insights');
    console.log('4. Paste below for integration');
    
    const title = await ask('\nSpreadsheet title/description: ');
    const category = await ask('Category (rankings, projections, sleepers, strategy): ');
    
    console.log('\n📊 Paste the spreadsheet data or key insights below:');
    console.log('(Press Enter twice when finished)\n');
    
    let content = '';
    let emptyLines = 0;
    
    return new Promise(resolve => {
      rl.on('line', async (line) => {
        if (line.trim() === '') {
          emptyLines++;
          if (emptyLines >= 2) {
            try {
              const formattedContent = this.formatSpreadsheetContent(content, title);
              
              const id = await this.enhancer.addArticle(
                title,
                formattedContent,
                'Google Sheets Data',
                category
              );
              
              console.log(`✅ Spreadsheet data added with ID: ${id}`);
              console.log('🔗 Original link preserved in knowledge base');
              console.log('🤖 Data now available to Discord AI coach');
              
              rl.close();
              resolve();
            } catch (error) {
              console.error('❌ Error adding spreadsheet data:', error.message);
              rl.close();
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

  formatSpreadsheetContent(content, title) {
    return `GOOGLE SHEETS FANTASY DATA: ${title}

Original Source: https://docs.google.com/spreadsheets/d/18GZQQ7DPXBhBLtoRBBqNZV7KXVseVPB_udfyfU4K6vY/copy

SPREADSHEET DATA:
${content}

FANTASY APPLICATION:
• Use this data for draft preparation and player rankings
• Cross-reference with live NFL statistics
• Apply insights to weekly lineup decisions
• Consider in trade evaluations

INTEGRATION NOTES:
• Data imported from Google Sheets
• Available for AI analysis and recommendations
• Updated: ${new Date().toLocaleString()}
• Can be referenced in Discord bot conversations

USAGE IN DISCORD:
• Ask AI coach about specific players from this data
• Request comparisons using this analysis
• Get recommendations based on these insights`;
  }

  async showGoogleSheetsInstructions() {
    console.log('\n📊 GOOGLE SHEETS INTEGRATION GUIDE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    console.log('\n🔗 Your Spreadsheet:');
    console.log('https://docs.google.com/spreadsheets/d/18GZQQ7DPXBhBLtoRBBqNZV7KXVseVPB_udfyfU4K6vY/copy');
    
    console.log('\n📋 INTEGRATION OPTIONS:');
    console.log('1. Manual Copy-Paste (Recommended)');
    console.log('   • Copy data from sheets → Paste into this tool');
    console.log('   • Full control over what gets added');
    console.log('   • Available immediately to AI coach');
    
    console.log('\n2. CSV Export Integration');
    console.log('   • Export sheets as CSV files');
    console.log('   • Use update-knowledge.js to add CSV data');
    console.log('   • Good for large datasets');
    
    console.log('\n3. Regular Data Updates');
    console.log('   • Copy updated data periodically');
    console.log('   • Keep AI coach current with latest insights');
    console.log('   • Use version control for tracking changes');
    
    console.log('\n💡 BEST PRACTICES:');
    console.log('• Add meaningful titles and descriptions');
    console.log('• Include context about data source and date');
    console.log('• Break large sheets into logical sections');
    console.log('• Test AI responses after adding data');
    
    console.log('\n🤖 AFTER INTEGRATION:');
    console.log('• Restart Discord bot: npm run discord');
    console.log('• Test: !coach analyze data from [spreadsheet name]');
    console.log('• Use: !coach compare players using latest rankings');
    
    return true;
  }
}

async function main() {
  const integrator = new SpreadsheetDataIntegrator();
  
  console.log('📊 GOOGLE SHEETS DATA INTEGRATION TOOL');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\nOPTIONS:');
  console.log('1. Add spreadsheet data to knowledge base');
  console.log('2. Show integration instructions');
  console.log('3. Exit\n');
  
  const choice = await ask('Choose option (1-3): ');
  
  switch (choice) {
    case '1':
      await integrator.addSpreadsheetData();
      break;
    case '2':
      await integrator.showGoogleSheetsInstructions();
      break;
    case '3':
      console.log('\n👋 Exiting spreadsheet integration tool');
      break;
    default:
      console.log('❌ Invalid option');
  }
  
  rl.close();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = SpreadsheetDataIntegrator;