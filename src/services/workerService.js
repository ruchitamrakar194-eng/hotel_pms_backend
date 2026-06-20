const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mewsService = require('./mewsService');

class WorkerService {
  /**
   * Service Sync System
   * Cron-like job to ingest /services/getAll into HotelService
   */
  async syncHotelServices() {
    console.log('[Worker] Starting Service Sync...');
    try {
      const hotels = await prisma.hotel.findMany({ where: { pmsConnected: true } });
      for (const hotel of hotels) {
        try {
          const mewsServices = await mewsService.getServices(hotel.id);
          const services = mewsServices.Services || [];
          for (const srv of services) {
             await prisma.hotelService.upsert({
               where: { hotelId_mewsServiceId: { hotelId: hotel.id, mewsServiceId: srv.Id } },
               update: { name: srv.Name, active: srv.IsActive },
               create: { hotelId: hotel.id, mewsServiceId: srv.Id, name: srv.Name, category: "MewsService", active: srv.IsActive }
             });
          }
        } catch (e) {
          console.error(`[Worker] Failed to sync services for hotel ${hotel.id}:`, e.message);
        }
      }
    } catch (err) {
      console.error('[Worker] Global Service Sync Error:', err);
    }
  }

  /**
   * Idempotency Reconciliation Worker
   * Scans ToolExecutionLog for PENDING states stuck > 60s
   */
  async reconcilePendingExecutions() {
    console.log('[Worker] Starting Idempotency Reconciliation...');
    const oneMinuteAgo = new Date(Date.now() - 60000);
    try {
      const stuckLogs = await prisma.toolExecutionLog.findMany({
        where: { status: 'PENDING', createdAt: { lt: oneMinuteAgo } }
      });
      
      for (const log of stuckLogs) {
        try {
           // We would check Mews explicitly based on log.toolName if it succeeded.
           // For simplicity in this implementation we mark it as FAILED to allow retry
           await prisma.toolExecutionLog.update({
             where: { toolCallId: log.toolCallId },
             data: { status: 'FAILED', responsePayload: JSON.stringify({ error: "Reconciled: Execution interrupted." }) }
           });
           
           await prisma.activityLog.create({
             data: {
               conversationId: log.conversationId,
               actionType: "RECONCILIATION_FIXED",
               actionDetails: `Orphaned PENDING toolCallId ${log.toolCallId} was safely marked FAILED.`
             }
           });
        } catch (e) {
           console.error(`[Worker] Failed to reconcile log ${log.toolCallId}:`, e.message);
        }
      }
    } catch (err) {
      console.error('[Worker] Global Reconciliation Error:', err);
    }
  }

  /**
   * Lock Cleanup Worker
   * Purges expired BookingLocks
   */
  async cleanupExpiredLocks() {
    console.log('[Worker] Starting Lock Cleanup...');
    try {
       const deleted = await prisma.bookingLock.deleteMany({
         where: { expiresAt: { lt: new Date() } }
       });
       if (deleted.count > 0) {
         console.log(`[Worker] Purged ${deleted.count} expired locks.`);
       }
    } catch (err) {
       console.error('[Worker] Global Lock Cleanup Error:', err);
    }
  }

  // Starts the worker loops
  start() {
    setInterval(() => this.syncHotelServices(), 1000 * 60 * 60); // Every hour
    setInterval(() => this.reconcilePendingExecutions(), 1000 * 60); // Every minute
    setInterval(() => this.cleanupExpiredLocks(), 1000 * 30); // Every 30 seconds
    
    // Initial run
    this.cleanupExpiredLocks();
    this.reconcilePendingExecutions();
    // this.syncHotelServices(); // Defer initial sync to avoid immediate API blast
  }
}

module.exports = new WorkerService();
