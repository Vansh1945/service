const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema({
  senderId: {
    type: Schema.Types.ObjectId,
    required: true
  },
  senderRole: {
    type: String,
    enum: ['customer', 'provider', 'admin'],
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'location', 'system'],
    default: 'text'
  },
  content: {
    type: String,
    trim: true,
    required: function() {
      return this.messageType === 'text' || this.messageType === 'system';
    }
  },
  fileUrl: {
    type: String,
    default: null
  },
  seen: {
    type: Boolean,
    default: false
  },
  delivered: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const chatRoomSchema = new Schema({
  bookingId: {
    type: Schema.Types.ObjectId,
    ref: 'Booking',
    required: false
  },
  customerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  providerId: {
    type: Schema.Types.ObjectId,
    ref: 'Provider',
    required: false
  },
  complaintId: {
    type: Schema.Types.ObjectId,
    ref: 'Complaint',
    required: false
  },
  roomType: {
    type: String,
    enum: ['provider_customer', 'customer_admin', 'provider_admin', 'complaint_admin'],
    default: 'provider_customer'
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'locked', 'complaint'],
    default: 'active'
  },
  lastMessage: {
    type: String,
    default: ''
  },
  unreadCustomer: {
    type: Number,
    default: 0
  },
  unreadProvider: {
    type: Number,
    default: 0
  },
  unreadAdmin: {
    type: Number,
    default: 0
  },
  adminJoined: {
    type: Boolean,
    default: false
  },
  lastAdminNotificationSentAt: {
    type: Date,
    default: null
  },
  messages: [messageSchema]
}, {
  timestamps: true
});

// Indexes for query optimization
chatRoomSchema.index({ bookingId: 1 });
chatRoomSchema.index({ customerId: 1 });
chatRoomSchema.index({ providerId: 1 });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;
