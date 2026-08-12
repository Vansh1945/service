const mongoose = require('mongoose');
const User = require('../user/user-model');
const Provider = require('../provider/provider-model');
const Booking = require('../booking/booking-model');
const Transaction = require('../payment/transaction-model');
const PaymentRecord = require('../payment/payment-record-model');
const Refund = require('../payment/refund-model');
const Complaint = require('../complaint/complaint-model');
const Feedback = require('../feedback/feedback-model');
const Service = require('../catalog/service-model');

// Whitelisted Modules
const MODULE_WHITELIST = [
  'providers',
  'users',
  'customers',
  'bookings',
  'payments',
  'transactions',
  'withdrawals',
  'payouts',
  'refunds',
  'complaints',
  'feedback',
  'services'
];

// Whitelisted Sort Fields per module
const SORT_WHITELIST = {
  providers: ['createdAt', 'updatedAt', 'name', 'experience', 'performanceScore.rating', 'registrationDate'],
  users: ['createdAt', 'updatedAt', 'name', 'totalBookings'],
  customers: ['createdAt', 'updatedAt', 'name', 'totalBookings'],
  bookings: ['createdAt', 'date', 'updatedAt', 'totalAmount', 'status'],
  payments: ['createdAt', 'updatedAt', 'amount', 'paymentStatus'],
  transactions: ['createdAt', 'updatedAt', 'amount', 'paymentStatus'],
  withdrawals: ['createdAt', 'updatedAt', 'amount', 'status'],
  payouts: ['createdAt', 'updatedAt', 'amount', 'status'],
  refunds: ['createdAt', 'updatedAt', 'refundAmount', 'status'],
  complaints: ['createdAt', 'updatedAt', 'status', 'title'],
  feedback: ['createdAt', 'updatedAt', 'providerFeedback.rating', 'serviceFeedback.rating'],
  services: ['createdAt', 'updatedAt', 'title', 'basePrice', 'duration']
};

/**
 * Escapes characters with special regex meaning to prevent ReDoS / injection
 */
const escapeRegex = (string) => {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
};

/**
 * Masks sensitive account numbers (e.g., "123456789012" -> "XXXX XXXX 9012")
 */
const maskAccountNumber = (accNo) => {
  if (!accNo || typeof accNo !== 'string') return accNo;
  const clean = accNo.replace(/\s+/g, '');
  if (clean.length <= 4) return clean;
  const visible = clean.slice(-4);
  return `XXXX XXXX ${visible}`;
};

class AdminSearchService {
  /**
   * Universal Search & Filter Engine
   */
  static async search({
    module,
    search = '',
    filters = {},
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  }) {
    const cleanModule = (module || '').toLowerCase().trim();
    if (!MODULE_WHITELIST.includes(cleanModule)) {
      throw new Error(`Invalid search module: "${module}". Allowed modules: ${MODULE_WHITELIST.join(', ')}`);
    }

    // Pagination safety
    const safePage = Math.max(1, parseInt(page, 10) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (safePage - 1) * safeLimit;

    // Search query safety (max 100 chars)
    const sanitizedSearch = typeof search === 'string' ? search.slice(0, 100).trim() : '';

    // Sort safety
    const allowedSorts = SORT_WHITELIST[cleanModule] || ['createdAt'];
    const safeSortField = allowedSorts.includes(sortBy) ? sortBy : 'createdAt';
    const safeSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 1 : -1;
    const sortStage = { [safeSortField]: safeSortOrder };

    switch (cleanModule) {
      case 'providers':
        return await this.searchProviders({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'users':
      case 'customers':
        return await this.searchUsers({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'bookings':
        return await this.searchBookings({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'payments':
      case 'transactions':
        return await this.searchTransactions({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'withdrawals':
      case 'payouts':
        return await this.searchWithdrawals({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'refunds':
        return await this.searchRefunds({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'complaints':
        return await this.searchComplaints({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'feedback':
        return await this.searchFeedback({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      case 'services':
        return await this.searchServices({ search: sanitizedSearch, filters, page: safePage, limit: safeLimit, skip, sortStage });
      default:
        throw new Error(`Module ${cleanModule} handler not implemented`);
    }
  }

  /**
   * Search Providers
   */
  static async searchProviders({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [{ isDeleted: false }];

    // Universal multi-field search (OR)
    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const orClauses = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { providerId: regex },
        { referralCode: regex },
        { serviceArea: regex },
        { 'address.street': regex },
        { 'address.city': regex },
        { 'address.state': regex },
        { 'address.postalCode': regex },
        { 'address.pincode': regex },
        { 'address.area': regex },
        { 'address.landmark': regex },
        { 'address.road': regex },
        { 'address.houseNumber': regex },
        { 'address.addressLine': regex },
        { 'address.formattedAddress': regex },
        { 'currentAddress.street': regex },
        { 'currentAddress.villageCity': regex },
        { 'currentAddress.district': regex },
        { 'currentAddress.state': regex },
        { 'currentAddress.pincode': regex },
        { 'currentAddress.landmark': regex },
        { 'currentAddress.houseNumber': regex },
        { 'permanentAddress.street': regex },
        { 'permanentAddress.villageCity': regex },
        { 'permanentAddress.district': regex },
        { 'permanentAddress.state': regex },
        { 'permanentAddress.pincode': regex },
        { 'permanentAddress.landmark': regex },
        { 'permanentAddress.houseNumber': regex },
        { 'bankDetails.bankName': regex },
        { 'bankDetails.accountName': regex },
        { 'bankDetails.city': regex },
        { 'bankDetails.district': regex },
        { 'bankDetails.ifsc': regex },
        { 'bankDetails.upiId': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      matchConditions.push({ $or: orClauses });
    }

    // Advanced Filters (AND)
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'approved') matchConditions.push({ approved: true });
      else if (filters.status === 'pending') matchConditions.push({ approved: false, kycStatus: { $ne: 'rejected' } });
      else if (filters.status === 'rejected') matchConditions.push({ kycStatus: 'rejected' });
      else if (filters.status === 'active') matchConditions.push({ isActive: true });
      else if (filters.status === 'inactive') matchConditions.push({ isActive: false });
      else if (filters.status === 'suspended') matchConditions.push({ isSuspended: true });
      else if (filters.status === 'blocked') matchConditions.push({ blockedTill: { $gt: new Date() } });
    }

    if (filters.kycStatus && filters.kycStatus !== 'all') {
      matchConditions.push({ kycStatus: filters.kycStatus });
    }

    if (filters.bankVerificationStatus && filters.bankVerificationStatus !== 'all') {
      matchConditions.push({ 'bankDetails.bankVerificationStatus': filters.bankVerificationStatus });
    }

    if (filters.isOnline !== undefined && filters.isOnline !== 'all' && filters.isOnline !== '') {
      matchConditions.push({ isOnline: filters.isOnline === true || filters.isOnline === 'true' });
    }

    if (filters.service && filters.service !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.service)) {
        matchConditions.push({ services: new mongoose.Types.ObjectId(filters.service) });
      }
    }

    const targetZoneIds = filters.zoneIds || filters.zoneId;
    if (targetZoneIds) {
      const ids = (Array.isArray(targetZoneIds) ? targetZoneIds : String(targetZoneIds).split(',').filter(Boolean))
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));
      if (ids.length > 0) {
        matchConditions.push({ currentZone: { $in: ids } });
      }
    }

    if (filters.city) {
      const cityRegex = { $regex: escapeRegex(filters.city), $options: 'i' };
      matchConditions.push({
        $or: [
          { 'address.city': cityRegex },
          { 'currentAddress.villageCity': cityRegex },
          { 'permanentAddress.villageCity': cityRegex }
        ]
      });
    }

    if (filters.state) {
      const stateRegex = { $regex: escapeRegex(filters.state), $options: 'i' };
      matchConditions.push({
        $or: [
          { 'address.state': stateRegex },
          { 'currentAddress.state': stateRegex },
          { 'permanentAddress.state': stateRegex }
        ]
      });
    }

    if (filters.pincode) {
      const pinRegex = { $regex: escapeRegex(filters.pincode), $options: 'i' };
      matchConditions.push({
        $or: [
          { 'address.postalCode': pinRegex },
          { 'address.pincode': pinRegex },
          { 'currentAddress.pincode': pinRegex },
          { 'permanentAddress.pincode': pinRegex }
        ]
      });
    }

    if (filters.zoneId) {
      if (mongoose.Types.ObjectId.isValid(filters.zoneId)) {
        matchConditions.push({ currentZone: new mongoose.Types.ObjectId(filters.zoneId) });
      }
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const finalMatch = matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0];

    const pipeline = [
      { $match: finalMatch },
      {
        $lookup: {
          from: 'categories',
          localField: 'services',
          foreignField: '_id',
          as: 'serviceCategories'
        }
      },
      {
        $lookup: {
          from: 'feedbacks',
          localField: '_id',
          foreignField: 'providerFeedback.provider',
          as: 'feedback'
        }
      },
      {
        $addFields: {
          averageRating: { $ifNull: [{ $avg: '$feedback.providerFeedback.rating' }, '$performanceScore.rating', 0] },
          serviceNames: {
            $map: {
              input: '$serviceCategories',
              as: 'cat',
              in: '$$cat.name'
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          refreshTokens: 0,
          deviceIds: 0,
          loginHistory: 0,
          aadhaarFront: 0,
          aadhaarBack: 0,
          panCard: 0,
          __v: 0,
          feedback: 0
        }
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    ];

    const [results, total] = await Promise.all([
      Provider.aggregate(pipeline),
      Provider.countDocuments(finalMatch)
    ]);

    // Mask bank account numbers
    const sanitizedResults = results.map(item => {
      if (item.bankDetails && item.bankDetails.accountNo) {
        item.bankDetails.accountNo = maskAccountNumber(item.bankDetails.accountNo);
      }
      return item;
    });

    return {
      module: 'providers',
      data: sanitizedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Users / Customers
   */
  static async searchUsers({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [{ role: 'customer' }];

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const orClauses = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { referralCode: regex },
        { 'address.street': regex },
        { 'address.city': regex },
        { 'address.state': regex },
        { 'address.postalCode': regex },
        { 'address.pincode': regex },
        { 'address.area': regex },
        { 'address.landmark': regex },
        { 'address.road': regex },
        { 'address.houseNumber': regex },
        { 'address.addressLine': regex },
        { 'address.formattedAddress': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        orClauses.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      matchConditions.push({ $or: orClauses });
    }

    if (filters.isSuspended !== undefined && filters.isSuspended !== 'all' && filters.isSuspended !== '') {
      matchConditions.push({ isSuspended: filters.isSuspended === true || filters.isSuspended === 'true' });
    }

    if (filters.city) {
      matchConditions.push({ 'address.city': { $regex: escapeRegex(filters.city), $options: 'i' } });
    }

    if (filters.state) {
      matchConditions.push({ 'address.state': { $regex: escapeRegex(filters.state), $options: 'i' } });
    }

    if (filters.pincode) {
      const pinRegex = { $regex: escapeRegex(filters.pincode), $options: 'i' };
      matchConditions.push({
        $or: [{ 'address.postalCode': pinRegex }, { 'address.pincode': pinRegex }]
      });
    }

    if (filters.currentZone) {
      if (mongoose.Types.ObjectId.isValid(filters.currentZone)) {
        matchConditions.push({ currentZone: new mongoose.Types.ObjectId(filters.currentZone) });
      }
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const finalMatch = matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0];

    const pipeline = [
      { $match: finalMatch },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'customer',
          as: 'userBookings'
        }
      },
      {
        $addFields: {
          totalBookingsCount: { $size: '$userBookings' },
          totalSpent: { $sum: '$userBookings.totalAmount' }
        }
      },
      {
        $project: {
          password: 0,
          refreshTokens: 0,
          deviceIds: 0,
          loginHistory: 0,
          userBookings: 0,
          __v: 0
        }
      },
      { $sort: sortStage },
      { $skip: skip },
      { $limit: limit }
    ];

    const [results, total] = await Promise.all([
      User.aggregate(pipeline),
      User.countDocuments(finalMatch)
    ]);

    return {
      module: 'users',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Bookings
   */
  static async searchBookings({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    // Filter stage before lookup
    if (filters.status && filters.status !== 'all') {
      const statuses = filters.status.split(',').map(s => s.trim());
      matchConditions.push({ status: { $in: statuses } });
    }

    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      const statuses = filters.paymentStatus.split(',').map(s => s.trim());
      matchConditions.push({ paymentStatus: { $in: statuses } });
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      matchConditions.push({ paymentMethod: filters.paymentMethod });
    }

    if (filters.bookingType && filters.bookingType !== 'all') {
      matchConditions.push({ bookingType: filters.bookingType });
    }

    const targetZoneIds = filters.zoneIds || filters.zoneId;
    if (targetZoneIds) {
      const ids = (Array.isArray(targetZoneIds) ? targetZoneIds : String(targetZoneIds).split(',').filter(Boolean))
                    .filter(id => mongoose.Types.ObjectId.isValid(id))
                    .map(id => new mongoose.Types.ObjectId(id));
      if (ids.length > 0) {
        matchConditions.push({ zoneId: { $in: ids } });
      }
    }

    if (filters.city) {
      matchConditions.push({ 'address.city': { $regex: escapeRegex(filters.city), $options: 'i' } });
    }

    if (filters.state) {
      matchConditions.push({ 'address.state': { $regex: escapeRegex(filters.state), $options: 'i' } });
    }

    if (filters.pincode) {
      const pinRegex = { $regex: escapeRegex(filters.pincode), $options: 'i' };
      matchConditions.push({
        $or: [{ 'address.postalCode': pinRegex }, { 'address.pincode': pinRegex }]
      });
    }

    if (filters.hasComplaint !== undefined && filters.hasComplaint !== 'all' && filters.hasComplaint !== '') {
      matchConditions.push({ hasComplaint: filters.hasComplaint === true || filters.hasComplaint === 'true' });
    }

    if (filters.disputeRaised !== undefined && filters.disputeRaised !== 'all' && filters.disputeRaised !== '') {
      matchConditions.push({ disputeRaised: filters.disputeRaised === true || filters.disputeRaised === 'true' });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ date: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    // Lookups
    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'services.service',
          foreignField: '_id',
          as: 'serviceDetails'
        }
      }
    );

    // Search filter across booking and related fields
    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { bookingId: regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'customer.phone': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'provider.phone': regex },
        { 'provider.providerId': regex },
        { 'serviceDetails.title': regex },
        { 'address.street': regex },
        { 'address.city': regex },
        { 'address.state': regex },
        { 'address.postalCode': regex },
        { 'address.pincode': regex },
        { 'address.area': regex },
        { 'address.landmark': regex },
        { 'address.formattedAddress': regex },
        { refundReference: regex },
        { 'cancellationProgress.refundTransactionId': regex },
        { notes: regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'customer.password': 0,
          'customer.refreshTokens': 0,
          'provider.password': 0,
          'provider.refreshTokens': 0,
          'provider.aadhaarFront': 0,
          'provider.aadhaarBack': 0,
          'provider.panCard': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    // Facet for pagination & count
    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Booking.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'bookings',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Payments / Transactions
   */
  static async searchTransactions({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.paymentStatus && filters.paymentStatus !== 'all') {
      matchConditions.push({ paymentStatus: filters.paymentStatus });
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      matchConditions.push({ paymentMethod: filters.paymentMethod });
    }

    if (filters.type && filters.type !== 'all') {
      matchConditions.push({ type: filters.type });
    }

    if (filters.ledgerType && filters.ledgerType !== 'all') {
      matchConditions.push({ ledgerType: filters.ledgerType });
    }

    if (filters.settlementStatus && filters.settlementStatus !== 'all') {
      matchConditions.push({ settlementStatus: filters.settlementStatus });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'bookingDetails'
        }
      },
      { $unwind: { path: '$bookingDetails', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { transactionId: regex },
        { bookingId: regex },
        { razorpayOrderId: regex },
        { razorpayPaymentId: regex },
        { razorpayPayoutId: regex },
        { razorpaySettlementId: regex },
        { bankReference: regex },
        { description: regex },
        { 'user.name': regex },
        { 'user.email': regex },
        { 'user.phone': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'provider.phone': regex },
        { 'provider.providerId': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'user.password': 0,
          'provider.password': 0,
          'provider.aadhaarFront': 0,
          'provider.aadhaarBack': 0,
          'provider.panCard': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Transaction.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'payments',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Withdrawals / Payouts
   */
  static async searchWithdrawals({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.status && filters.status !== 'all') {
      matchConditions.push({ status: filters.status });
    }

    if (filters.paymentMethod && filters.paymentMethod !== 'all') {
      matchConditions.push({ paymentMethod: filters.paymentMethod });
    }

    if (filters.withdrawalType && filters.withdrawalType !== 'all') {
      matchConditions.push({ withdrawalType: filters.withdrawalType });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'admins',
          localField: 'admin',
          foreignField: '_id',
          as: 'admin'
        }
      },
      { $unwind: { path: '$admin', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { transactionReference: regex },
        { utrNo: regex },
        { razorpayPayoutId: regex },
        { 'paymentDetails.accountNumber': regex },
        { 'paymentDetails.accountName': regex },
        { 'paymentDetails.ifscCode': regex },
        { 'paymentDetails.upiId': regex },
        { 'paymentDetails.bankName': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'provider.phone': regex },
        { 'provider.providerId': regex },
        { adminRemark: regex },
        { rejectionReason: regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'provider.password': 0,
          'provider.aadhaarFront': 0,
          'provider.aadhaarBack': 0,
          'provider.panCard': 0,
          'admin.password': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await PaymentRecord.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    // Mask account number
    const sanitizedResults = results.map(item => {
      if (item.paymentDetails && item.paymentDetails.accountNumber) {
        item.paymentDetails.accountNumber = maskAccountNumber(item.paymentDetails.accountNumber);
      }
      return item;
    });

    return {
      module: 'withdrawals',
      data: sanitizedResults,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Refunds
   */
  static async searchRefunds({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.status && filters.status !== 'all') {
      matchConditions.push({ status: filters.status });
    }

    if (filters.refundDestination && filters.refundDestination !== 'all') {
      matchConditions.push({ refundDestination: filters.refundDestination });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'customerId',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providers',
          localField: 'providerId',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { refundId: regex },
        { originalPaymentId: regex },
        { gatewayOrderId: regex },
        { gatewayPaymentId: regex },
        { gatewayRefundId: regex },
        { walletTransactionId: regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'customer.phone': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'booking.bookingId': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'customer.password': 0,
          'provider.password': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Refund.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'refunds',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Complaints
   */
  static async searchComplaints({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.status && filters.status !== 'all') {
      matchConditions.push({ status: filters.status });
    }

    if (filters.category && filters.category !== 'all') {
      matchConditions.push({ category: filters.category });
    }

    if (filters.userType && filters.userType !== 'all') {
      matchConditions.push({ userType: filters.userType });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providers',
          localField: 'provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { complaintId: regex },
        { title: regex },
        { description: regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'customer.phone': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'provider.phone': regex },
        { 'booking.bookingId': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'customer.password': 0,
          'provider.password': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Complaint.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'complaints',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Feedback
   */
  static async searchFeedback({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.rating && filters.rating !== 'all') {
      const r = parseFloat(filters.rating);
      if (!isNaN(r)) {
        matchConditions.push({
          $or: [
            { 'providerFeedback.rating': r },
            { 'serviceFeedback.rating': r }
          ]
        });
      }
    }

    if (filters.isApproved !== undefined && filters.isApproved !== 'all' && filters.isApproved !== '') {
      matchConditions.push({ 'serviceFeedback.isApproved': filters.isApproved === true || filters.isApproved === 'true' });
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providers',
          localField: 'providerFeedback.provider',
          foreignField: '_id',
          as: 'provider'
        }
      },
      { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceFeedback.service',
          foreignField: '_id',
          as: 'service'
        }
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking'
        }
      },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { 'providerFeedback.comment': regex },
        { 'serviceFeedback.comment': regex },
        { 'customer.name': regex },
        { 'customer.email': regex },
        { 'provider.name': regex },
        { 'provider.email': regex },
        { 'service.title': regex },
        { 'booking.bookingId': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      {
        $project: {
          'customer.password': 0,
          'provider.password': 0,
          __v: 0
        }
      },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Feedback.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'feedback',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Search Services
   */
  static async searchServices({ search, filters, page, limit, skip, sortStage }) {
    const matchConditions = [];

    if (filters.isActive !== undefined && filters.isActive !== 'all' && filters.isActive !== '') {
      matchConditions.push({ isActive: filters.isActive === true || filters.isActive === 'true' });
    }

    if (filters.category && filters.category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(filters.category)) {
        matchConditions.push({ category: new mongoose.Types.ObjectId(filters.category) });
      }
    }

    if (filters.startDate || filters.endDate) {
      const dateCond = {};
      if (filters.startDate) dateCond.$gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateCond.$lte = end;
      }
      matchConditions.push({ createdAt: dateCond });
    }

    const preMatch = matchConditions.length > 0 ? (matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]) : {};

    const pipeline = [];
    if (Object.keys(preMatch).length > 0) {
      pipeline.push({ $match: preMatch });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'categories',
          localField: 'category',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } }
    );

    if (search) {
      const escaped = escapeRegex(search);
      const regex = { $regex: escaped, $options: 'i' };

      const searchOr = [
        { title: regex },
        { description: regex },
        { specialNotes: regex },
        { serviceIncludes: regex },
        { serviceExcludes: regex },
        { 'category.name': regex }
      ];

      if (mongoose.Types.ObjectId.isValid(search)) {
        searchOr.push({ _id: new mongoose.Types.ObjectId(search) });
      }

      pipeline.push({ $match: { $or: searchOr } });
    }

    pipeline.push(
      { $project: { __v: 0, feedback: 0 } },
      { $sort: sortStage }
    );

    const facetPipeline = [
      ...pipeline,
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];

    const [facetResult] = await Service.aggregate(facetPipeline);
    const results = facetResult?.data || [];
    const total = facetResult?.totalCount?.[0]?.count || 0;

    return {
      module: 'services',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Global Cross-Module Search across ALL Admin entities
   */
  static async searchGlobal({ search = '', limitPerType = 5 }) {
    const rawSearch = typeof search === 'string' ? search.trim() : '';
    if (!rawSearch || rawSearch.length < 2) {
      // If it's a known short ID prefix with numbers, allow searching
      const isKnownId = /^(bk|pay|txn|prov|comp|cp|ref|wd|set|inv)[-_]/i.test(rawSearch);
      if (!isKnownId) {
        return {
          success: true,
          query: rawSearch,
          results: {
            users: [],
            providers: [],
            bookings: [],
            payments: [],
            withdrawals: [],
            refunds: [],
            complaints: [],
            feedback: [],
            services: []
          },
          total: 0
        };
      }
    }

    const cleanLimit = Math.max(1, Math.min(parseInt(limitPerType, 10) || 5, 20));
    const escaped = escapeRegex(rawSearch);
    const regex = { $regex: escaped, $options: 'i' };
    const searchLower = rawSearch.toLowerCase();

    // Helper to compute relevance score
    const scoreItem = (primaryText, secondaryText, idText) => {
      let score = 0;
      const p = (primaryText || '').toLowerCase();
      const s = (secondaryText || '').toLowerCase();
      const id = (idText || '').toLowerCase();

      if (id && (id === searchLower || id.includes(searchLower))) score += 100;
      if (p === searchLower) score += 80;
      else if (p.startsWith(searchLower)) score += 60;
      else if (p.includes(searchLower)) score += 40;

      if (s === searchLower) score += 70;
      else if (s.startsWith(searchLower)) score += 50;
      else if (s.includes(searchLower)) score += 30;

      return score;
    };

    // Parallel searches across all 9 entities
    const [
      usersResult,
      providersResult,
      bookingsResult,
      paymentsResult,
      withdrawalsResult,
      refundsResult,
      complaintsResult,
      feedbackResult,
      servicesResult
    ] = await Promise.allSettled([
      // 1. USERS
      (async () => {
        const userOr = [
          { name: regex },
          { email: regex },
          { phone: regex },
          { referralCode: regex },
          { 'address.city': regex },
          { 'address.state': regex },
          { 'address.postalCode': regex },
          { 'address.street': regex }
        ];
        if (mongoose.Types.ObjectId.isValid(rawSearch)) {
          userOr.push({ _id: new mongoose.Types.ObjectId(rawSearch) });
        }
        const docs = await User.find({ $or: userOr })
          .select('_id name email phone isSuspended totalBookings role createdAt')
          .limit(cleanLimit * 2)
          .lean();

        return docs.map(d => ({
          _id: d._id,
          id: d._id,
          name: d.name || 'Unnamed User',
          email: d.email || '',
          phone: d.phone || '',
          isSuspended: d.isSuspended || false,
          role: d.role || 'customer',
          entityType: 'user',
          route: `/admin/customers?search=${encodeURIComponent(d.email || d.phone || d.name)}&openDetail=true`,
          relevance: scoreItem(d.name, d.email, d._id.toString())
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 2. PROVIDERS
      (async () => {
        const provOr = [
          { name: regex },
          { email: regex },
          { phone: regex },
          { providerId: regex },
          { referralCode: regex },
          { serviceArea: regex },
          { services: regex },
          { 'address.city': regex },
          { 'address.state': regex },
          { 'address.postalCode': regex },
          { 'currentAddress.city': regex },
          { 'currentAddress.state': regex },
          { 'bankDetails.bankName': regex }
        ];
        if (mongoose.Types.ObjectId.isValid(rawSearch)) {
          provOr.push({ _id: new mongoose.Types.ObjectId(rawSearch) });
        }
        const docs = await Provider.find({ $or: provOr })
          .select('_id providerId name email phone approved kycStatus isActive services averageRating createdAt')
          .limit(cleanLimit * 2)
          .lean();

        return docs.map(d => ({
          _id: d._id,
          id: d.providerId || d._id,
          name: d.name || 'Unnamed Provider',
          email: d.email || '',
          phone: d.phone || '',
          providerId: d.providerId || '',
          approved: d.approved || false,
          kycStatus: d.kycStatus || 'pending',
          isActive: d.isActive || false,
          services: d.services || [],
          averageRating: d.averageRating || 0,
          entityType: 'provider',
          route: d.approved
            ? `/admin/approve-providers?search=${encodeURIComponent(d.providerId || d.phone || d.email || d.name)}&openDetail=true`
            : `/admin/providers?search=${encodeURIComponent(d.providerId || d.phone || d.email || d.name)}&openDetail=true`,
          relevance: scoreItem(d.name, d.providerId, d.providerId)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 3. BOOKINGS
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'customer',
              foreignField: '_id',
              as: 'customer'
            }
          },
          { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'providers',
              localField: 'provider',
              foreignField: '_id',
              as: 'provider'
            }
          },
          { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { bookingId: regex },
                { refundReference: regex },
                { 'serviceDetails.title': regex },
                { 'customer.name': regex },
                { 'customer.email': regex },
                { 'customer.phone': regex },
                { 'provider.name': regex },
                { 'provider.email': regex },
                { 'provider.phone': regex },
                { 'provider.providerId': regex },
                { 'address.city': regex },
                { 'address.state': regex },
                { 'address.postalCode': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              bookingId: 1,
              status: 1,
              paymentStatus: 1,
              totalAmount: 1,
              date: 1,
              'customer.name': 1,
              'customer.email': 1,
              'customer.phone': 1,
              'provider.name': 1,
              'provider.providerId': 1,
              'serviceDetails.title': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await Booking.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d.bookingId || d._id,
          bookingId: d.bookingId,
          status: d.status,
          paymentStatus: d.paymentStatus,
          totalAmount: d.totalAmount || 0,
          customerName: d.customer?.name || '',
          providerName: d.provider?.name || '',
          serviceTitle: d.serviceDetails?.title || '',
          entityType: 'booking',
          route: `/admin/bookings?search=${encodeURIComponent(d.bookingId || d._id)}&openDetail=true`,
          relevance: scoreItem(d.bookingId, d.customer?.name, d.bookingId)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 4. PAYMENTS / TRANSACTIONS
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'user'
            }
          },
          { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'providers',
              localField: 'provider',
              foreignField: '_id',
              as: 'provider'
            }
          },
          { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { transactionId: regex },
                { bookingId: regex },
                { razorpayOrderId: regex },
                { razorpayPaymentId: regex },
                { bankReference: regex },
                { 'user.name': regex },
                { 'user.email': regex },
                { 'provider.name': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              transactionId: 1,
              bookingId: 1,
              razorpayPaymentId: 1,
              amount: 1,
              paymentStatus: 1,
              paymentMethod: 1,
              createdAt: 1,
              'user.name': 1,
              'provider.name': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await Transaction.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d.transactionId || d.razorpayPaymentId || d._id,
          transactionId: d.transactionId,
          bookingId: d.bookingId,
          amount: d.amount || 0,
          paymentStatus: d.paymentStatus || 'completed',
          paymentMethod: d.paymentMethod || 'online',
          customerName: d.user?.name || '',
          providerName: d.provider?.name || '',
          entityType: 'payment',
          route: `/admin/transactions?search=${encodeURIComponent(d.transactionId || d.bookingId || d._id)}&openDetail=true`,
          relevance: scoreItem(d.transactionId, d.razorpayPaymentId, d.transactionId)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 5. WITHDRAWALS / PAYOUTS
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'providers',
              localField: 'provider',
              foreignField: '_id',
              as: 'provider'
            }
          },
          { $unwind: { path: '$provider', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { transactionReference: regex },
                { utrNo: regex },
                { razorpayPayoutId: regex },
                { 'provider.name': regex },
                { 'provider.email': regex },
                { 'provider.phone': regex },
                { 'provider.providerId': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              amount: 1,
              status: 1,
              paymentMethod: 1,
              utrNo: 1,
              transactionReference: 1,
              createdAt: 1,
              'provider.name': 1,
              'provider.providerId': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await PaymentRecord.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d.utrNo || d.transactionReference || d._id,
          amount: d.amount || 0,
          status: d.status || 'requested',
          utrNo: d.utrNo || '',
          providerName: d.provider?.name || '',
          providerId: d.provider?.providerId || '',
          entityType: 'withdrawal',
          route: `/admin/payout?search=${encodeURIComponent(d.utrNo || d.provider?.name || d._id)}&openDetail=true`,
          relevance: scoreItem(d.provider?.name, d.utrNo, d.utrNo)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 6. REFUNDS
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'customerId',
              foreignField: '_id',
              as: 'customer'
            }
          },
          { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'bookings',
              localField: 'bookingId',
              foreignField: '_id',
              as: 'booking'
            }
          },
          { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { refundId: regex },
                { originalPaymentId: regex },
                { gatewayRefundId: regex },
                { 'customer.name': regex },
                { 'customer.email': regex },
                { 'booking.bookingId': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              refundId: 1,
              refundAmount: 1,
              status: 1,
              refundReason: 1,
              createdAt: 1,
              'customer.name': 1,
              'booking.bookingId': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await Refund.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d.refundId || d._id,
          refundId: d.refundId,
          refundAmount: d.refundAmount || 0,
          status: d.status,
          customerName: d.customer?.name || '',
          bookingId: d.booking?.bookingId || '',
          entityType: 'refund',
          route: `/admin/refunds?search=${encodeURIComponent(d.refundId || d.booking?.bookingId || d._id)}&openDetail=true`,
          relevance: scoreItem(d.refundId, d.customer?.name, d.refundId)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 7. COMPLAINTS
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'customer',
              foreignField: '_id',
              as: 'customer'
            }
          },
          { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'bookings',
              localField: 'booking',
              foreignField: '_id',
              as: 'booking'
            }
          },
          { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { complaintId: regex },
                { title: regex },
                { description: regex },
                { 'customer.name': regex },
                { 'customer.email': regex },
                { 'booking.bookingId': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              complaintId: 1,
              title: 1,
              status: 1,
              priority: 1,
              createdAt: 1,
              'customer.name': 1,
              'booking.bookingId': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await Complaint.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d.complaintId || d._id,
          complaintId: d.complaintId,
          title: d.title || 'Complaint',
          status: d.status,
          priority: d.priority,
          customerName: d.customer?.name || '',
          bookingId: d.booking?.bookingId || '',
          entityType: 'complaint',
          route: `/admin/complaints?search=${encodeURIComponent(d.complaintId || d.booking?.bookingId || d._id)}&openDetail=true`,
          relevance: scoreItem(d.complaintId, d.title, d.complaintId)
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 8. FEEDBACK
      (async () => {
        const pipeline = [
          {
            $lookup: {
              from: 'users',
              localField: 'customer',
              foreignField: '_id',
              as: 'customer'
            }
          },
          { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
          {
            $match: {
              $or: [
                { 'providerFeedback.comment': regex },
                { 'serviceFeedback.comment': regex },
                { 'customer.name': regex }
              ]
            }
          },
          {
            $project: {
              _id: 1,
              'providerFeedback.comment': 1,
              'providerFeedback.rating': 1,
              'serviceFeedback.comment': 1,
              'serviceFeedback.rating': 1,
              createdAt: 1,
              'customer.name': 1
            }
          },
          { $limit: cleanLimit * 2 }
        ];
        const docs = await Feedback.aggregate(pipeline);
        return docs.map(d => ({
          _id: d._id,
          id: d._id,
          comment: d.serviceFeedback?.comment || d.providerFeedback?.comment || 'Feedback',
          rating: d.serviceFeedback?.rating || d.providerFeedback?.rating || 5,
          customerName: d.customer?.name || '',
          entityType: 'feedback',
          route: `/admin/feedback?search=${encodeURIComponent(d.customer?.name || '')}`,
          relevance: scoreItem(d.customer?.name, d.serviceFeedback?.comment, '')
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })(),

      // 9. SERVICES
      (async () => {
        const servOr = [
          { title: regex },
          { description: regex },
          { specialNotes: regex }
        ];
        if (mongoose.Types.ObjectId.isValid(rawSearch)) {
          servOr.push({ _id: new mongoose.Types.ObjectId(rawSearch) });
        }
        const docs = await Service.find({ $or: servOr })
          .select('_id title basePrice duration isActive averageRating')
          .limit(cleanLimit * 2)
          .lean();

        return docs.map(d => ({
          _id: d._id,
          id: d._id,
          title: d.title || 'Unnamed Service',
          basePrice: d.basePrice || 0,
          duration: d.duration || '',
          isActive: d.isActive !== false,
          averageRating: d.averageRating || 0,
          entityType: 'service',
          route: `/admin/services?search=${encodeURIComponent(d.title)}`,
          relevance: scoreItem(d.title, d.description, '')
        })).sort((a, b) => b.relevance - a.relevance).slice(0, cleanLimit);
      })()
    ]);

    const results = {
      users: usersResult.status === 'fulfilled' ? usersResult.value : [],
      providers: providersResult.status === 'fulfilled' ? providersResult.value : [],
      bookings: bookingsResult.status === 'fulfilled' ? bookingsResult.value : [],
      payments: paymentsResult.status === 'fulfilled' ? paymentsResult.value : [],
      withdrawals: withdrawalsResult.status === 'fulfilled' ? withdrawalsResult.value : [],
      refunds: refundsResult.status === 'fulfilled' ? refundsResult.value : [],
      complaints: complaintsResult.status === 'fulfilled' ? complaintsResult.value : [],
      feedback: feedbackResult.status === 'fulfilled' ? feedbackResult.value : [],
      services: servicesResult.status === 'fulfilled' ? servicesResult.value : []
    };

    const total = Object.values(results).reduce((acc, curr) => acc + (curr ? curr.length : 0), 0);

    return {
      success: true,
      query: rawSearch,
      results,
      total
    };
  }
}

module.exports = AdminSearchService;
