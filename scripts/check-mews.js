const mewsService = require('../src/services/mewsService');

async function getServices() {
  try {
    const services = await mewsService._request(13, '/services/getAll', {});
    console.log("Services:", JSON.stringify(services.Services.filter(s => s.IsActive).map(s => ({Id: s.Id, Name: s.Name, Type: s.Type})), null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}

getServices();
