const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/prisma');
// Trigger restart after prisma client generation


const startServer = async () => {
  try {
    // Validate database connection
    await prisma.$connect();
    console.log('Prisma ORM connected to MySQL database successfully.');

    // Initialize IMAP Listeners
    const imapService = require('./services/imapService');
    const activeHotels = await prisma.hotel.findMany({
      where: {
        imapHost: { not: null },
        aiStatus: 'Active'
      }
    });
    
    if (activeHotels.length > 0) {
      console.log(`[STARTUP] Initializing IMAP listeners for ${activeHotels.length} active hotels...`);
      for (const hotel of activeHotels) {
        if (hotel.imapHost && hotel.imapUser && hotel.imapPass) {
          imapService.startListener(hotel);
        }
      }
    }

    const server = app.listen(config.port, () => {
      console.log(`Backend Express server running in ${config.env} mode on port ${config.port}`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
      console.log('Received shutdown signal, closing server...');
      await imapService.shutdown();
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
