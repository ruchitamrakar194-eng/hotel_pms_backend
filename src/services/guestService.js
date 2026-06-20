const prisma = require('../config/prisma');

/**
 * Guest Service handling business logic and database queries for guest CRM profiles
 */
const getAllGuests = async () => {
  let guests = await prisma.guest.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Auto-seed initial guests if database table is empty
  if (guests.length === 0) {
    const initialData = [
      { name: 'John Doe', email: 'john@example.com', phone: '+1 234 567 890', status: 'VIP', spent: 1500, visits: 4, roomNumber: '102' },
      { name: 'Emma Watson', email: 'emma@example.com', phone: '+1 987 654 321', status: 'Regular', spent: 400, visits: 1, roomNumber: '101' },
      { name: 'Jane Smith', email: 'jane@example.com', phone: '+1 555 010 999', status: 'Regular', spent: 450, visits: 2, roomNumber: '103' },
      { name: 'Robert Brown', email: 'robert@example.com', phone: '+1 444 222 333', status: 'VIP', spent: 1200, visits: 3, roomNumber: '203' },
    ];

    for (const g of initialData) {
      await prisma.guest.create({ data: g });
    }

    guests = await prisma.guest.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  return guests;
};

const getGuestById = async (id) => {
  const guest = await prisma.guest.findUnique({
    where: { id: parseInt(id) }
  });

  if (!guest) {
    const error = new Error('Guest not found');
    error.statusCode = 404;
    throw error;
  }

  return guest;
};

const createGuest = async (data) => {
  return await prisma.guest.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || 'No Phone',
      status: data.status || 'Regular',
      spent: parseFloat(data.spent) || 0,
      visits: parseInt(data.visits) || 1,
      roomNumber: data.roomNumber || null
    }
  });
};

const updateGuest = async (id, data) => {
  return await prisma.guest.update({
    where: { id: parseInt(id) },
    data
  });
};

const deleteGuest = async (id) => {
  return await prisma.guest.delete({
    where: { id: parseInt(id) }
  });
};

const findByIdentity = async (identity) => {
  return await prisma.guest.findFirst({
    where: {
      OR: [
        { email: identity },
        { phone: identity }
      ]
    }
  });
};

module.exports = {
  getAllGuests,
  getGuestById,
  createGuest,
  updateGuest,
  deleteGuest,
  findByIdentity
};
