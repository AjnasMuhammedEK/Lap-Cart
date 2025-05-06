const mongoose = require('mongoose');
const { Schema } = mongoose;

const orderSchema = new Schema({
  orderId: {
    type: String,
    unique: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  orderedItems: [
    {
      product: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      orderQuantity: {  
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        default: 0,
      },
      offferId: {
        type: Schema.Types.ObjectId,
        ref: 'Offer',
      },
      offerAmount: {
        type: Number,
        default: 0,
      },
      couponId: {
        type: Schema.Types.ObjectId,
        ref: 'Coupon',
      },
      returnStatus: {
        type: String,
        enum: ['Not Returned', 'Return Requested', 'Returned', 'Return Rejected', 'Cancelled'],
        default: 'Not Returned',
      },
      returnReason: {
        type: String,
        required: false,
        default: '',
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
  },
  discount: {
    type: Number,
    default: 0,
  },
  offerDiscount: {
    type: Number,
    default: 0,
    min: 0,
  },
  couponDiscount: {
    type: Number,
    default: 0,
    min: 0,
  },
  cancelledCouponAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  cancelledAmount: {
    type: Number,
    default: 0,
  },
  returnAmount: {
    type: Number,
    default: 0,
  },
  shipping: {
    type: Number,
    default: 0,
  },
  finalAmount: {
    type: Number,
    required: true,
  },
  address: {
    type: {
      addressType: { type: String, required: true },
      name: { type: String, required: true },
      city: { type: String, required: true },
      landmark: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      phone: { type: String, required: true },
    },
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['COD', 'Wallet', 'Razorpay'],
    required: true,
    default: 'COD',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending',
  },
  invoiceDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    required: true,
    enum: ['Pending', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Return Request', 'Returned', 'Return Rejected'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  walletAmountUsed: {
    type: Number,
    default: 0,
  },
  razorpayOrderId: {
    type: String,
    required: false,
  },
  razorpayPaymentId: {
    type: String,
    required: false,
  },
});

orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    try {
      const prefix = 'ORD2025405-'; // Static prefix as per your example
      const lastOrder = await mongoose.model('Order').findOne({
        orderId: { $regex: `^${prefix}` },
      }).sort({ orderId: -1 });

      let counter = 1;
      if (lastOrder && lastOrder.orderId) {
        const lastCounter = parseInt(lastOrder.orderId.split('-')[1], 10);
        counter = lastCounter + 1;
      }

      const counterStr = counter.toString().padStart(3, '0'); // Ensures at least 3 digits (e.g., 001)
      this.orderId = `${prefix}${counterStr}`;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;