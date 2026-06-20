const prisma = require('../config/prisma');
const crypto = require('crypto');
const emailService = require('./emailService');
const bcrypt = require('bcryptjs');
const secureStorage = require('./secureStorage');

/**
 * Onboarding Request Service handling business logic and database queries for landing page forms
 */
const getAllRequests = async () => {
  let requests = await prisma.onboardingRequest.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Format requests to match frontend state perfectly
  return requests.map(r => {
    let parsedMessages = [];
    try { parsedMessages = r.messages ? JSON.parse(r.messages) : []; } catch (e) { parsedMessages = []; }

    let parsedChecklist = [];
    try { parsedChecklist = r.checklist ? JSON.parse(r.checklist) : []; } catch (e) { parsedChecklist = []; }

    let parsedTimeline = [];
    try { parsedTimeline = r.timeline ? JSON.parse(r.timeline) : []; } catch (e) { parsedTimeline = []; }

    let parsedSops = [];
    try { parsedSops = r.sopDocuments ? JSON.parse(r.sopDocuments) : []; } catch (e) { parsedSops = []; }

    return {
      id: r.requestId,
      hotelName: r.hotelName,
      managerName: r.contactName,
      contactName: r.contactName,
      email: r.email,
      workEmail: r.email,
      phone: r.whatsapp || '',
      whatsapp: r.whatsapp || '',
      country: 'International',
      pmsType: r.pmsProvider,
      pmsProvider: r.pmsProvider,
      roomCount: parseInt(r.roomCount) || 100,
      rooms: r.roomCount,
      plan: r.plan,
      status: r.status,
      specialist: r.specialist,
      integrationHealth: r.integrationHealth,
      notes: r.notes || '',
      date: r.createdAt.toISOString().split('T')[0],
      onboardingToken: r.onboardingToken,
      operator: { name: r.specialist, role: 'Hospitality Onboarding Specialist' },
      website: r.website || '',
      hotelType: r.hotelType || 'Boutique',
      uniqueHotelId: r.uniqueHotelId || '',
      messages: parsedMessages,
      checklist: parsedChecklist,
      timeline: parsedTimeline,
      customizationReqs: r.customizationReqs || '',
      sopDocuments: parsedSops
    };
  });
};

const createRequest = async (data) => {
  const reqId = `REQ-${Math.floor(100 + Math.random() * 900)}`;
  
  // Default checklist for onboarding
  const defaultChecklist = [
    { id: 1, task: "Discuss automation & pricing customization", done: false },
    { id: 2, task: "Finalize agreement & sign onboarding contract", done: false },
    { id: 3, task: "Submit system credentials securely", done: false },
    { id: 4, task: "Provision isolated hotel workspace shard", done: false },
    { id: 5, task: "Verify PMS & WhatsApp gateway APIs", done: false },
    { id: 6, task: "Activate hotel live agent workspace", done: false }
  ];

  // Default timeline
  const defaultTimeline = [
    { date: new Date().toISOString().split('T')[0], event: "Onboarding Request submitted from landing page", category: "system" }
  ];

  // Default messages
  const defaultMessages = [
    { sender: "system", content: "Hotel Setup Request submitted successfully. Awaiting initial super admin review.", timestamp: new Date().toISOString() }
  ];

  const created = await prisma.onboardingRequest.create({
    data: {
      requestId: reqId,
      hotelName: data.hotelName || 'Unnamed Hotel',
      contactName: data.fullName || data.contactName || data.managerName || 'Client',
      email: data.workEmail || data.email || 'noemail@example.com',
      whatsapp: data.whatsapp || data.phone || null,
      pmsProvider: data.pmsProvider || data.pmsType || 'Mews',
      roomCount: data.roomCount?.toString() || data.rooms?.toString() || '100',
      plan: data.plan || 'Trial',
      notes: data.notes || null,
      status: 'pending_review',
      website: data.website || '',
      hotelType: data.hotelType || 'Boutique',
      checklist: JSON.stringify(defaultChecklist),
      timeline: JSON.stringify(defaultTimeline),
      messages: JSON.stringify(defaultMessages),
      specialist: 'Unassigned',
      integrationHealth: 'Pending'
    }
  });

  return {
    id: created.requestId,
    hotelName: created.hotelName,
    managerName: created.contactName,
    contactName: created.contactName,
    email: created.email,
    workEmail: created.email,
    phone: created.whatsapp || '',
    whatsapp: created.whatsapp || '',
    country: 'International',
    pmsType: created.pmsProvider,
    pmsProvider: created.pmsProvider,
    roomCount: parseInt(created.roomCount) || 100,
    rooms: created.roomCount,
    plan: created.plan,
    status: created.status,
    specialist: created.specialist,
    integrationHealth: created.integrationHealth,
    notes: created.notes || '',
    date: created.createdAt.toISOString().split('T')[0],
    operator: { name: created.specialist, role: 'Hospitality Onboarding Specialist' },
    website: created.website || '',
    hotelType: created.hotelType || 'Boutique',
    uniqueHotelId: '',
    messages: defaultMessages,
    checklist: defaultChecklist,
    timeline: defaultTimeline,
    customizationReqs: '',
    sopDocuments: []
  };
};

const updateRequest = async (requestId, updates) => {
  const currentRequest = await prisma.onboardingRequest.findUnique({
    where: { requestId }
  });

  if (!currentRequest) throw new Error('Request not found');

  const data = {};

  // Simple string properties
  if (updates.status !== undefined) data.status = updates.status;
  if (updates.specialist !== undefined) data.specialist = updates.specialist;
  if (updates.integrationHealth !== undefined) data.integrationHealth = updates.integrationHealth;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.website !== undefined) data.website = updates.website;
  if (updates.hotelType !== undefined) data.hotelType = updates.hotelType;
  if (updates.uniqueHotelId !== undefined) data.uniqueHotelId = updates.uniqueHotelId;
  if (updates.customizationReqs !== undefined) data.customizationReqs = updates.customizationReqs;

  // JSON serialized columns
  if (updates.messages !== undefined) {
    data.messages = JSON.stringify(updates.messages);
  }
  if (updates.checklist !== undefined) {
    data.checklist = JSON.stringify(updates.checklist);
  }
  if (updates.timeline !== undefined) {
    data.timeline = JSON.stringify(updates.timeline);
  }
  if (updates.sopDocuments !== undefined) {
    data.sopDocuments = JSON.stringify(updates.sopDocuments);
  }

  // Handle sensitive credential routing (Step 7 — SECURE STORAGE in Google Secret Manager)
  if (updates.pmsApiKey || updates.pmsSecret || updates.whatsappApiKey || updates.smtpPass) {
    console.log(`[SECURE STORAGE GATEWAY] 🔒 Intercepting sensitive credentials for ${currentRequest.hotelName}. Redacting database entry...`);
    const hotelId = updates.uniqueHotelId || currentRequest.uniqueHotelId || `hotel_ws_${Math.floor(100 + Math.random() * 900)}`;
    
    if (updates.pmsApiKey) {
      await secureStorage.saveSecretToSecretManager(hotelId, 'pmsApiKey', updates.pmsApiKey);
      data.pmsApiKey = '[SECURELY_STORED_IN_SECRET_MANAGER]';
    }
    if (updates.pmsSecret) {
      await secureStorage.saveSecretToSecretManager(hotelId, 'pmsSecret', updates.pmsSecret);
      data.pmsSecret = '[SECURELY_STORED_IN_SECRET_MANAGER]';
    }
    if (updates.whatsappApiKey) {
      await secureStorage.saveSecretToSecretManager(hotelId, 'whatsappApiKey', updates.whatsappApiKey);
      data.whatsappApiKey = '[SECURELY_STORED_IN_SECRET_MANAGER]';
    }
    if (updates.smtpPass) {
      await secureStorage.saveSecretToSecretManager(hotelId, 'smtpPass', updates.smtpPass);
      data.smtpPass = '[SECURELY_STORED_IN_SECRET_MANAGER]';
    }
    
    // Save non-sensitive config parts
    if (updates.smtpHost) data.smtpHost = updates.smtpHost;
    if (updates.smtpUser) data.smtpUser = updates.smtpUser;
    if (updates.webhookUrl) data.webhookUrl = updates.webhookUrl;
  } else {
    // If not encrypted, still save non-sensitive fields
    if (updates.smtpHost !== undefined) data.smtpHost = updates.smtpHost;
    if (updates.smtpUser !== undefined) data.smtpUser = updates.smtpUser;
    if (updates.webhookUrl !== undefined) data.webhookUrl = updates.webhookUrl;
  }

  // Handle status transitions
  if (updates.status === 'approved_waiting_discussion') {
    // Initialize or append timeline event
    let currentTimeline = [];
    try { currentTimeline = currentRequest.timeline ? JSON.parse(currentRequest.timeline) : []; } catch (e) { currentTimeline = []; }
    if (!currentTimeline.some(t => t.event.includes("approved"))) {
      currentTimeline.push({
        date: new Date().toISOString().split('T')[0],
        event: "Request approved by admin. Onboarding discussion channel initialized.",
        category: "action"
      });
      data.timeline = JSON.stringify(currentTimeline);
    }
  }

  if (updates.status === 'configured' && !currentRequest.uniqueHotelId && !data.uniqueHotelId) {
    // Generate uniqueHotelId
    data.uniqueHotelId = `hotel_ws_${Math.floor(100 + Math.random() * 900)}`;
    let currentTimeline = [];
    try { currentTimeline = currentRequest.timeline ? JSON.parse(currentRequest.timeline) : []; } catch (e) { currentTimeline = []; }
    currentTimeline.push({
      date: new Date().toISOString().split('T')[0],
      event: `Isolated virtual database shard provisioned successfully: ${data.uniqueHotelId}`,
      category: "system"
    });
    data.timeline = JSON.stringify(currentTimeline);
  }

  // 2. Activation Flow -> Create Hotel & User (Step 10 - ACTIVATION)
  if (updates.status === 'active') {
    // Generate secure temp password
    const tempPassword = `AutoPilot@${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const workspaceId = currentRequest.uniqueHotelId || data.uniqueHotelId || `hotel_ws_${Math.floor(100 + Math.random() * 900)}`;

    // Atomic Transaction: Create Hotel + Create Admin User + Update Request
    await prisma.$transaction(async (tx) => {
      // Create Hotel Record
      await tx.hotel.create({
        data: {
          hotelName: currentRequest.hotelName,
          pmsProvider: currentRequest.pmsProvider,
          subscriptionPlan: currentRequest.plan || 'Standard',
          aiStatus: 'Active',
          onboardingStatus: 'Completed',
          whatsappConnected: true,
          pmsConnected: true,
          emailConnected: true,
          totalRooms: parseInt(currentRequest.roomCount) || 100,
          pmsApiKey: '[SECURELY_STORED_IN_SECRET_MANAGER]',
          pmsSecret: '[SECURELY_STORED_IN_SECRET_MANAGER]',
          hotelCode: workspaceId
        }
      });

      // Create Admin User for the Hotel
      await tx.user.create({
        data: {
          name: currentRequest.contactName || 'Hotel Admin',
          email: currentRequest.email,
          password: hashedPassword,
          role: 'Hotel Admin'
        }
      });
    });

    // Send Activation Email
    await emailService.sendActivationSuccess(currentRequest.email, currentRequest.hotelName, {
      password: tempPassword
    });

    // Update status and append to timeline
    data.status = 'active';
    let currentTimeline = [];
    try { currentTimeline = currentRequest.timeline ? JSON.parse(currentRequest.timeline) : []; } catch (e) { currentTimeline = []; }
    currentTimeline.push({
      date: new Date().toISOString().split('T')[0],
      event: `Active hotel account initialized. Secure temporary credentials dispatched to ${currentRequest.email}`,
      category: "system"
    });
    data.timeline = JSON.stringify(currentTimeline);
    
    // Save password temporarily in the return payload so frontend can display it in modal!
    const updated = await prisma.onboardingRequest.update({
      where: { requestId },
      data
    });
    
    return { ...updated, tempPassword };
  }

  const updated = await prisma.onboardingRequest.update({
    where: { requestId },
    data
  });
  return updated;
};

// Legacy compatibility wrapper
const updateRequestStatus = async (requestId, status) => {
  return await updateRequest(requestId, { status });
};

const getRequestByToken = async (onboardingToken) => {
  const request = await prisma.onboardingRequest.findUnique({
    where: { onboardingToken }
  });

  if (!request) return null;

  // Check expiration
  if (request.tokenExpires && new Date() > request.tokenExpires) {
    return null;
  }

  let parsedMessages = [];
  try { parsedMessages = request.messages ? JSON.parse(request.messages) : []; } catch (e) { parsedMessages = []; }

  let parsedTimeline = [];
  try { parsedTimeline = request.timeline ? JSON.parse(request.timeline) : []; } catch (e) { parsedTimeline = []; }

  let parsedChecklist = [];
  try { parsedChecklist = request.checklist ? JSON.parse(request.checklist) : []; } catch (e) { parsedChecklist = []; }

  return {
    id: request.requestId,
    requestId: request.requestId,
    hotelName: request.hotelName,
    email: request.email,
    pms: request.pmsProvider,
    pmsProvider: request.pmsProvider,
    status: request.status,
    roomCount: parseInt(request.roomCount) || 100,
    plan: request.plan,
    messages: parsedMessages,
    timeline: parsedTimeline,
    checklist: parsedChecklist
  };
};

const submitCredentials = async (onboardingToken, credentials) => {
  // Map submit to generic update request
  const request = await prisma.onboardingRequest.findUnique({
    where: { onboardingToken }
  });
  
  if (!request) throw new Error('Invalid onboarding token');

  return await updateRequest(request.requestId, {
    ...credentials,
    status: 'Verifying PMS'
  });
};

const postClientMessage = async (onboardingToken, text) => {
  const request = await prisma.onboardingRequest.findUnique({
    where: { onboardingToken }
  });
  
  if (!request) throw new Error('Invalid onboarding token');

  let parsedMessages = [];
  try { parsedMessages = request.messages ? JSON.parse(request.messages) : []; } catch (e) { parsedMessages = []; }
  parsedMessages.push({
    sender: 'Hotel Representative',
    text,
    timestamp: new Date().toISOString()
  });

  let parsedTimeline = [];
  try { parsedTimeline = request.timeline ? JSON.parse(request.timeline) : []; } catch (e) { parsedTimeline = []; }
  parsedTimeline.push({
    date: new Date().toISOString().split('T')[0],
    event: `Client posted comment: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
    category: 'system'
  });

  const updated = await prisma.onboardingRequest.update({
    where: { requestId: request.requestId },
    data: {
      messages: JSON.stringify(parsedMessages),
      timeline: JSON.stringify(parsedTimeline)
    }
  });

  let parsedChecklist = [];
  try { parsedChecklist = updated.checklist ? JSON.parse(updated.checklist) : []; } catch (e) { parsedChecklist = []; }

  // SIMULATOR NOTIFICATION LOGS
  console.log(`[WHATSAPP ALERT] Sent to Super Admin: Client of ${updated.hotelName} replied: "${text}"`);
  console.log(`[EMAIL ALERT] Sent to onboarding@autopilot.ai: New comment from ${updated.hotelName} — "${text}"`);

  return {
    id: updated.requestId,
    requestId: updated.requestId,
    hotelName: updated.hotelName,
    email: updated.email,
    pms: updated.pmsProvider,
    pmsProvider: updated.pmsProvider,
    status: updated.status,
    roomCount: parseInt(updated.roomCount) || 100,
    plan: updated.plan,
    messages: parsedMessages,
    timeline: parsedTimeline,
    checklist: parsedChecklist
  };
};

const deleteRequest = async (requestId) => {
  return await prisma.onboardingRequest.delete({
    where: { requestId }
  });
};

module.exports = {
  getAllRequests,
  createRequest,
  updateRequest,
  updateRequestStatus,
  getRequestByToken,
  submitCredentials,
  postClientMessage,
  deleteRequest
};
