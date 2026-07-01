const ChatRoom = require('../models/ChatRoom-model');
const Booking = require('../models/Booking-model');
const { getIO } = require('../socket/socketServer');

/**
 * Helper to get namespace-based room name for socket and tracking purposes
 */
const getRoomNamespace = (room) => {
  if (room.roomType === 'provider_customer') {
    return `provider_customer:${room.bookingId}`;
  } else if (room.roomType === 'customer_admin') {
    return `customer_admin:${room.customerId}`;
  } else if (room.roomType === 'provider_admin') {
    return `provider_admin:${room.providerId}`;
  } else if (room.roomType === 'complaint_admin') {
    return `complaint_admin:${room.complaintId}`;
  }
  return room._id.toString();
};

/**
 * Helper to check chat availability based on booking lifecycle rules
 */
const getChatAccessStatus = (booking) => {
  if (!booking) {
    return { allowed: false, reason: 'Booking not found' };
  }

  // Resolved dispute / resolved status locks it completely
  if (booking.disputeStatus === 'resolved' || booking.status === 'resolved') {
    return { allowed: false, reason: 'This booking dispute has been resolved and the chat is locked.' };
  }

  // Complaint reopens/enables the conversation
  if (booking.hasComplaint || booking.disputeRaised || booking.status === 'complaint') {
    return { allowed: true };
  }

  // Before confirmed - no chat allowed
  if (['pending', 'cancelled', 'no-show'].includes(booking.status)) {
    return { allowed: false, reason: 'Chat is not available before the booking is confirmed.' };
  }

  // Completed - check 24 hours followup limit
  if (booking.status === 'completed') {
    const completedTime = booking.serviceCompletedAt || booking.completedAt || booking.updatedAt || booking.createdAt;
    const diffMs = Date.now() - new Date(completedTime).getTime();
    const isPast24h = diffMs > 24 * 60 * 60 * 1000;
    if (isPast24h) {
      return { allowed: false, reason: 'Chat is locked because 24 hours have passed since service completion.' };
    }
    return { allowed: true };
  }

  // Confirmed, Scheduled, In Progress, etc. have full access
  return { allowed: true };
};

/**
 * Helper to notify admins that a customer-provider chat room has been opened
 */
const sendChatOpenedAdminNotification = async (room) => {
  if (room.roomType !== 'provider_customer') return;

  // Cooldown check (5 minutes)
  const now = new Date();
  const cooldownMs = 5 * 60 * 1000;
  if (room.lastAdminNotificationSentAt && (now - new Date(room.lastAdminNotificationSentAt) < cooldownMs)) {
    global.logger.info(`[ChatController] Admin notification suppressed due to cooldown for room ${room._id}`);
    return;
  }

  try {
    const { notifyAdmins } = require('../utils/notificationHelper');
    const customerName = room.customerId?.name || 'Customer';
    const providerName = room.providerId?.name || 'Provider';
    const providerDisplayId = room.providerId?.providerId || ''; // Business ID, e.g. PROV-xxxxx

    let bookingCode = '';
    if (room.bookingId) {
      const bookingToFind = room.bookingId._id || room.bookingId;
      const bDetails = await Booking.findById(bookingToFind);
      if (bDetails) {
        bookingCode = bDetails.bookingId;
      }
    }
    const bookingDisplay = bookingCode ? `#${bookingCode}` : 'Booking';

    const title = 'Customer & Provider Chat Opened';
    // Ensure provider's database ID (ObjectId) is NOT in the notification message
    const message = `Client "${customerName}" and Partner "${providerName}"${providerDisplayId ? ` (${providerDisplayId})` : ''} have opened a chat room for ${bookingDisplay}.`;

    // Notify all admins via standard system notification channels
    await notifyAdmins(title, message, 'booking', room.bookingId || null, '/admin/chat-monitor');

    // Broadcast real-time alert via socket to admin room
    const io = getIO();
    io.to('admin_live_room').emit('admin:alert', {
      title,
      message,
      roomId: room._id.toString()
    });

    // Update lastAdminNotificationSentAt
    room.lastAdminNotificationSentAt = now;
    await room.save();
    global.logger.info(`[ChatController] Admin notification sent successfully for room ${room._id}`);
  } catch (nErr) {
    global.logger.error('Error notifying admins on chat room opening: ' + nErr.message, nErr);
  }
};

/**
 * 1. Create room or retrieve existing room for a booking
 */
const createRoom = async (req, res) => {
  try {
    const { roomType, bookingId, complaintId, customerId, providerId } = req.body;
    const targetRoomType = roomType || 'provider_customer';

    // ─── BACKEND ACCESS CONTROL & VALIDATION ───
    if (targetRoomType === 'provider_customer') {
      if (!bookingId) {
        return res.status(400).json({ success: false, message: 'Booking ID is required' });
      }

      // Fetch booking details
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
      }

      // Provider assigned and booking accepted checks
      // Enable ONLY when booking status is: assigned, accepted, on_the_way, arrived, in_progress, completed, etc.
      // Else reject: "Chat available after booking acceptance"
      const allowedStatuses = ['assigned', 'accepted', 'on_the_way', 'arrived', 'in_progress', 'in-progress', 'started', 'completed'];
      if (!booking.provider || !allowedStatuses.includes(booking.status)) {
        return res.status(403).json({ success: false, message: 'Chat available after booking acceptance' });
      }
    }

    let customerIdToUse = customerId;
    if (!customerIdToUse && targetRoomType === 'customer_admin' && req.role === 'customer') {
      customerIdToUse = req.user?._id || req.userID;
    }

    let providerIdToUse = providerId;
    if (!providerIdToUse && targetRoomType === 'provider_admin' && req.role === 'provider') {
      providerIdToUse = req.user?._id || req.providerId;
    }

    // Build unique query for roomType
    let query = { roomType: targetRoomType };
    if (targetRoomType === 'provider_customer') {
      query.bookingId = bookingId;
    } else if (targetRoomType === 'customer_admin') {
      query.customerId = customerIdToUse;
    } else if (targetRoomType === 'provider_admin') {
      query.providerId = providerIdToUse;
    } else if (targetRoomType === 'complaint_admin') {
      query.complaintId = complaintId;
    }

    // Return existing room if already created
    let room = await ChatRoom.findOne(query)
      .populate('customerId', 'name email phone profilePicUrl lastSeen')
      .populate('providerId', 'name email phone profilePicUrl providerId isOnline lastSeen');

    if (room) {
      let isModified = false;
      if (targetRoomType === 'provider_customer') {
        const booking = await Booking.findById(bookingId);
        if (booking) {
          // Re-evaluate status if booking has changed (e.g. complaint raised)
          let targetStatus = room.status;
          if (booking.hasComplaint || booking.disputeRaised) {
            targetStatus = 'complaint';
          } else if (booking.status === 'completed') {
            const completedTime = booking.serviceCompletedAt || booking.completedAt || booking.updatedAt;
            const isPast24h = completedTime && (Date.now() - new Date(completedTime).getTime() > 24 * 60 * 60 * 1000);
            targetStatus = isPast24h ? 'completed' : 'active';
          }

          if (room.status !== targetStatus) {
            room.status = targetStatus;
            isModified = true;
          }
        }

        if (isModified) {
          await room.save();
        }

        // Trigger notification check
        await sendChatOpenedAdminNotification(room);
      }

      const { getSocketId } = require('../socket/userSocketMap');
      const roomObj = room.toObject();
      if (roomObj.customerId) {
        roomObj.customerId.isOnline = !!getSocketId(roomObj.customerId._id);
      }
      if (roomObj.providerId) {
        roomObj.providerId.isOnline = !!getSocketId(roomObj.providerId._id) || roomObj.providerId.isOnline;
      }

      return res.status(200).json({
        success: true,
        message: 'Chat room retrieved successfully',
        data: roomObj
      });
    }

    // Determine initial room status
    let initialStatus = 'active';
    let customerToSave = customerIdToUse || null;
    let providerToSave = providerIdToUse || null;
    let bookingToSave = bookingId || null;

    if (targetRoomType === 'provider_customer') {
      const booking = await Booking.findById(bookingId);
      if (booking) {
        if (booking.hasComplaint || booking.disputeRaised) {
          initialStatus = 'complaint';
        } else if (booking.status === 'completed') {
          initialStatus = 'completed';
        }
        customerToSave = booking.customer;
        providerToSave = booking.provider;
      }
    } else if (targetRoomType === 'complaint_admin') {
      initialStatus = 'complaint';
      const Complaint = require('../models/Complaint-model');
      const complaint = await Complaint.findById(complaintId);
      if (complaint) {
        customerToSave = complaint.customerId || complaint.customer;
        bookingToSave = complaint.bookingId || complaint.booking;
      }
    }

    // Create room
    room = new ChatRoom({
      roomType: targetRoomType,
      bookingId: bookingToSave,
      customerId: customerToSave,
      providerId: providerToSave,
      complaintId: complaintId || null,
      status: initialStatus
    });

    await room.save();

    // Populate profiles
    await room.populate([
      { path: 'customerId', select: 'name email phone profilePicUrl lastSeen' },
      { path: 'providerId', select: 'name email phone profilePicUrl providerId isOnline lastSeen' }
    ]);

    // Send admin notification if it is a provider_customer room
    if (targetRoomType === 'provider_customer') {
      await sendChatOpenedAdminNotification(room);
    }

    const { getSocketId } = require('../socket/userSocketMap');
    const roomObj = room.toObject();
    if (roomObj.customerId) {
      roomObj.customerId.isOnline = !!getSocketId(roomObj.customerId._id);
    }
    if (roomObj.providerId) {
      roomObj.providerId.isOnline = !!getSocketId(roomObj.providerId._id) || roomObj.providerId.isOnline;
    }

    res.status(201).json({
      success: true,
      message: 'Chat room created successfully',
      data: roomObj
    });
  } catch (error) {
    global.logger.error(`[ChatController.createRoom] Route: ${req.originalUrl || req.url} - Error in createRoom: ${error.message}`, error);
    next(error);
  }
};

/**
 * 2. Send Message inside a room
 */
const sendMessage = async (req, res) => {
  try {
    const { roomId, messageType, content, fileUrl } = req.body;
    const senderId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;
    const senderRole = req.role; // customer, provider, admin

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Sender belongs to room check
    const isCustomer = room.customerId && room.customerId.toString() === senderId.toString() && senderRole === 'customer';
    const isProvider = room.providerId && room.providerId.toString() === senderId.toString() && senderRole === 'provider';
    const isAdmin = senderRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ success: false, message: 'You are not authorized to send messages in this room' });
    }

    // Booking lifecycle rules check - only for provider_customer room type
    if (room.roomType === 'provider_customer' || (!room.roomType && room.bookingId)) {
      const booking = await Booking.findById(room.bookingId);
      const access = getChatAccessStatus(booking);

      if (!access.allowed && !isAdmin) {
        return res.status(403).json({ success: false, message: access.reason || 'Chat access is restricted for this booking lifecycle state.' });
      }
    }

    // Build message
    const { getSocketId } = require('../socket/userSocketMap');
    let isOtherOnline = false;
    let otherPartyId = null;

    if (senderRole === 'customer') {
      otherPartyId = room.providerId;
    } else if (senderRole === 'provider') {
      otherPartyId = room.customerId;
    }

    if (otherPartyId) {
      isOtherOnline = !!getSocketId(otherPartyId);
    }

    const newMessage = {
      senderId,
      senderRole,
      messageType: messageType || 'text',
      content: messageType === 'text' || messageType === 'system' ? content : '',
      fileUrl: fileUrl || null,
      seen: false,
      replyTo: req.body.replyTo || null,
      delivered: isOtherOnline,
      deliveredAt: isOtherOnline ? new Date() : null,
      status: isOtherOnline ? 'delivered' : 'sent',
      createdAt: new Date()
    };

    // Add message to array
    room.messages.push(newMessage);
    room.lastMessage = messageType === 'text' ? content : `[${messageType}]`;

    // Increment unread counts
    const isSupportRoom = ['customer_admin', 'provider_admin', 'complaint_admin'].includes(room.roomType);
    const shouldIncrementAdmin = room.adminJoined || isSupportRoom;

    if (isCustomer) {
      room.unreadProvider += 1;
      if (shouldIncrementAdmin) room.unreadAdmin += 1;
    } else if (isProvider) {
      room.unreadCustomer += 1;
      if (shouldIncrementAdmin) room.unreadAdmin += 1;
    } else if (isAdmin) {
      room.unreadCustomer += 1;
      room.unreadProvider += 1;
    }

    await room.save();

    // Send push notification to the recipient of the chat message
    if (otherPartyId) {
      try {
        const { sendNotification } = require('../utils/notificationHelper');
        const senderName = req.user?.name || req.provider?.name || req.admin?.name || 'User';
        const otherRole = senderRole === 'customer' ? 'provider' : 'customer';
        const targetUrl = otherRole === 'customer' ? `/messages/${room._id}` : `/provider/messages/${room._id}`;

        await sendNotification(
          otherPartyId,
          otherRole,
          'chat_message',
          `${senderName}: ${newMessage.content || '[File/Image]'}`,
          'booking',
          room.bookingId || null,
          targetUrl,
          'chat_message'
        );
      } catch (nErr) {
        global.logger.error('Error triggering chat push notification in sendMessage: ' + nErr.message, nErr);
      }
    }

    // Send admin notification if they start chatting again after a break (30 minutes of inactivity)
    if (room.roomType === 'provider_customer') {
      try {
        const now = new Date();
        const cooldownMs = 5 * 60 * 1000; // 5 minutes

        let isAfterBreak = false;
        if (room.messages.length > 1) {
          const secondLastMsg = room.messages[room.messages.length - 2];
          const lastMsgTime = new Date(secondLastMsg.createdAt);
          if (now - lastMsgTime > cooldownMs) {
            isAfterBreak = true;
          }
        } else {
          isAfterBreak = true;
        }

        const notifCooldownPassed = !room.lastAdminNotificationSentAt || (now - new Date(room.lastAdminNotificationSentAt) > cooldownMs);

        if (isAfterBreak && notifCooldownPassed) {
          await room.populate([
            { path: 'customerId', select: 'name email phone profilePicUrl' },
            { path: 'providerId', select: 'name email phone profilePicUrl providerId' }
          ]);
          // Call helper asynchronously to not block response
          sendChatOpenedAdminNotification(room).catch(err => global.logger.error(err.message, err));
        }
      } catch (nErr) {
        global.logger.error('Error triggering break notification in sendMessage: ' + nErr.message, nErr);
      }
    }

    const savedMessage = room.messages[room.messages.length - 1];

    // Emit live socket update
    try {
      const io = getIO();
      const ns = getRoomNamespace(room);
      io.to(roomId.toString()).to(ns).emit('chat:new-message', {
        roomId,
        message: savedMessage,
        lastMessage: room.lastMessage,
        unreadCustomer: room.unreadCustomer,
        unreadProvider: room.unreadProvider,
        unreadAdmin: room.unreadAdmin
      });
    } catch (sErr) {
      global.logger.warn('Socket emit failed, message saved to DB: ' + sErr.message, sErr);
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: savedMessage
    });
  } catch (error) {
    global.logger.error(`[ChatController.sendMessage] Route: ${req.originalUrl || req.url} - Error in sendMessage: ${error.message}`, error);
    next(error);
  }
};

/**
 * 9. Admin fetch messages for any room (read‑only)
 * Admins bypass participant checks and can view full history.
 */
const adminGetMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    // Ensure requester is admin (middleware already enforces, but double‑check)
    if (req.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admin can access this endpoint' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    const adminId = req.adminID || (req.user && req.user._id) || req.userID;
    // Filter messages that are NOT deleted for this admin
    const visibleMessages = room.messages.filter(msg => {
      return !msg.deletedForUsers || !msg.deletedForUsers.some(id => id.toString() === adminId.toString());
    });

    // Pagination – same logic as getMessages
    const totalMessages = visibleMessages.length;
    const startIndex = Math.max(0, totalMessages - (page * limit));
    const endIndex = totalMessages - ((page - 1) * limit);
    const paginatedMessages = visibleMessages.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedMessages,
      pagination: {
        total: totalMessages,
        page,
        limit,
        pages: Math.ceil(totalMessages / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[ChatController.adminGetMessages] Route: ${req.originalUrl || req.url} - Error in adminGetMessages: ${error.message}`, error);
    next(error);
  }
};

/**
 * 3. Get messages for a room (Paginated)
 */
const getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Verify participant
    const userId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;
    const userRole = req.role;
    const isCustomer = room.customerId && room.customerId.toString() === userId.toString() && userRole === 'customer';
    const isProvider = room.providerId && room.providerId.toString() === userId.toString() && userRole === 'provider';
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to chat room' });
    }

    // Filter messages that are NOT deleted for this user
    const visibleMessages = room.messages.filter(msg => {
      return !msg.deletedForUsers || !msg.deletedForUsers.some(id => id.toString() === userId.toString());
    });

    // Slice messages arrays for in-memory pagination
    const totalMessages = visibleMessages.length;
    const startIndex = Math.max(0, totalMessages - (page * limit));
    const endIndex = totalMessages - ((page - 1) * limit);

    const paginatedMessages = visibleMessages.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedMessages,
      pagination: {
        total: totalMessages,
        page,
        limit,
        pages: Math.ceil(totalMessages / limit)
      }
    });
  } catch (error) {
    global.logger.error(`[ChatController.getMessages] Route: ${req.originalUrl || req.url} - Error in getMessages: ${error.message}`, error);
    next(error);
  }
};

/**
 * 4. Mark all messages as seen by caller
 */
const markSeen = async (req, res) => {
  try {
    const { roomId } = req.body;
    const userId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;
    const userRole = req.role;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Reset unread counts and update seen flag for incoming messages
    let updated = false;

    room.messages.forEach(msg => {
      if (msg.senderId && msg.senderId.toString() !== userId.toString() && !msg.seen) {
        msg.seen = true;
        updated = true;
      }
    });

    if (userRole === 'customer') {
      if (room.unreadCustomer > 0 || updated) {
        room.unreadCustomer = 0;
        updated = true;
      }
    } else if (userRole === 'provider') {
      if (room.unreadProvider > 0 || updated) {
        room.unreadProvider = 0;
        updated = true;
      }
    } else if (userRole === 'admin') {
      if (room.unreadAdmin > 0 || updated) {
        room.unreadAdmin = 0;
        updated = true;
      }
    }

    if (updated) {
      await room.save();

      // Emit seen receipt to room
      try {
        const io = getIO();
        io.to(roomId.toString()).emit('chat:seen', {
          roomId,
          seenBy: userId,
          seenRole: userRole
        });
      } catch (sErr) {
        global.logger.warn('Socket seen emit failed: ' + sErr.message, sErr);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Messages marked as seen successfully',
      data: {
        unreadCustomer: room.unreadCustomer,
        unreadProvider: room.unreadProvider,
        unreadAdmin: room.unreadAdmin
      }
    });
  } catch (error) {
    global.logger.error(`[ChatController.markSeen] Route: ${req.originalUrl || req.url} - Error in markSeen: ${error.message}`, error);
    next(error);
  }
};

/**
 * 5. Broadcast typing indicator status
 */
const typingStatus = async (req, res) => {
  try {
    const { roomId, isTyping } = req.body;
    const userId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;
    const userName = (req.user && req.user.name) || (req.admin && req.admin.name) || (req.provider && req.provider.name) || 'User';

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    // Broadcast socket event
    try {
      const io = getIO();
      io.to(roomId.toString()).emit('chat:typing', {
        roomId,
        userId,
        userName,
        role: req.role,
        isTyping: !!isTyping
      });
    } catch (sErr) {
      global.logger.warn('Socket typing emit failed: ' + sErr.message, sErr);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    global.logger.error(`[ChatController.typingStatus] Route: ${req.originalUrl || req.url} - Error in typingStatus: ${error.message}`, error);
    next(error);
  }
};

/**
 * 6. Admin monitor: Return all active chat rooms
 */
const adminMonitor = async (req, res) => {
  try {
    // Return active rooms that are not fully locked/historical unless requested
    const rooms = await ChatRoom.find({ status: { $ne: 'locked' } })
      .populate('bookingId', 'bookingId status totalAmount date hasComplaint disputeStatus')
      .populate('customerId', 'name email phone profilePicUrl')
      .populate('providerId', 'name email phone profilePicUrl providerId')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: rooms
    });
  } catch (error) {
    global.logger.error(`[ChatController.adminMonitor] Route: ${req.originalUrl || req.url} - Error in adminMonitor: ${error.message}`, error);
    next(error);
  }
};

/**
 * 7. Admin join chat room
 */
const joinAdmin = async (req, res) => {
  try {
    const { roomId } = req.params;
    const adminId = req.adminID || (req.user && req.user._id);

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Set adminJoined flag
    room.adminJoined = true;

    // Push system message
    const systemMessage = {
      senderId: adminId,
      senderRole: 'admin',
      messageType: 'system',
      content: 'Admin joined this conversation',
      seen: false,
      delivered: true,
      createdAt: new Date()
    };

    room.messages.push(systemMessage);
    room.lastMessage = 'Admin joined this conversation';

    await room.save();

    const savedMessage = room.messages[room.messages.length - 1];

    // Emit live socket update
    try {
      const io = getIO();
      io.to(roomId.toString()).emit('chat:new-message', {
        roomId,
        message: savedMessage,
        lastMessage: room.lastMessage,
        adminJoined: true
      });
      io.to(roomId.toString()).emit('chat:admin-joined', { roomId });
    } catch (sErr) {
      global.logger.warn('Socket admin join emit failed: ' + sErr.message, sErr);
    }

    res.status(200).json({
      success: true,
      message: 'Admin joined conversation successfully',
      data: room
    });
  } catch (error) {
    global.logger.error(`[ChatController.joinAdmin] Route: ${req.originalUrl || req.url} - Error in joinAdmin: ${error.message}`, error);
    next(error);
  }
};

/**
 * 8. Upload image or file in chat
 */
const uploadChatFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileUrl = req.file.path;

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      fileUrl
    });
  } catch (error) {
    global.logger.error(`[ChatController.uploadChatFile] Route: ${req.originalUrl || req.url} - Chat file upload error: ${error.message}`, error);
    next(error);
  }
};

/**
 * 10. Delete a message for current user (Delete For Me)
 */
const deleteMessageForMe = async (req, res) => {
  try {
    const { roomId, messageId } = req.body;
    const userId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;

    if (!roomId || !messageId) {
      return res.status(400).json({ success: false, message: 'Room ID and Message ID are required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Find the message
    const msg = room.messages.id(messageId);
    if (!msg) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Add user to deletedForUsers if not already there
    if (!msg.deletedForUsers.some(id => id.toString() === userId.toString())) {
      msg.deletedForUsers.push(userId);
      await room.save();
    }

    res.status(200).json({ success: true, message: 'Message deleted for you successfully' });
  } catch (error) {
    global.logger.error(`[ChatController.deleteMessageForMe] Route: ${req.originalUrl || req.url} - Error in deleteMessageForMe: ${error.message}`, error);
    next(error);
  }
};

/**
 * 11. Search messages in a room
 */
const searchMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { q } = req.query;
    const userId = (req.user && req.user._id) || req.adminID || req.providerId || req.userID;
    const userRole = req.role;

    if (!roomId) {
      return res.status(400).json({ success: false, message: 'Room ID is required' });
    }
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query is required' });
    }

    const room = await ChatRoom.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Chat room not found' });
    }

    // Verify participant
    const isCustomer = room.customerId && room.customerId.toString() === userId.toString() && userRole === 'customer';
    const isProvider = room.providerId && room.providerId.toString() === userId.toString() && userRole === 'provider';
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isProvider && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to chat room' });
    }

    const searchRegex = new RegExp(q, 'i');
    const matchedMessages = room.messages.filter(msg => {
      // Must not be deleted for this user
      const isDeleted = msg.deletedForUsers && msg.deletedForUsers.some(id => id.toString() === userId.toString());
      if (isDeleted) return false;

      // Must match search term
      return msg.content && searchRegex.test(msg.content);
    });

    res.status(200).json({
      success: true,
      data: matchedMessages
    });
  } catch (error) {
    global.logger.error(`[ChatController.searchMessages] Route: ${req.originalUrl || req.url} - Error in searchMessages: ${error.message}`, error);
    next(error);
  }
};

module.exports = {
  adminGetMessages,
  createRoom,
  sendMessage,
  getMessages,
  markSeen,
  typingStatus,
  adminMonitor,
  joinAdmin,
  uploadChatFile,
  deleteMessageForMe,
  searchMessages
};
