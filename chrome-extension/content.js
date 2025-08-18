/**
 * Fantasy Command Center - ESPN Draft Monitor
 * Detects live draft picks and sends to Discord for AI analysis
 */

class FantasyDraftMonitor {
  constructor() {
    this.isMonitoring = false;
    this.lastPickCount = 0;
    this.draftData = {
      league_id: null,
      teams: {},
      picks: [],
      current_pick: 0
    };
    
    this.discordWebhook = null;
    this.teamId = null; // User's team ID
    
    this.init();
  }
  
  async init() {
    console.log('🏈 Fantasy Command Center - Draft Monitor Loading...');
    
    // Get configuration from extension storage
    await this.loadConfiguration();
    
    // Extract league info from URL
    this.extractLeagueInfo();
    
    // Start monitoring if we're on a draft page
    if (this.isDraftPage()) {
      this.startMonitoring();
      this.sendConnectionNotification();
    } else if (this.isWaitingRoom()) {
      this.sendWaitingRoomNotification();
      this.startWaitingRoomMonitor();
    }
  }
  
  async loadConfiguration() {
    try {
      const result = await chrome.storage.sync.get([
        'discordWebhook', 
        'teamId', 
        'enableNotifications'
      ]);
      
      this.discordWebhook = result.discordWebhook || 'https://discord.com/api/webhooks/1406098016800346263/w1XCdLHjGN38eM2smYNuGy6E7pQ2CMplyE0-amnsRT87d9vqgE1dA1kX_RJBpXGZL5yN';
      this.teamId = result.teamId || 2; // Default to team 2 (Baron's Best Team)
      
      console.log('📊 Configuration loaded:', {
        webhook: this.discordWebhook ? 'Configured' : 'Missing',
        teamId: this.teamId
      });
    } catch (error) {
      console.error('❌ Failed to load configuration:', error);
    }
  }
  
  extractLeagueInfo() {
    // Extract league ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    this.draftData.league_id = urlParams.get('leagueId');
    
    console.log('🎯 League ID:', this.draftData.league_id);
  }
  
  isDraftPage() {
    return window.location.pathname.includes('/draft') && 
           window.location.hostname === 'fantasy.espn.com';
  }
  
  isWaitingRoom() {
    return window.location.pathname.includes('/waitingroom') && 
           window.location.hostname === 'fantasy.espn.com';
  }
  
  startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🚀 Starting draft monitoring...');
    
    // Initial scan
    this.scanDraftBoard();
    
    // Set up mutation observer to watch for changes
    this.setupDraftObserver();
    
    // Periodic backup scan every 5 seconds
    setInterval(() => {
      this.scanDraftBoard();
    }, 5000);
  }
  
  setupDraftObserver() {
    const draftBoard = this.findDraftBoard();
    if (!draftBoard) {
      console.warn('⚠️ Could not find draft board for monitoring');
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      let hasChanges = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || 
            mutation.type === 'attributes' ||
            mutation.type === 'characterData') {
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        console.log('🔄 Draft board changed, scanning...');
        setTimeout(() => this.scanDraftBoard(), 1000); // Small delay to let DOM settle
      }
    });
    
    observer.observe(draftBoard, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
    
    console.log('👁️ Draft board observer active');
  }
  
  findDraftBoard() {
    // Multiple selectors to find the draft board
    const selectors = [
      '.draft-board',
      '.draftboard',
      '[data-testid=\"draft-board\"]',
      '.Table--fixed-left',
      '.draft-results',
      '.draft-container'
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log('✅ Found draft board:', selector);
        return element;
      }
    }
    
    // Fallback: look for any container with draft-related content
    const draftElements = document.querySelectorAll('*');
    for (const element of draftElements) {
      if (element.textContent && 
          (element.textContent.includes('Round') || 
           element.textContent.includes('Pick') ||
           element.textContent.includes('Team'))) {
        console.log('✅ Found potential draft container');
        return element.parentElement;
      }
    }
    
    return document.body; // Ultimate fallback
  }
  
  scanDraftBoard() {
    try {
      const picks = this.extractDraftPicks();
      const newPicks = picks.length - this.lastPickCount;
      
      if (newPicks > 0) {
        console.log(`🎯 ${newPicks} new pick(s) detected!`);
        
        // Process new picks (only the actual new ones)
        for (let i = this.lastPickCount; i < picks.length; i++) {
          const pick = picks[i];
          
          // Double-check that this is a real player pick
          if (pick && pick.player && this.isValidPlayerPick(pick.player)) {
            console.log(`✅ Valid pick detected: ${pick.player}`);
            this.processPick(pick, i + 1);
          } else {
            console.log(`⚠️ Filtered invalid pick: ${pick?.player || 'Unknown'}`);
          }
        }
        
        this.lastPickCount = picks.length;
        this.draftData.picks = picks;
        this.draftData.current_pick = picks.length;
      }
    } catch (error) {
      console.error('❌ Error scanning draft board:', error);
    }
  }
  
  isValidPlayerPick(playerName) {
    if (!playerName) return false;
    
    console.log(`🔍 Validating pick: "${playerName}"`);
    
    // Filter out obvious position labels only
    const positionLabels = ['FLEX', 'D/ST', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'];
    if (positionLabels.includes(playerName.toUpperCase().trim())) {
      console.log(`❌ Rejected position label: ${playerName}`);
      return false;
    }
    
    // Filter out ESPN UI text
    if (playerName.includes('Round') || playerName.includes('Pick') || 
        playerName.includes('Select') || playerName.includes('Empty') ||
        playerName.includes('Choose') || playerName.includes('Available')) {
      console.log(`❌ Rejected UI text: ${playerName}`);
      return false;
    }
    
    // Must contain letters
    if (!/[a-zA-Z]/.test(playerName)) {
      console.log(`❌ Rejected no letters: ${playerName}`);
      return false;
    }
    
    // Must be reasonable length
    if (playerName.length < 3 || playerName.length > 50) {
      console.log(`❌ Rejected length: ${playerName}`);
      return false;
    }
    
    console.log(`✅ Approved pick: ${playerName}`);
    return true;
  }
  
  extractDraftPicks() {
    const picks = [];
    
    // Strategy 1: Look for draft pick elements
    const pickElements = document.querySelectorAll([
      '.draft-pick',
      '.pick-cell',
      '.player-name',
      '[data-testid=\"player-name\"]',
      '.Table__TD .player-name'
    ].join(','));
    
    pickElements.forEach((element, index) => {
      const playerName = this.extractPlayerName(element);
      if (playerName && playerName !== 'Empty' && !playerName.includes('Select')) {
        picks.push({
          overall: index + 1,
          player: playerName,
          element: element
        });
      }
    });
    
    // Strategy 2: Look for team roster sections
    if (picks.length === 0) {
      this.extractFromTeamRosters(picks);
    }
    
    // Strategy 3: Look for draft results table
    if (picks.length === 0) {
      this.extractFromDraftTable(picks);
    }
    
    console.log(`📊 Found ${picks.length} total picks`);
    return picks;
  }
  
  extractPlayerName(element) {
    // Try different methods to extract player name
    const text = element.textContent || element.innerText || '';
    
    // Remove common prefixes/suffixes
    let playerName = text
      .replace(/^(Round \d+,?\s*Pick \d+:?\s*)/i, '')
      .replace(/\s*\([^)]*\)\s*$/, '') // Remove position in parentheses
      .replace(/\s*-\s*[A-Z]{2,3}\s*$/, '') // Remove team abbreviation
      .trim();
    
    // Skip if it's not a real player name
    if (!playerName || 
        playerName.includes('Empty') ||
        playerName.includes('Select') ||
        playerName.includes('Round') ||
        playerName.includes('Pick') ||
        playerName.includes('FLEX') ||
        playerName.includes('D/ST') ||
        playerName.includes('QB') ||
        playerName.includes('RB') ||
        playerName.includes('WR') ||
        playerName.includes('TE') ||
        playerName.includes('K') ||
        playerName === 'FLEX' ||
        playerName === 'D/ST' ||
        playerName === 'QB' ||
        playerName === 'RB' ||
        playerName === 'WR' ||
        playerName === 'TE' ||
        playerName === 'K' ||
        playerName.match(/^[A-Z]{1,4}$/) || // Pure position abbreviations
        playerName.length < 3) {
      return null;
    }
    
    // Additional check: must contain at least one space (first + last name) or be a known single name
    if (!playerName.includes(' ') && !this.isKnownSingleName(playerName)) {
      return null;
    }
    
    return playerName;
  }
  
  isKnownSingleName(name) {
    // Some players go by single names, but these are rare in fantasy
    const singleNames = ['Cher', 'Madonna', 'Ronaldinho']; // Add if needed
    return singleNames.includes(name);
  }
  
  extractFromTeamRosters(picks) {
    // Look for team sections and extract players
    const teamSections = document.querySelectorAll('.team-roster, .roster-section');
    
    teamSections.forEach((section, teamIndex) => {
      const players = section.querySelectorAll('.player-name, .roster-player');
      players.forEach((player, playerIndex) => {
        const playerName = this.extractPlayerName(player);
        if (playerName) {
          picks.push({
            overall: picks.length + 1,
            player: playerName,
            team: teamIndex + 1,
            element: player
          });
        }
      });
    });
  }
  
  extractFromDraftTable(picks) {
    // Look for table-based draft results
    const rows = document.querySelectorAll('tr');
    
    rows.forEach((row, index) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const playerCell = Array.from(cells).find(cell => 
          cell.textContent && 
          !cell.textContent.includes('Round') &&
          !cell.textContent.includes('Pick') &&
          cell.textContent.trim().length > 3
        );
        
        if (playerCell) {
          const playerName = this.extractPlayerName(playerCell);
          if (playerName) {
            picks.push({
              overall: picks.length + 1,
              player: playerName,
              element: playerCell
            });
          }
        }
      }
    });
  }
  
  async processPick(pick, pickNumber) {
    console.log(`🎯 Processing pick #${pickNumber}:`, pick.player);
    
    // Determine if it's user's pick
    const isUserPick = this.isUserTeamPick(pick, pickNumber);
    
    // Send Discord notification
    await this.sendPickNotification(pick, pickNumber, isUserPick);
    
    // Notify background service
    chrome.runtime.sendMessage({
      action: 'pickDetected',
      pick: pick,
      pickNumber: pickNumber,
      isUserPick: isUserPick,
      totalPicks: this.draftData.picks.length,
      leagueId: this.draftData.league_id
    });
    
    // Trigger AI analysis if it's user's turn next
    if (this.isUserNextPick(pickNumber)) {
      await this.requestAIAnalysis(pickNumber);
    }
  }
  
  isUserTeamPick(pick, pickNumber) {
    // Logic to determine if this pick belongs to user's team
    // For 8-team snake draft, user (team 2) picks at: 2, 15, 18, 31, 34, etc.
    const userPickNumbers = this.calculateUserPickNumbers();
    return userPickNumbers.includes(pickNumber);
  }
  
  calculateUserPickNumbers() {
    const picks = [];
    const teamCount = 8;
    const rounds = 16;
    
    for (let round = 1; round <= rounds; round++) {
      let pickInRound;
      if (round % 2 === 1) { // Odd rounds (1, 3, 5...)
        pickInRound = this.teamId;
      } else { // Even rounds (2, 4, 6...)
        pickInRound = teamCount - this.teamId + 1;
      }
      
      const overallPick = (round - 1) * teamCount + pickInRound;
      picks.push(overallPick);
    }
    
    return picks;
  }
  
  isUserNextPick(currentPick) {
    const userPicks = this.calculateUserPickNumbers();
    const nextUserPick = userPicks.find(pick => pick > currentPick);
    
    // If user's next pick is within 3 picks, trigger AI analysis
    return nextUserPick && (nextUserPick - currentPick) <= 3;
  }
  
  async sendPickNotification(pick, pickNumber, isUserPick) {
    if (!this.discordWebhook) return;
    
    const embed = {
      title: isUserPick ? '🎯 YOUR DRAFT PICK!' : '📊 Draft Pick Alert',
      description: `**Pick #${pickNumber}**: ${pick.player}`,
      color: isUserPick ? 0xFF6B35 : 0x4A90E2,
      timestamp: new Date().toISOString(),
      footer: {
        text: `Fantasy Command Center • League ${this.draftData.league_id}`
      }
    };
    
    if (isUserPick) {
      embed.fields = [{
        name: '🏆 Team Update',
        value: `Baron's Best Team selected ${pick.player}`,
        inline: false
      }];
    }
    
    try {
      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
      
      console.log('✅ Discord notification sent');
    } catch (error) {
      console.error('❌ Failed to send Discord notification:', error);
    }
  }
  
  async requestAIAnalysis(currentPick) {
    // Send request to Discord bot to analyze current draft state
    const analysisWebhook = this.discordWebhook; // Could be different webhook
    
    const embed = {
      title: '🤖 AI Analysis Request',
      description: `Please analyze draft state for upcoming pick`,
      color: 0x9B59B6,
      fields: [
        {
          name: 'Current Pick',
          value: `#${currentPick}`,
          inline: true
        },
        {
          name: 'League ID', 
          value: this.draftData.league_id,
          inline: true
        },
        {
          name: 'Request',
          value: 'Generate pick recommendations for Baron\'s Best Team',
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(analysisWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: '!coach analyze draft state',
          embeds: [embed] 
        })
      });
      
      console.log('🤖 AI analysis requested');
    } catch (error) {
      console.error('❌ Failed to request AI analysis:', error);
    }
  }
  
  async sendConnectionNotification() {
    if (!this.discordWebhook) return;
    
    const embed = {
      title: '🚀 Fantasy Command Center Connected!',
      description: `Chrome extension monitoring League ${this.draftData.league_id}`,
      color: 0x00FF00,
      fields: [
        {
          name: 'Status',
          value: 'Live draft monitoring active',
          inline: true
        },
        {
          name: 'Your Team',
          value: `Team ${this.teamId} (Baron's Best Team)`,
          inline: true
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
      
      console.log('✅ Connection notification sent');
    } catch (error) {
      console.error('❌ Failed to send connection notification:', error);
    }
  }
  
  // Export functionality for post-draft analysis
  exportDraftResults() {
    const exportData = {
      league_id: this.draftData.league_id,
      export_time: new Date().toISOString(),
      total_picks: this.draftData.picks.length,
      picks: this.draftData.picks,
      teams: this.draftData.teams,
      user_team_id: this.teamId,
      user_picks: this.draftData.picks.filter((_, index) => 
        this.calculateUserPickNumbers().includes(index + 1)
      )
    };
    
    // Create download link
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `draft_results_${this.draftData.league_id}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    console.log('📁 Draft results exported');
    
    // Notify Discord of export
    if (this.discordWebhook) {
      this.sendExportNotification(exportData);
    }
  }
  
  async sendExportNotification(exportData) {
    const embed = {
      title: '📁 Draft Results Exported',
      description: `Complete draft data exported for League ${exportData.league_id}`,
      color: 0x4CAF50,
      fields: [
        {
          name: 'Total Picks',
          value: exportData.total_picks.toString(),
          inline: true
        },
        {
          name: 'Your Picks',
          value: exportData.user_picks.length.toString(),
          inline: true
        },
        {
          name: 'Export Time',
          value: new Date().toLocaleString(),
          inline: false
        }
      ],
      timestamp: new Date().toISOString()
    };
    
    try {
      await fetch(this.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
    } catch (error) {
      console.error('Failed to send export notification:', error);
    }
  }
}

// Global monitor instance
let draftMonitor = null;

// Message handler for communication with popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    switch (message.action) {
      case 'getStatus':
        if (draftMonitor) {
          const isWaiting = draftMonitor.isWaitingRoom && draftMonitor.isWaitingRoom();
          sendResponse({
            monitoring: draftMonitor.isMonitoring,
            pickCount: draftMonitor.lastPickCount,
            leagueId: draftMonitor.draftData.league_id,
            waitingRoom: isWaiting,
            status: isWaiting ? 'waiting' : (draftMonitor.isMonitoring ? 'monitoring' : 'inactive')
          });
        } else {
          sendResponse({ monitoring: false, pickCount: 0, status: 'inactive' });
        }
        break;
        
      case 'exportDraft':
        if (draftMonitor) {
          draftMonitor.exportDraftResults();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No monitor active' });
        }
        break;
        
      case 'refreshMonitor':
        if (draftMonitor) {
          draftMonitor.scanDraftBoard();
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No monitor active' });
        }
        break;
        
      default:
        sendResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep message channel open
});

// Initialize the monitor when page loads
function initializeMonitor() {
  if (!draftMonitor) {
    draftMonitor = new FantasyDraftMonitor();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMonitor);
} else {
  initializeMonitor();
}

// Re-initialize on page navigation (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    if (url.includes('/draft')) {
      setTimeout(initializeMonitor, 1000);
    }
  }
}).observe(document, { subtree: true, childList: true });