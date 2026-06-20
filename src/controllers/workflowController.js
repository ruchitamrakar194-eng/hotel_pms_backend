const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: resolve the correct hotelId from user session OR fall back to first hotel in DB
async function resolveHotelId(req) {
  if (req.user?.hotelId) return parseInt(req.user.hotelId, 10);
  const hotel = await prisma.hotel.findFirst({ orderBy: { id: 'asc' } });
  if (!hotel) throw new Error('No hotel found in database');
  return hotel.id;
}

// Get all workflows for a hotel
exports.getWorkflows = async (req, res) => {
  try {
    const hotelId = await resolveHotelId(req);
    const workflows = await prisma.workflow.findMany({ where: { hotelId } });
    res.json(workflows);
  } catch (error) {
    console.error('Get Workflows Error:', error);
    res.status(500).json({ message: 'Failed to fetch workflows' });
  }
};

// Create a new workflow
exports.createWorkflow = async (req, res) => {
  try {
    const hotelId = await resolveHotelId(req);
    const { name, purpose, channel, policySource, escalationTrigger, autoApproveLimit, occupancyThreshold, loyaltyRequired } = req.body;

    const newWorkflow = await prisma.workflow.create({
      data: {
        hotelId,
        name,
        purpose,
        channel: channel || 'WhatsApp',
        policySource: policySource || 'StandardSOP.pdf',
        escalationTrigger: escalationTrigger || 'Confidence < 85%',
        autoApproveLimit,
        occupancyThreshold,
        loyaltyRequired,
        status: 'Active'
      }
    });

    res.status(201).json(newWorkflow);
  } catch (error) {
    console.error('Create Workflow Error:', error);
    res.status(500).json({ message: 'Failed to create workflow' });
  }
};

// Update an existing workflow (toggle status or update rules)
exports.updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedWorkflow = await prisma.workflow.update({
      where: { id: parseInt(id) },
      data: updates
    });

    res.json(updatedWorkflow);
  } catch (error) {
    console.error('Update Workflow Error:', error);
    res.status(500).json({ message: 'Failed to update workflow' });
  }
};
