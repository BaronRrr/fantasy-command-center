const express = require('express');
const { config } = require('../config/config');

class HealthCheck {
  constructor() {
    this.app = express();
    this.status = {
      discord: { ready: false, lastCheck: null },
      espn: { ready: false, lastSuccessfulFetch: null },
      claude: { ready: false, lastSuccessfulCall: null },
      database: { ready: false, lastCheck: null },
      scheduler: { ready: false, activeJobs: 0 }
    };
    
    this.setupRoutes();
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const health = this.getHealthStatus();
      const statusCode = health.overall === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Readiness probe
    this.app.get('/ready', (req, res) => {
      const isReady = this.status.discord.ready;
      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString()
      });
    });

    // Liveness probe
    this.app.get('/alive', (req, res) => {
      res.status(200).json({
        alive: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Detailed status
    this.app.get('/status', (req, res) => {
      res.json({
        status: this.status,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          uptime: process.uptime()
        },
        config: {
          nodeEnv: config.app.nodeEnv,
          logLevel: config.app.logLevel,
          hasEspnConfig: !!(config.espn.leagueId && config.espn.s2Cookie),
          hasDiscordConfig: !!config.discord.botToken
        },
        timestamp: new Date().toISOString()
      });
    });
  }

  getHealthStatus() {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    const thirtyMinutesAgo = now - (30 * 60 * 1000);

    // Check if core services are healthy
    const discordHealthy = this.status.discord.ready;
    const claudeHealthy = !this.status.claude.lastSuccessfulCall || 
                         new Date(this.status.claude.lastSuccessfulCall).getTime() > thirtyMinutesAgo;
    const espnHealthy = !this.status.espn.lastSuccessfulFetch || 
                       new Date(this.status.espn.lastSuccessfulFetch).getTime() > thirtyMinutesAgo;

    // Overall health determination
    let overall = 'healthy';
    if (!discordHealthy) {
      overall = 'unhealthy';
    } else if (!claudeHealthy || !espnHealthy) {
      overall = 'degraded';
    }

    return {
      overall,
      services: {
        discord: {
          status: discordHealthy ? 'healthy' : 'unhealthy',
          ready: this.status.discord.ready,
          lastCheck: this.status.discord.lastCheck
        },
        claude: {
          status: claudeHealthy ? 'healthy' : 'degraded',
          lastSuccessfulCall: this.status.claude.lastSuccessfulCall
        },
        espn: {
          status: espnHealthy ? 'healthy' : 'degraded',
          lastSuccessfulFetch: this.status.espn.lastSuccessfulFetch
        },
        scheduler: {
          status: this.status.scheduler.ready ? 'healthy' : 'unhealthy',
          activeJobs: this.status.scheduler.activeJobs
        }
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  }

  // Update methods for other services to call
  updateDiscordStatus(ready) {
    this.status.discord.ready = ready;
    this.status.discord.lastCheck = new Date().toISOString();
  }

  updateClaudeStatus(successful = true) {
    this.status.claude.ready = true;
    if (successful) {
      this.status.claude.lastSuccessfulCall = new Date().toISOString();
    }
  }

  updateEspnStatus(successful = true) {
    this.status.espn.ready = true;
    if (successful) {
      this.status.espn.lastSuccessfulFetch = new Date().toISOString();
    }
  }

  updateSchedulerStatus(ready, activeJobs = 0) {
    this.status.scheduler.ready = ready;
    this.status.scheduler.activeJobs = activeJobs;
  }

  start(port = config.app.port) {
    this.server = this.app.listen(port, () => {
      console.log(`🏥 Health check server running on port ${port}`);
      console.log(`📊 Endpoints:`);
      console.log(`   GET /health  - Overall health status`);
      console.log(`   GET /ready   - Readiness probe`);
      console.log(`   GET /alive   - Liveness probe`);
      console.log(`   GET /status  - Detailed status info`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = HealthCheck;