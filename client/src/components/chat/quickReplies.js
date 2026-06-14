/**
 * Predefined quick reply messages based on user roles and booking statuses
 * Used in ChatModal to show quick action message chips.
 */

export const getQuickReplies = (role, status = 'pending') => {
  const normRole = (role || '').toLowerCase();
  const normStatus = (status || 'pending').toLowerCase();

  // Admin / Support Quick Replies
  if (normRole === 'admin' || normRole === 'support' || normRole === 'admin_support') {
    return [
      'We are looking into this issue.',
      'Please upload clear proof or screenshots.',
      'The dispute is currently under review.',
      'Refund has been initiated to your wallet.',
      'This support ticket has been resolved and closed.'
    ];
  }

  // Customer Quick Replies
  if (normRole === 'customer') {
    if (normStatus === 'completed') {
      return ['Call me', 'Thanks for the service', 'Please check the issue'];
    }
    if (normStatus === 'pending') {
      return ['Call me', 'Please accept the booking', 'Is this date available?'];
    }
    return ['Gate open', 'Call me', 'Reached home', 'Please come fast'];
  }

  // Provider Quick Replies
  if (normRole === 'provider') {
    if (normStatus === 'completed') {
      return ['Need response', 'Thank you', 'Work completed'];
    }
    if (normStatus === 'pending') {
      return ['Need response', 'I can accept this booking', 'Let me check availability'];
    }
    
    const defaultList = ['Arriving in 10 min', 'Reached location', 'Work started', 'Need response'];
    if (['accepted', 'confirmed'].includes(normStatus)) {
      return defaultList.filter(r => r !== 'Work started');
    }
    return defaultList;
  }

  return [];
};
