const Surge = require('../features/zone/surge-model');

const {
  createSurgeRuleSchema,
  updateSurgeRuleSchema
} = require('../shared/validation/common-validation');

describe('Surge Scheduler & Shared Eligibility Utility', () => {

  // Test 1: Existing surge rule with no date fields
  test('Test 1: Existing surge rule with no date fields is active within time window', () => {
    const rule = {
      active: true,
      startTime: '09:00',
      endTime: '18:00',
      effectiveFrom: null,
      effectiveUntil: null,
      daysOfWeek: []
    };
    const evalContext = { time: '12:00' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(true);
  });

  // Test 2: Festival rule inside date range
  test('Test 2: Festival rule inside date range applies', () => {
    const rule = {
      active: true,
      chargeType: 'festival',
      effectiveFrom: '2026-10-10',
      effectiveUntil: '2026-10-15',
      daysOfWeek: []
    };
    const evalContext = { date: '2026-10-12', time: '14:00' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(true);
    expect(Surge.getRuleStatus(rule, evalContext)).toBe('active');
  });

  // Test 3: Festival rule before effectiveFrom
  test('Test 3: Festival rule before effectiveFrom does not apply', () => {
    const rule = {
      active: true,
      chargeType: 'festival',
      effectiveFrom: '2026-10-10',
      effectiveUntil: '2026-10-15',
      daysOfWeek: []
    };
    const evalContext = { date: '2026-10-09', time: '14:00' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
    expect(Surge.getRuleStatus(rule, evalContext)).toBe('scheduled');
  });

  // Test 4: Festival rule after effectiveUntil
  test('Test 4: Festival rule after effectiveUntil does not apply', () => {
    const rule = {
      active: true,
      chargeType: 'festival',
      effectiveFrom: '2026-10-10',
      effectiveUntil: '2026-10-15',
      daysOfWeek: []
    };
    const evalContext = { date: '2026-10-16', time: '14:00' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
    expect(Surge.getRuleStatus(rule, evalContext)).toBe('expired');
  });

  // Test 5: Time before startTime
  test('Test 5: Time before startTime does not apply', () => {
    const rule = {
      active: true,
      startTime: '18:00',
      endTime: '23:00'
    };
    const evalContext = { time: '17:59' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
  });

  // Test 6: Time after endTime
  test('Test 6: Time after endTime does not apply', () => {
    const rule = {
      active: true,
      startTime: '18:00',
      endTime: '23:00'
    };
    const evalContext = { time: '23:01' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
  });

  // Test 7: Day-of-week matches
  test('Test 7: Day-of-week matches (2026-10-12 is Monday = 1)', () => {
    const rule = {
      active: true,
      effectiveFrom: '2026-10-01',
      effectiveUntil: '2026-10-31',
      daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri
    };
    const evalContext = { date: '2026-10-12' }; // Monday
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(true);
  });

  // Test 8: Day-of-week does not match
  test('Test 8: Day-of-week does not match (2026-10-11 is Sunday = 0)', () => {
    const rule = {
      active: true,
      effectiveFrom: '2026-10-01',
      effectiveUntil: '2026-10-31',
      daysOfWeek: [1, 2, 3, 4, 5] // Mon-Fri only
    };
    const evalContext = { date: '2026-10-11' }; // Sunday
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
  });

  // Test 9, 10, 11: Midnight time window (22:00 -> 05:00)
  test('Test 9: Midnight time window at 22:30 applies', () => {
    expect(Surge.isTimeInWindow('22:30', '22:00', '05:00')).toBe(true);
  });

  test('Test 10: Midnight time window at 03:00 applies', () => {
    expect(Surge.isTimeInWindow('03:00', '22:00', '05:00')).toBe(true);
  });

  test('Test 11: Midnight time window at 12:00 does not apply', () => {
    expect(Surge.isTimeInWindow('12:00', '22:00', '05:00')).toBe(false);
  });

  // Test 14: maxBookingValue constraint
  test('Test 14: maxBookingValue constraint (subtotal > maxBookingValue returns false)', () => {
    const rule = {
      active: true,
      maxBookingValue: 500
    };
    expect(Surge.isRuleApplicable(rule, { subtotal: 450 })).toBe(true);
    expect(Surge.isRuleApplicable(rule, { subtotal: 500 })).toBe(true);
    expect(Surge.isRuleApplicable(rule, { subtotal: 501 })).toBe(false);
  });

  // Test 24: Inactive rule inside valid date/time
  test('Test 24: Inactive rule inside valid date/time does not apply', () => {
    const rule = {
      active: false,
      effectiveFrom: '2026-10-10',
      effectiveUntil: '2026-10-15'
    };
    const evalContext = { date: '2026-10-12', time: '12:00' };
    expect(Surge.isRuleApplicable(rule, evalContext)).toBe(false);
    expect(Surge.getRuleStatus(rule, evalContext)).toBe('inactive');
  });

});

describe('Surge Schema Zod Validation', () => {

  test('Strict YYYY-MM-DD date validation passes valid dates', () => {
    const validData = {
      chargeType: 'festival',
      scope: 'global',
      mode: 'percentage',
      value: 20,
      effectiveFrom: '2026-10-10',
      effectiveUntil: '2026-10-15',
      daysOfWeek: [1, 2, 3]
    };
    const result = createSurgeRuleSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('Strict YYYY-MM-DD date validation rejects invalid date formats', () => {
    const invalidDates = ['2026-2-5', '2026/10/10', '10-10-2026', '2026.10.10'];
    invalidDates.forEach(d => {
      const data = {
        chargeType: 'festival',
        scope: 'global',
        mode: 'percentage',
        value: 20,
        effectiveFrom: d
      };
      const result = createSurgeRuleSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  test('Rejects effectiveUntil before effectiveFrom', () => {
    const data = {
      chargeType: 'festival',
      scope: 'global',
      mode: 'percentage',
      value: 20,
      effectiveFrom: '2026-10-15',
      effectiveUntil: '2026-10-10'
    };
    const result = createSurgeRuleSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  test('Accepts multiplier mode', () => {
    const data = {
      chargeType: 'demand',
      scope: 'global',
      mode: 'multiplier',
      value: 1.5
    };
    const result = createSurgeRuleSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

});
