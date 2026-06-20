const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/prisma');
// Trigger restart after prisma client generation


const startServer = async () => {
  try {
    // Validate database connection
    await prisma.$connect();
    console.log('Prisma ORM connected to MySQL database successfully.');

    app.listen(config.port, () => {
      console.log(`Backend Express server running in ${config.env} mode on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
