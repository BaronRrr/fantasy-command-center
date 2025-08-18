/**
 * Fantasy Command Center - Chrome Extension Popup
 * Manages configuration and status display
 */

class PopupManager {
  constructor() {
    this.config = {
      discordWebhook: '',
      teamId: 2,
      enableNotifications: true
    };
    
    this.init();
  }

  async init() {
    // Load saved configuration
    await this.loadConfiguration();
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Update status
    await this.updateStatus();
    
    // Auto-refresh status every 5 seconds
    setInterval(() => this.updateStatus(), 5000);
  }

  async loadConfiguration() {
    try {
      const result = await chrome.storage.sync.get([
        'discordWebhook', 
        'teamId', 
        'enableNotifications'
      ]);
      
      this.config = {
        discordWebhook: result.discordWebhook || 'https://discord.com/api/webhooks/1406098016800346263/w1XCdLHjGN38eM2smYNuGy6E7pQ2CMplyE0-amnsRT87d9vqgE1dA1kX_RJBpXGZL5yN',
        teamId: result.teamId || 2,
        enableNotifications: result.enableNotifications !== false
      };
      
      // Populate form fields
      document.getElementById('discordWebhook').value = this.config.discordWebhook;
      document.getElementById('teamId').value = this.config.teamId;
      
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.showNotification('Failed to load saved settings', 'error');
    }
  }

  setupEventListeners() {
    // Save configuration
    document.getElementById('saveConfig').addEventListener('click', () => {
      this.saveConfiguration();
    });

    // Test Discord connection
    document.getElementById('testConnection').addEventListener('click', () => {
      this.testDiscordConnection();
    });

    // Export draft results
    document.getElementById('exportDraft').addEventListener('click', () => {
      this.exportDraftResults();
    });

    // Refresh status
    document.getElementById('refreshStatus').addEventListener('click', () => {
      this.updateStatus();
    });

    // Quick actions
    document.getElementById('openEspnDraft').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://fantasy.espn.com/football/draft' });
    });

    document.getElementById('openDiscord').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://discord.com/channels/@me' });
    });
  }

  async saveConfiguration() {
    try {
      const discordWebhook = document.getElementById('discordWebhook').value.trim();
      const teamId = parseInt(document.getElementById('teamId').value) || 2;

      // Validate inputs
      if (!discordWebhook) {
        this.showNotification('Discord webhook URL is required', 'error');
        return;
      }

      if (!discordWebhook.startsWith('https://discord.com/api/webhooks/')) {
        this.showNotification('Invalid Discord webhook URL format', 'error');
        return;
      }

      // Save to storage
      await chrome.storage.sync.set({
        discordWebhook: discordWebhook,
        teamId: teamId,
        enableNotifications: true
      });

      this.config = { discordWebhook, teamId, enableNotifications: true };
      
      this.showNotification('Configuration saved successfully!', 'success');
      
      // Update status
      await this.updateStatus();

    } catch (error) {
      console.error('Failed to save configuration:', error);
      this.showNotification('Failed to save configuration', 'error');
    }
  }

  async testDiscordConnection() {
    try {
      if (!this.config.discordWebhook) {
        this.showNotification('Please save Discord webhook URL first', 'error');
        return;
      }

      const testMessage = {
        embeds: [{
          title: '🧪 Fantasy Command Center Test',
          description: 'This is a test message from your Chrome extension!',
          color: 0x00FF00,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Fantasy Command Center • Chrome Extension Test'
          }
        }]
      };

      const response = await fetch(this.config.discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testMessage)
      });

      if (response.ok) {
        this.showNotification('✅ Discord connection successful!', 'success');
      } else {
        this.showNotification('❌ Discord connection failed', 'error');
      }

    } catch (error) {
      console.error('Discord test failed:', error);
      this.showNotification('Discord connection test failed', 'error');
    }
  }

  async exportDraftResults() {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url?.includes('fantasy.espn.com')) {
        this.showNotification('Please navigate to ESPN Fantasy draft page first', 'error');
        return;
      }

      // Execute export function in content script
      await chrome.tabs.sendMessage(tab.id, { action: 'exportDraft' });
      
      this.showNotification('Draft results exported!', 'success');

    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed - make sure you\'re on ESPN draft page', 'error');
    }
  }

  async updateStatus() {
    try {
      // Check if we're on ESPN fantasy page
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const isEspnPage = tab?.url?.includes('fantasy.espn.com');
      const isDraftPage = tab?.url?.includes('/draft');

      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      const draftStatus = document.getElementById('draftStatus');
      const picksCount = document.getElementById('picksCount');

      if (isEspnPage && isDraftPage) {
        // Try to get status from content script
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          
          if (response?.monitoring) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected & Monitoring';
            draftStatus.textContent = `Active - League ${response.leagueId || 'Unknown'}`;
            picksCount.textContent = `${response.pickCount || 0} picks detected`;
          } else if (response?.waitingRoom) {
            statusDot.className = 'status-dot waiting';
            statusText.textContent = 'Waiting Room';
            draftStatus.textContent = `Waiting for draft to begin - League ${response.leagueId || 'Unknown'}`;
            picksCount.textContent = 'Draft hasn\'t started yet';
          } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = 'On ESPN Draft Page';
            draftStatus.textContent = 'Ready to monitor';
            picksCount.textContent = '0 picks detected';
          }
        } catch (error) {
          // Content script not loaded yet
          statusDot.className = 'status-dot disconnected';
          statusText.textContent = 'Loading monitor...';
          draftStatus.textContent = 'Initializing';
        }
      } else if (isEspnPage && tab?.url?.includes('waitingroom')) {
        // Check if we're in waiting room specifically
        try {
          const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
          statusDot.className = 'status-dot waiting';
          statusText.textContent = 'Waiting Room';
          draftStatus.textContent = `Waiting for draft - League ${response?.leagueId || 'Unknown'}`;
          picksCount.textContent = 'Will auto-start when draft begins';
        } catch (error) {
          statusDot.className = 'status-dot waiting';
          statusText.textContent = 'Waiting Room';
          draftStatus.textContent = 'Waiting for draft to begin';
          picksCount.textContent = 'Will auto-start monitoring';
        }
      } else if (isEspnPage) {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'On ESPN Fantasy';
        draftStatus.textContent = 'Navigate to draft page';
        picksCount.textContent = 'Not monitoring';
      } else {
        statusDot.className = 'status-dot disconnected';
        statusText.textContent = 'Not Connected';
        draftStatus.textContent = 'Go to fantasy.espn.com/draft';
        picksCount.textContent = 'Not monitoring';
      }

    } catch (error) {
      console.error('Status update failed:', error);
      
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Connection Error';
    }
  }

  showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    // Hide after 3 seconds
    setTimeout(() => {
      notification.classList.add('hidden');
    }, 3000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'statusUpdate') {
    // Update UI with new status
    document.getElementById('picksCount').textContent = `${message.pickCount || 0} picks detected`;
  }
});