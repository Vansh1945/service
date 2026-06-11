const CommissionRule = require('../models/CommissionRule-model');

class CommissionService {
  static async getProviderCommissionRule(providerId, serviceId) {
    return await CommissionRule.getCommissionForProvider(providerId, serviceId);
  }

  static calculate(rule, amount) {
    if (!rule) {
      return { commission: 0, netAmount: amount };
    }
    return CommissionRule.calculateCommission(rule, amount);
  }
}

module.exports = CommissionService;
