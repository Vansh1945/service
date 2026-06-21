const mongoose = require('mongoose');

class BookingService {
  static getPayoutStatus(earning, booking) {
    if (!earning) return 'Not Processed';
    if (booking.disputeRaised || booking.disputeStatus === 'under_review') return 'Dispute Hold';

    switch (earning.status) {
      case 'held': return 'Payout On Hold';
      case 'available': return 'Payout Ready';
      case 'paid':
      case 'withdrawn': return 'Payout Released';
      case 'cancelled': return 'Refund Adjusted';
      default: return earning.status;
    }
  }

  static getStartPin(booking) {
    if (!booking.statusHistory) return null;
    for (const history of booking.statusHistory) {
      if (history.note) {
        const match = history.note.match(/START_PIN:(\d{4})/);
        if (match) return match[1];
      }
    }
    return null;
  }

  static getCompletionPin(booking) {
    if (!booking.statusHistory) return null;
    for (const history of booking.statusHistory) {
      if (history.note) {
        const match = history.note.match(/COMPLETION_PIN:(\d{4})/);
        if (match) return match[1];
      }
    }
    return null;
  }

  static async ensureAndPersistPins(bookingId, bookingObj, session = null) {
    let startPin = null;
    let completionPin = null;

    if (bookingObj.statusHistory) {
      for (const history of bookingObj.statusHistory) {
        if (history.note) {
          const startMatch = history.note.match(/START_PIN:(\d{4})/);
          const completionMatch = history.note.match(/COMPLETION_PIN:(\d{4})/);
          if (startMatch) startPin = startMatch[1];
          if (completionMatch) completionPin = completionMatch[1];
        }
      }
    }

    if (!startPin || !completionPin) {
      if (!startPin) startPin = Math.floor(1000 + Math.random() * 9000).toString();
      if (!completionPin) completionPin = Math.floor(1000 + Math.random() * 9000).toString();

      const dbBooking = bookingObj;
      if (dbBooking) {
        if (dbBooking.statusHistory && dbBooking.statusHistory.length > 0) {
          const firstEntry = dbBooking.statusHistory[0];
          let note = firstEntry.note || '';
          if (!note.includes('START_PIN:')) {
            firstEntry.note = `${note} START_PIN:${startPin} COMPLETION_PIN:${completionPin}`.trim();
          } else {
            const startMatch = note.match(/START_PIN:(\d{4})/);
            const completionMatch = note.match(/COMPLETION_PIN:(\d{4})/);
            const sp = startMatch ? startMatch[1] : startPin;
            const cp = completionMatch ? completionMatch[1] : completionPin;
            firstEntry.note = note.replace(/START_PIN:\d{4}/, `START_PIN:${sp}`).replace(/COMPLETION_PIN:\d{4}/, `COMPLETION_PIN:${cp}`);
            startPin = sp;
            completionPin = cp;
          }
        } else {
          dbBooking.statusHistory = [{
            status: dbBooking.status || 'pending',
            timestamp: new Date(),
            note: `START_PIN:${startPin} COMPLETION_PIN:${completionPin}`,
            updatedBy: 'system'
          }];
        }
        if (!session) {
          await dbBooking.save();
        }
      }
    }

    return { startPin, completionPin };
  }

  static getFailedAttempts(booking) {
    if (!booking.statusHistory) return 0;
    for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
      if (booking.statusHistory[i].note) {
        const match = booking.statusHistory[i].note.match(/FAILED_ATTEMPTS:(\d+)/);
        if (match) return parseInt(match[1]);
      }
    }
    return 0;
  }

  static getLockoutTime(booking) {
    if (!booking.statusHistory) return null;
    for (let i = booking.statusHistory.length - 1; i >= 0; i--) {
      if (booking.statusHistory[i].note) {
        const match = booking.statusHistory[i].note.match(/LOCKOUT_UNTIL:(\d+)/);
        if (match) return new Date(parseInt(match[1]));
      }
    }
    return null;
  }

  static async recordPinFailure(booking, isStart, session = null) {
    const attempts = this.getFailedAttempts(booking) + 1;
    const pinType = isStart ? 'START_PIN' : 'COMPLETION_PIN';
    let note = `Failed verification attempt for ${pinType}. FAILED_ATTEMPTS:${attempts}`;

    if (attempts >= 5) {
      const cooldownMs = 15 * 60 * 1000;
      const lockoutUntil = Date.now() + cooldownMs;
      note += ` LOCKOUT_UNTIL:${lockoutUntil}`;
    }

    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note,
      updatedBy: 'system'
    });

    await booking.save({ session });
  }

  static async resetPinFailures(booking, session = null) {
    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Verification successful. FAILED_ATTEMPTS:0`,
      updatedBy: 'system'
    });
    await booking.save({ session });
  }

  static getTargetLocation(booking) {
    if (booking.statusHistory) {
      for (const history of booking.statusHistory) {
        if (history.note) {
          const match = history.note.match(/TARGET_LOCATION:([-\d.]+),([-\d.]+)/);
          if (match) {
            return {
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2])
            };
          }
        }
      }
    }
    return null;
  }

  static async setTargetLocation(booking, latitude, longitude, session = null) {
    booking.statusHistory.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Target address location recorded. TARGET_LOCATION:${latitude},${longitude}`,
      updatedBy: 'system'
    });
    await booking.save({ session });
  }

  static getBookingAddressLocation(booking) {
    const target = this.getTargetLocation(booking);
    if (target) return target;

    const address = booking.address || {};
    const lat = parseFloat(address.lat);
    const lng = parseFloat(address.lng);
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return { latitude: lat, longitude: lng };
    }

    return null;
  }

  static getFraudScore(booking) {
    let score = 0;
    if (booking.statusHistory) {
      for (const history of booking.statusHistory) {
        if (history.note) {
          if (history.note.includes('Failed verification attempt for START_PIN')) {
            score += 10;
          }
          if (history.note.includes('Failed verification attempt for COMPLETION_PIN')) {
            score += 15;
          }
          if (history.note.includes('Geofencing verification failed')) {
            score += 25;
          }
          if (history.note.includes('CANCELLATION_FRAUD_FLAG')) {
            score += 20;
          }
          if (history.note.includes('SUSPICIOUS_COMPLAINT_FLAG')) {
            score += 30;
          }
          if (history.note.includes('SAME_IP_ABUSE_FLAG')) {
            score += 20;
          }
        }
      }
    }
    return score;
  }

  static sanitizeStatusHistoryForProvider(statusHistory) {
    if (!statusHistory) return [];
    return statusHistory.map(h => {
      if (!h.note) return h;
      let cleanNote = h.note
        .replace(/START_PIN:\d{4}/g, 'START_PIN:****')
        .replace(/COMPLETION_PIN:\d{4}/g, 'COMPLETION_PIN:****')
        .replace(/TARGET_LOCATION:[-\d.]+,[-\d.]+/g, 'TARGET_LOCATION:hidden');
      return {
        ...h,
        note: cleanNote
      };
    });
  }
}

module.exports = BookingService;
