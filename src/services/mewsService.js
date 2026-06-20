const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const config = require('../config/env');
const { decrypt } = require('../utils/cryptoUtils');

/**
 * Mews API Service
 * Handles all communication with the Mews PMS API dynamically per hotel
 */
class MewsService {
  /**
   * Helper to fetch credentials from DB for a specific hotel
   */
  async _getHotelCredentials(hotelId) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new Error(`Hotel with ID ${hotelId} not found`);
    if (!hotel.pmsApiKey || !hotel.pmsSecret) {
      throw new Error(`Mews credentials missing for Hotel ID ${hotelId}`);
    }

    return {
      baseUrl: (hotel.pmsBaseUrl || config.mews.baseUrl || 'https://api.mews-demo.com/api/connector/v1').replace(/\/$/, ''),
      clientToken: decrypt(hotel.pmsApiKey),
      accessToken: decrypt(hotel.pmsSecret)
    };
  }

  /**
   * Generic request handler for Mews API with Failure Classifier
   */
  async _request(hotelId, endpoint, data = {}) {
    try {
      const creds = await this._getHotelCredentials(hotelId);

      const payload = {
        ClientToken: creds.clientToken,
        AccessToken: creds.accessToken,
        ...data
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      let response;
      try {
        response = await fetch(`${creds.baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (networkError) {
        if (networkError.name === 'AbortError') {
          await prisma.activityLog.create({
            data: { conversationId: 0, actionType: "AMBIGUOUS_TIMEOUT_DETECTED", actionDetails: `Timeout on ${endpoint}` }
          });
          const err = new Error("Mews Timeout: AMBIGUOUS state.");
          err.classification = "AMBIGUOUS";
          throw err;
        }
        throw networkError;
      }

      const result = await response.json();
      
      console.log(`\n========================================`);
      console.log(`📡 [MEWS API REQUEST] -> ${endpoint}`);
      console.log(`Payload:`, JSON.stringify(data));
      console.log(`Response Status:`, response.status);
      console.log(`Response Data:`, JSON.stringify(result).substring(0, 500));
      console.log(`========================================\n`);

      if (!response.ok) {
        const errorMsg = result.Message || `Mews API Error: ${response.status}`;
        const err = new Error(errorMsg);
        if ([502, 503, 504].includes(response.status)) {
           err.classification = "RETRYABLE";
           await prisma.activityLog.create({
             data: { conversationId: 0, actionType: "MEWS_RETRY_CLASSIFIED", actionDetails: `Status ${response.status} on ${endpoint}` }
           });
        } else if ([400, 401, 403, 404, 409].includes(response.status)) {
           err.classification = "NON_RETRYABLE";
        } else {
           err.classification = "AMBIGUOUS";
        }
        throw err;
      }

      return result;
    } catch (error) {
      console.error(`Mews API Request Failed [${endpoint}] for Hotel ${hotelId}:`, error.message);
      throw error;
    }
  }

  /**
   * 1. Get Guest Profile
   */
  async getGuestProfile(hotelId, email) {
    return this._request(hotelId, '/customers/getAll', {
      Emails: [email]
    });
  }

  /**
   * 1b. Create Guest Profile
   */
  async addCustomer(hotelId, email, firstName, lastName, phone) {
    return this._request(hotelId, '/customers/add', {
      Email: email,
      FirstName: firstName,
      LastName: lastName,
      Telephone: phone
    });
  }

  /**
   * 2. Get Reservation
   */
  async getReservation(hotelId, reservationId) {
    return this._request(hotelId, '/reservations/get', {
      ReservationIds: [reservationId]
    });
  }

  /**
   * 3. Get Guest Stay Details
   */
  async getStayDetails(hotelId, customerId) {
    return this._request(hotelId, '/reservations/getAll', {
      CustomerIds: [customerId]
    });
  }

  /**
   * 4. Update Reservation (e.g. for Late Checkout)
   */
  async updateReservation(hotelId, reservationId, updateData) {
    // Mews update reservation endpoint. For late checkout, we update EndUtc.
    return this._request(hotelId, '/reservations/update', {
      ReservationId: reservationId,
      ...updateData
    });
  }

  /**
   * 5. Get Room Availability
   */
  async getRoomAvailability(hotelId, startUtc, endUtc) {
    return this._request(hotelId, '/resourceBlocks/getAll', {
      CollidingUtc: {
        StartUtc: startUtc,
        EndUtc: endUtc
      }
    });
  }

  /**
   * 6. Get Arrival/Departure
   */
  async getArrivalsDepartures(hotelId, startUtc, endUtc) {
    return this._request(hotelId, '/reservations/getAll', {
      StartUtc: startUtc,
      EndUtc: endUtc,
      Extent: {
        Reservations: true,
        Customers: true
      }
    });
  }

  /**
   * 7. Post Charges To Guest Folio
   */
  async postCharge(hotelId, customerId, amount, currency, serviceId) {
    return this._request(hotelId, '/orders/create', {
      CustomerId: customerId,
      Items: [{
        ServiceId: serviceId,
        Amount: {
          Currency: currency,
          Value: amount
        }
      }]
    });
  }

  /**
   * 8. Create Room Reservation (fetches first available rate automatically)
   */
  async createRoomReservation(hotelId, customerId, serviceId, startUtc, endUtc, rateId = null) {
    let finalRateId = rateId;
    if (!finalRateId) {
      // Fetch first active rate for this service
      const ratesRes = await this._request(hotelId, '/rates/getAll', {
        ServiceIds: [serviceId]
      });
      const rates = (ratesRes.Rates || []);
      if (rates.length === 0) throw new Error('No rate plans found for this room service.');
      
      // Prefer "Fully Flexible" or "No-Flex", otherwise use first rate
      const preferred = rates.find(r => r.Name === 'Fully Flexible') || rates.find(r => r.Name === 'No-Flex') || rates[0];
      finalRateId = preferred.Id;
      console.log(`Using auto-selected rate: "${preferred.Name}" [${finalRateId}]`);
    } else {
      console.log(`Using explicit rate: [${finalRateId}]`);
    }
    
    return this._request(hotelId, '/reservations/add', {
      Reservations: [{
        CustomerId: customerId,
        ServiceId: serviceId,
        RateId: finalRateId,
        StartUtc: startUtc,
        EndUtc: endUtc
      }]
    });
  }

  /**
   * 9. Create Service Reservation (spa, breakfast etc.)
   */
  async createServiceReservation(hotelId, customerId, serviceId, startUtc, endUtc) {
    return this._request(hotelId, '/reservations/add', {
      Reservations: [{
        CustomerId: customerId,
        ServiceId: serviceId,
        StartUtc: startUtc,
        EndUtc: endUtc
      }]
    });
  }

  /**
   * 9. Send Payment Link
   */
  async sendPaymentLink(hotelId, customerId, amount, currency) {
    return this._request(hotelId, '/paymentRequests/create', {
      CustomerId: customerId,
      Amount: {
        Currency: currency,
        Value: amount
      }
    });
  }

  /**
   * 10. Update Guest Notes
   */
  async updateGuestNotes(hotelId, customerId, notes) {
    return this._request(hotelId, '/customers/update', {
      CustomerId: customerId,
      Notes: notes
    });
  }

  /**
   * 11. Cancel Reservation
   */
  async cancelReservation(hotelId, reservationId, reason) {
    return this._request(hotelId, '/reservations/cancel', {
      ReservationId: reservationId,
      Reason: reason
    });
  }

  /**
   * 12. Get Folio Balance (Unpaid items)
   */
  async getFolioBalance(hotelId, customerId) {
    return this._request(hotelId, '/accountingItems/getAll', {
      CustomerIds: [customerId],
      States: ['Unpaid']
    });
  }

  /**
   * 13. Get Services
   */
  async getServices(hotelId) {
    return this._request(hotelId, '/services/getAll', {});
  }

  /**
   * 14. Get Rates
   */
  async getRates(hotelId, serviceId) {
    return this._request(hotelId, '/rates/getAll', {
      ServiceIds: [serviceId]
    });
  }
}

module.exports = new MewsService();
