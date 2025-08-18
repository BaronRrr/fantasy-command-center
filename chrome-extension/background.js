/**
 * Fantasy Command Center - Chrome Extension Background Service Worker
 * Handles extension lifecycle and communication between components
 */

class BackgroundService {
  constructor() {
    this.activeTabs = new Map(); // Track active draft monitoring tabs
    this.lastNotificationTime = 0;
    this.notificationCooldown = 2000; // 2 seconds between notifications
    
    this.init();
  }

  init() {
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('🏈 Fantasy Command Center background service started');
  }

  setupEventListeners() {
    // Handle extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Handle tab updates (navigation)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    // Handle tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.activeTabs.delete(tabId);
    });

    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      console.log('🚀 Fantasy Command Center extension starting up...');
    });
  }

  handleInstallation(details) {
    if (details.reason === 'install') {
      console.log('🎉 Fantasy Command Center installed!');
      
      // Set default configuration
      chrome.storage.sync.set({
        discordWebhook: 'https://discord.com/api/webhooks/1406098016800346263/w1XCdLHjGN38eM2smYNuGy6E7pQ2CMplyE0-amnsRT87d9vqgE1dA1kX_RJBpXGZL5yN',
        teamId: 2,
        enableNotifications: true,
        installDate: new Date().toISOString()
      });

      // Open welcome tab
      chrome.tabs.create({
        url: 'https://fantasy.espn.com/football/draft'
      });
    } else if (details.reason === 'update') {
      console.log('📈 Fantasy Command Center updated to version', chrome.runtime.getManifest().version);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.action) {
        case 'pickDetected':
          await this.handlePickDetected(message, sender);
          sendResponse({ success: true });
          break;

        case 'requestAIAnalysis':
          await this.handleAIAnalysisRequest(message, sender);
          sendResponse({ success: true });
          break;

        case 'updateTabStatus':
          this.updateTabStatus(sender.tab.id, message.status);
          sendResponse({ success: true });
          break;

        case 'getConfiguration':
          const config = await this.getConfiguration();
          sendResponse(config);
          break;

        case 'logError':
          console.error('Content script error:', message.error);
          await this.sendErrorNotification(message.error, sender);
          sendResponse({ success: true });
          break;

        case 'exportDraft':
          await this.triggerDraftExport(sender.tab.id);
          sendResponse({ success: true });
          break;

        case 'testConnection':
          const testResult = await this.testDiscordConnection();
          sendResponse(testResult);
          break;

        default:
          console.warn('Unknown message action:', message.action);
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background message handler error:', error);
      sendResponse({ error: error.message });
    }
  }

  async handlePickDetected(message, sender) {
    const now = Date.now();
    
    // Throttle notifications to prevent spam
    if (now - this.lastNotificationTime < this.notificationCooldown) {
      console.log('🔇 Pick notification throttled');
      return;
    }

    this.lastNotificationTime = now;

    try {
      // Get configuration
      const config = await this.getConfiguration();
      
      if (!config.discordWebhook) {
        console.warn('No Discord webhook configured');
        return;
      }

      // Update tab status
      this.updateTabStatus(sender.tab.id, {
        monitoring: true,
        pickCount: message.totalPicks,
        lastPick: message.pick
      });

      // Send notification to all open popup windows
      this.broadcastToPopups({
        type: 'pickDetected',
        pick: message.pick,
        totalPicks: message.totalPicks
      });

      console.log('✅ Pick detection handled:', message.pick.player);

    } catch (error) {
      console.error('Failed to handle pick detection:', error);
    }
  }

  async handleAIAnalysisRequest(message, sender) {
    try {
      const config = await this.getConfiguration();
      
      if (!config.discordWebhook) {
        console.warn('No Discord webhook configured for AI analysis');
        return;
      }

      // The actual AI analysis will be triggered by Discord bot
      console.log('🤖 AI analysis request forwarded to Discord');

    } catch (error) {
      console.error('Failed to handle AI analysis request:', error);
    }
  }

  updateTabStatus(tabId, status) {
    this.activeTabs.set(tabId, {
      ...this.activeTabs.get(tabId),
      ...status,
      lastUpdate: new Date().toISOString()
    });
  }

  async getConfiguration() {
    try {
      const result = await chrome.storage.sync.get([
        'discordWebhook',
        'teamId', 
        'enableNotifications'
      ]);
      
      return {
        discordWebhook: result.discordWebhook || '',
        teamId: result.teamId || 2,
        enableNotifications: result.enableNotifications !== false
      };
    } catch (error) {
      console.error('Failed to get configuration:', error);
      return {
        discordWebhook: '',
        teamId: 2,
        enableNotifications: true
      };
    }
  }

  async triggerDraftExport(tabId) {
    try {
      // Send message to content script to export draft data
      const response = await chrome.tabs.sendMessage(tabId, { 
        action: 'exportDraft' 
      });
      
      console.log('📁 Draft export triggered');
      return response;
    } catch (error) {
      console.error('Failed to trigger draft export:', error);
      throw error;
    }
  }

  async testDiscordConnection() {
    try {
      const config = await this.getConfiguration();
      
      if (!config.discordWebhook) {
        return { success: false, error: 'No Discord webhook configured' };
      }

      const testMessage = {
        embeds: [{
          title: '🧪 Fantasy Command Center Test',
          description: 'Background service test message',
          color: 0x9B59B6,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Fantasy Command Center • Background Service'
          }
        }]
      };

      const response = await fetch(config.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage)
      });

      if (response.ok) {
        return { success: true, message: 'Discord connection successful' };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }

    } catch (error) {
      console.error('Discord connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendErrorNotification(error, sender) {
    try {
      const config = await this.getConfiguration();
      
      if (!config.discordWebhook) return;

      const errorMessage = {
        embeds: [{
          title: '⚠️ Fantasy Command Center Error',
          description: `Error in tab: ${sender.tab?.url}\n\`\`\`${error}\`\`\``,
          color: 0xFF0000,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Fantasy Command Center • Error Reporter'
          }
        }]
      };

      await fetch(config.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorMessage)
      });

    } catch (fetchError) {
      console.error('Failed to send error notification:', fetchError);
    }
  }

  broadcastToPopups(message) {
    // Send message to all popup windows
    chrome.runtime.sendMessage(message).catch(() => {
      // Popup might not be open, ignore errors
    });
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Check if this is a relevant ESPN page
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('fantasy.espn.com')) {
      
      if (tab.url.includes('/draft')) {
        console.log('🎯 ESPN draft page loaded in tab', tabId);
        
        // Initialize tab status
        this.updateTabStatus(tabId, {
          monitoring: false,
          pickCount: 0,
          url: tab.url
        });
      }
    }
  }
}

// Initialize background service
const backgroundService = new BackgroundService();

// Keep service worker alive
chrome.runtime.onSuspend.addListener(() => {
  console.log('💤 Fantasy Command Center background service suspending...');
});

// Export for testing (not used in production)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundService;
}