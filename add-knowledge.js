const FantasyKnowledgeEnhancer = require('./src/knowledge/fantasy-enhancer');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const enhancer = new FantasyKnowledgeEnhancer();

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function addArticle() {
  console.log('\n📰 ADD FANTASY ARTICLE TO KNOWLEDGE BASE\n');
  
  const title = await ask('Article Title: ');
  const source = await ask('Source (ESPN, FantasyPros, etc.): ');
  const category = await ask('Category (draft, rankings, sleepers, injury, etc.): ');
  
  console.log('\nPaste the article content (press Enter twice when done):');
  let content = '';
  let emptyLines = 0;
  
  return new Promise(resolve => {
    rl.on('line', (line) => {
      if (line.trim() === '') {
        emptyLines++;
        if (emptyLines >= 2) {
          enhancer.addArticle(title, content, source, category)
            .then(id => {
              console.log(`✅ Article added with ID: ${id}`);
              resolve();
            })
            .catch(err => {
              console.error('❌ Error adding article:', err.message);
              resolve();
            });
        }
      } else {
        emptyLines = 0;
        content += line + '\n';
      }
    });
  });
}

async function addADPData() {
  console.log('\n📊 ADD ADP DATA\n');
  
  const source = await ask('ADP Source (FantasyPros, ESPN, Yahoo, etc.): ');
  const year = await ask('Year (2025): ');
  
  console.log('\nPaste ADP data as JSON array (player objects with name, position, adp):');
  console.log('Example: [{"name":"Christian McCaffrey","position":"RB","adp":1.2}]');
  
  const dataText = await ask('ADP JSON: ');
  
  try {
    const data = JSON.parse(dataText);
    const id = await enhancer.addADPData(source, parseInt(year), data);
    console.log(`✅ ADP data added with ID: ${id}`);
  } catch (error) {
    console.error('❌ Error adding ADP data:', error.message);
  }
}

async function showStats() {
  const stats = await enhancer.getStats();
  console.log('\n📊 KNOWLEDGE BASE STATS:');
  console.log(`📰 Articles: ${stats.articles}`);
  console.log(`📊 ADP Sources: ${stats.adpSources}`);
  console.log(`🏈 Draft Records: ${stats.drafts}`);
  console.log(`💾 Total Knowledge Items: ${stats.totalKnowledge}\n`);
}

async function searchKnowledge() {
  console.log('\n🔍 SEARCH KNOWLEDGE BASE\n');
  
  const query = await ask('Search query (player name, topic, etc.): ');
  const category = await ask('Category filter (optional, press Enter to skip): ');
  
  const results = await enhancer.searchKnowledge(query, category || null);
  
  console.log(`\n📋 Found ${results.length} results:\n`);
  
  results.slice(0, 5).forEach((result, index) => {
    console.log(`${index + 1}. [${result.type.toUpperCase()}] ${result.title || result.source}`);
    console.log(`   Relevance: ${result.relevance} | Source: ${result.source || result.type}`);
    if (result.content) {
      console.log(`   Preview: ${result.content.substring(0, 100)}...`);
    }
    console.log('');
  });
}

async function main() {
  console.log('🧠 FANTASY KNOWLEDGE ENHANCER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Make your Fantasy AI smarter with preseason articles,');
  console.log('ADP data, and draft comparisons!\n');
  
  await showStats();
  
  while (true) {
    console.log('OPTIONS:');
    console.log('1. Add article (preseason analysis, rankings, etc.)');
    console.log('2. Add ADP data for player comparisons');
    console.log('3. Search knowledge base');
    console.log('4. Show stats');
    console.log('5. Exit\n');
    
    const choice = await ask('Choose option (1-5): ');
    
    switch (choice) {
      case '1':
        await addArticle();
        break;
      case '2':
        await addADPData();
        break;
      case '3':
        await searchKnowledge();
        break;
      case '4':
        await showStats();
        break;
      case '5':
        console.log('\n👋 Knowledge enhancer closed!');
        rl.close();
        return;
      default:
        console.log('❌ Invalid option, please try again.\n');
    }
    
    console.log('\n' + '━'.repeat(50) + '\n');
  }
}

main().catch(console.error);