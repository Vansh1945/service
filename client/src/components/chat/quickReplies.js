/**
 * Predefined quick reply messages based on user roles and booking statuses.
 * Stylized and selected to mimic quick-replies in delivery & ride-sharing apps (Blinkit, Rapido, etc.).
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
      return [
        'Thanks for the service!',
        'Great job, thank you.',
        'Need help',
        'Please call me'
      ];
    }
    if (normStatus === 'pending') {
      return [
        'Please accept the booking',
        'Is this timing confirmed?',
        'Please call me',
        'Need help'
      ];
    }
    // For accepted, in-progress, etc.
    return [
      'Where are you?',
      'Please come fast',
      'Gate is open',
      'Call me when you reach',
      'I am at home',
      'Need help'
    ];
  }

  // Provider Quick Replies
  if (normRole === 'provider') {
    if (normStatus === 'completed') {
      return [
        'Thank you!',
        'Work completed',
        'Please rate the service',
        'Need help'
      ];
    }
    if (normStatus === 'pending') {
      return [
        'I can accept this booking',
        'Let me check availability',
        'Need help',
        'Please confirm booking'
      ];
    }

    // For accepted, confirmed, in-progress, etc.
    const defaultList = [
      'I am on my way',
      'Arriving in 5 min',
      'Arriving in 10 min',
      'Reached location',
      'Please come outside',
      'Work started',
      'Need help'
    ];

    if (['accepted', 'confirmed'].includes(normStatus)) {
      return defaultList.filter(r => r !== 'Work started');
    }
    return defaultList;
  }

  return [];
};

