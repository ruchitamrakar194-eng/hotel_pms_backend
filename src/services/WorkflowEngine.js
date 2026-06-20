const automationEngine = require('./AutomationEngine');

const executeWorkflow = async (context) => {
  const { hotelId, sender, message, channel } = context;
  return await automationEngine.handleIncomingMessage(hotelId, sender, message, channel);
};

module.exports = {
  executeWorkflow
};
