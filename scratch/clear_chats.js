require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl
    }
  }
});


async function main() {
  console.log("Connecting to live database to clear all guest and chat data...");
  
  try {
    // Disable foreign key checks for safe truncation/deletion
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    const deletedMessages = await prisma.message.deleteMany({});
    console.log(`Deleted ${deletedMessages.count} messages.`);

    const deletedActivityLogs = await prisma.activityLog.deleteMany({});
    console.log(`Deleted ${deletedActivityLogs.count} activity logs.`);

    const deletedConversations = await prisma.conversation.deleteMany({});
    console.log(`Deleted ${deletedConversations.count} conversations.`);

    const deletedGuests = await prisma.guest.deleteMany({});
    console.log(`Deleted ${deletedGuests.count} guests.`);

    const deletedToolLogs = await prisma.toolExecutionLog.deleteMany({});
    console.log(`Deleted ${deletedToolLogs.count} tool execution logs.`);

    const deletedResCaches = await prisma.reservationCache.deleteMany({});
    console.log(`Deleted ${deletedResCaches.count} reservation caches.`);

    const deletedPaymentLogs = await prisma.paymentTransactionLog.deleteMany({});
    console.log(`Deleted ${deletedPaymentLogs.count} payment transaction logs.`);

    const deletedTxStateLogs = await prisma.transactionStateLog.deleteMany({});
    console.log(`Deleted ${deletedTxStateLogs.count} transaction state logs.`);

    const deletedAuditLogs = await prisma.auditCorrectionLog.deleteMany({});
    console.log(`Deleted ${deletedAuditLogs.count} audit correction logs.`);

    const deletedBookingLocks = await prisma.bookingLock.deleteMany({});
    console.log(`Deleted ${deletedBookingLocks.count} booking locks.`);

    // Re-enable foreign key checks
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log("Successfully cleared all guest and chat data!");
  } catch (error) {
    console.error("Error clearing data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
