const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const guestRoutes = require('./routes/guestRoutes');
const requestRoutes = require('./routes/requestRoutes');
const voiceRoutes = require('./routes/voiceRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const planRoutes = require('./routes/planRoutes');
const billingRoutes = require('./routes/billingRoutes');
const mewsRoutes = require('./routes/mewsRoutes');
const statsRoutes = require('./routes/statsRoutes');
const workflowRoutes = require('./routes/workflowRoutes');
const ragRoutes = require('./routes/ragRoutes');
const revenueRoutes = require('./routes/revenueRoutes');
const activityRoutes = require('./routes/activityRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const errorMiddleware = require('./middleware/errorMiddleware');

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));

// Rate Limiter (Disabled in Development)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/api', limiter);
}

// Raw body capture for WhatsApp webhook HMAC signature verification
// Must be BEFORE express.json() so raw bytes are preserved
app.use('/api/webhooks/whatsapp', express.raw({ type: 'application/json', limit: '10mb' }), (req, res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    req.rawBody = req.body.toString('utf8');
    try { req.body = JSON.parse(req.rawBody); } catch (e) { req.body = {}; }
  }
  next();
});

// Body and Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/mews', mewsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/workflows', workflowRoutes);
const conversationRoutes = require('./routes/conversationRoutes');
const emailRoutes = require('./routes/emailRoutes');

app.use('/api/rag', ragRoutes);
app.use('/api/revenue', revenueRoutes);
app.use('/api/activity-logs', activityRoutes);
app.use('/api/webhooks/whatsapp', whatsappRoutes);
app.use('/api/webhooks/email', emailRoutes);
app.use('/api/conversations', conversationRoutes);

// Centralized Error Handling Middleware
app.use(errorMiddleware);

module.exports = app;
