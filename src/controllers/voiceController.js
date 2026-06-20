const voiceCallService = require('../integrations/voiceCallService');
const speechService = require('../integrations/speechService');
const elevenLabsService = require('../integrations/elevenLabsService');
const asyncHandler = require('../middleware/asyncHandler');
const { sendSuccess } = require('../utils/responseHandler');

const startVoiceCall = asyncHandler(async (req, res) => {
  const { guestId, guestName, roomNumber } = req.body;
  const call = await voiceCallService.initializeCall(guestId || 1, guestName || 'Sarah Jenkins', roomNumber || '502');
  await voiceCallService.logTranscript(call.callId, 'system', 'Voice call initialized via Twilio placeholder');
  return sendSuccess(res, 200, { call });
});

const processVoiceInput = asyncHandler(async (req, res) => {
  const { callId, transcriptText, confidence, sentiment, billingAmount, humanRequest } = req.body;

  // Log guest speech
  await voiceCallService.logTranscript(callId, 'guest', transcriptText || 'Hello, I have a request.');

  // Check escalation logic
  const escalationCheck = await voiceCallService.checkEscalationCriteria(
    confidence !== undefined ? confidence : 0.95,
    sentiment || 'neutral',
    billingAmount || 0,
    humanRequest || false
  );

  if (escalationCheck.escalate) {
    await voiceCallService.logTranscript(callId, 'system', `Escalated: ${escalationCheck.reason}`);
    return sendSuccess(res, 200, {
      escalated: true,
      reason: escalationCheck.reason,
      aiResponse: "I am transferring you to a human operator right away to assist you further.",
      audioUrl: '/audio/transfer.mp3'
    });
  }

  // AI Processes request & checks policies
  const aiProcess = await speechService.processAIConversation(transcriptText, {});
  await voiceCallService.logTranscript(callId, 'ai', aiProcess.response);

  // Synthesize speech via ElevenLabs placeholder
  const audio = await elevenLabsService.synthesizeSpeech(aiProcess.response);

  return sendSuccess(res, 200, {
    escalated: false,
    aiResponse: aiProcess.response,
    audioUrl: audio.audioUrl
  });
});

const endVoiceCall = asyncHandler(async (req, res) => {
  const { callId } = req.body;
  const result = await voiceCallService.endCall(callId);
  return sendSuccess(res, 200, { call: result });
});

module.exports = {
  startVoiceCall,
  processVoiceInput,
  endVoiceCall
};
