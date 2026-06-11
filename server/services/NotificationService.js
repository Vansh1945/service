const { sendNotification, notifyAdmins } = require('../utils/notificationHelper');

class NotificationService {
  static async sendToUser(userId, title, message, type = 'system', referenceId = null, url = '/') {
    return sendNotification(userId, 'customer', title, message, type, referenceId, url);
  }

  static async sendToProvider(providerId, title, message, type = 'system', referenceId = null, url = '/') {
    return sendNotification(providerId, 'provider', title, message, type, referenceId, url);
  }

  static async sendToAdmin(adminId, title, message, type = 'system', referenceId = null, url = '/') {
    return sendNotification(adminId, 'admin', title, message, type, referenceId, url);
  }

  static async broadcastToAdmins(title, message, type = 'system', referenceId = null, url = '/') {
    return notifyAdmins(title, message, type, referenceId, url);
  }
}

module.exports = NotificationService;
