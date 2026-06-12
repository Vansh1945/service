/**
 * Calculates surcharge amount for a given base/subtotal and surcharge rule
 * @param {number} baseAmount 
 * @param {object} surchargeRule 
 * @returns {number}
 */
export const calculateSurchargeAmount = (baseAmount, surchargeRule) => {
  if (!baseAmount || !surchargeRule) return 0;
  if (surchargeRule.maxBookingValue && baseAmount > surchargeRule.maxBookingValue) {
    return 0;
  }
  let chargeAmount = 0;
  if (surchargeRule.mode === 'flat') {
    chargeAmount = surchargeRule.value;
  } else if (surchargeRule.mode === 'percentage') {
    chargeAmount = (baseAmount * surchargeRule.value) / 100;
  } else if (surchargeRule.mode === 'multiplier') {
    chargeAmount = baseAmount * (surchargeRule.value - 1);
  }
  return parseFloat(chargeAmount.toFixed(2));
};

/**
 * Calculates merged service price (base/discount price + active demand surges)
 * @param {number} basePrice 
 * @param {array} activeSurcharges 
 * @returns {number}
 */
export const getMergedPrice = (basePrice, activeSurcharges = []) => {
  if (!basePrice) return 0;
  let demandSurge = 0;
  activeSurcharges.forEach(s => {
    if (s.chargeType === 'demand') {
      demandSurge += calculateSurchargeAmount(basePrice, s);
    }
  });
  return basePrice + demandSurge;
};
