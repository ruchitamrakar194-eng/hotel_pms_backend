/**
 * Twilio Phone Calling Integration Placeholder & Voice Call Management Service
 * Manages voice call structures, escalation rules, and data placeholders.
 */

// In-memory data structures acting as placeholder tables
const voice_calls = [];
const call_transcripts = [];
const call_logs = [];

const initializeCall = async (guestId, guestName, roomNumber) => {
  console.log(`[VoiceCall Service] Initializing Twilio voice call session for ${guestName} (Room ${roomNumber})`);
  const callId = `CALL-${Date.now()}`;
  const callSession = {
    callId,
    guestId,
    guestName,
    roomNumber,
    startTime: new Date(),
    status: 'Active',
    duration: 0,
    mute: false
  };
  voice_calls.push(callSession);
  return callSession;
};

const logTranscript = async (callId, speaker, text) => {
  const entry = {
    id: `TRANS-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    callId,
    speaker,
    text,
    timestamp: new Date()
  };
  call_transcripts.push(entry);
  return entry;
};

const checkEscalationCriteria = async (confidenceScore, sentiment, billingAmount, isHumanRequested) => {
  if (confidenceScore < 0.70) {
    return { escalate: true, reason: 'AI confidence score below operational threshold' };
  }
  if (sentiment === 'angry') {
    return { escalate: true, reason: 'Guest angry sentiment detected' };
  }
  if (billingAmount > 200) {
    return { escalate: true, reason: 'Billing/refund request exceeds auto-approval limit' };
  }
  if (isHumanRequested) {
    return { escalate: true, reason: 'Guest explicitly requested human support' };
  }
  return { escalate: false, reason: null };
};

const endCall = async (callId) => {
  const call = voice_calls.find(c => c.callId === callId);
  if (call) {
    call.status = 'Ended';
    call.endTime = new Date();
    call.duration = Math.round((call.endTime - call.startTime) / 1000);
    call_logs.push({ ...call });
  }
  return call || { status: 'Ended', callId };
};

module.exports = {
  voice_calls,
  call_transcripts,
  call_logs,
  initializeCall,
  logTranscript,
  checkEscalationCriteria,
  endCall
};
