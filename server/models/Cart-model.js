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
  },
  priceAtAddition: {
    type: Number,
    required: true
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

cartSchema.methods.addItem = async function(serviceId, quantity = 1, currentPrice) {
  const existingItem = this.items.find(item => item.service.equals(serviceId));
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    this.items.push({ 
      service: serviceId, 
      quantity,
      priceAtAddition: currentPrice
    });
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

cartSchema.virtual('totalAmount').get(function() {
  return this.items.reduce((total, item) => {
    return total + (item.priceAtAddition * item.quantity);
  }, 0);
});

cartSchema.set('toJSON', { virtuals: true });
cartSchema.set('toObject', { virtuals: true });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;