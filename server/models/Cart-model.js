// models/Cart-model.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const cartItemSchema = new Schema({
  service: {
    type: Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  quantity: {
    type: Number,
    default: 1,
    min: [1, 'Quantity must be at least 1']
  }
}, { _id: false });

const cartSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date
  }
});

cartSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

cartSchema.methods.addItem = async function(serviceId, quantity = 1) {
  const existingItem = this.items.find(item => item.service.equals(serviceId));
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ service: serviceId, quantity });
  }
  
  return this.save();
};

cartSchema.methods.removeItem = async function(serviceId) {
  this.items = this.items.filter(item => !item.service.equals(serviceId));
  return this.save();
};

cartSchema.methods.updateQuantity = async function(serviceId, quantity) {
  const item = this.items.find(item => item.service.equals(serviceId));
  
  if (!item) {
    throw new Error('Item not found in cart');
  }
  
  item.quantity = quantity;
  return this.save();
};

cartSchema.methods.clearCart = async function() {
  this.items = [];
  return this.save();
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;