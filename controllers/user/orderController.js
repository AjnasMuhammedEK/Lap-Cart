const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const WishList = require('../../models/wishlistSchema');
const Wallet = require('../../models/walletSchema');
const Address = require('../../models/addressSchema');
const Coupon = require('../../models/couponSchema');
const Offer = require('../../models/offerSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();

 const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { selectedAddressId, paymentMethod } = req.body;

        const user = await User.findById(userId);
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        const address = await Address.findOne({ userId });

        if (!user || !cart || !address) {
            return res.status(400).json({ message: 'User, cart, or address not found' });
        }

         const selectedAddress = address.address.find(
            addr => addr._id.toString() === selectedAddressId
        );
        if (!selectedAddress) {
            return res.status(400).json({ message: 'Selected address not found' });
        }

         const outOfStockItems = [];
        for (const item of cart.items) {
            const product = item.productId;
            if (product.quantity < item.quantity || !product.isListed || product.isDeleted) {
                outOfStockItems.push(product.productName);
            }
        }
        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                message: `The following items are out of stock or unavailable: ${outOfStockItems.join(', ')}`,
            });
        }

         const totalPrice = cart.items.reduce(
            (sum, item) => sum + item.productId.salePrice * item.quantity,
            0
        );

        const currentDate = new Date();
        const allOffers = await Offer.find({
            isListed: true,
            isDeleted: false,
            validFrom: { $lte: currentDate },
            validUpto: { $gte: currentDate },
        }).lean();

         const result = cart.items.map(item => {
            const offers = allOffers.filter(offer => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    offerId === item.productId.category.toString() ||
                    offerId === item.productId.brand._id.toString() ||
                    offerId === item.productId._id.toString()
                );
            });

            const bestOffer = getBestOffer(offers, item);
            return {
                product: item,
                bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat' },
            };
        });

         let offerDiscount = 0;
        if (result.some(item => item.bestOffer.discountAmount > 0)) {
            offerDiscount = result.reduce((sum, item) => {
                const { bestOffer, product } = item;
                let discount = 0;
                if (bestOffer) {
                    if (bestOffer.discountType === 'flat') {
                        discount = bestOffer.discountAmount * product.quantity;
                    } else if (bestOffer.discountType === 'percentage') {
                        discount = (product.productId.salePrice * bestOffer.discountAmount * product.quantity) / 100;
                    }
                }
                return sum + discount;
            }, 0);
        }

        let couponApplied = false;
        let couponDiscount = 0;
        let discount = 0;
        let finalAmount = totalPrice;  

        const selectedCouponId = req.session.appliedCoupon;
        if (selectedCouponId) {
            const coupon = await Coupon.findById(selectedCouponId);
            if (
                coupon &&
                coupon.isListed &&
                !coupon.isDeleted &&
                currentDate >= coupon.startDate &&
                currentDate <= coupon.endDate &&
                totalPrice >= coupon.minimumPrice
            ) {
                couponDiscount = coupon.offerPrice;
                couponApplied = true;
                req.session.appliedCoupon = null;
                discount = offerDiscount + couponDiscount;
                finalAmount = totalPrice - discount;
                if (finalAmount < 0) finalAmount = 0;
            } else {
                discount = offerDiscount;
                finalAmount = totalPrice - discount;
                if (finalAmount < 0) finalAmount = 0;
            }
        } else {
             discount = offerDiscount;
            finalAmount = totalPrice - discount;
            if (finalAmount < 0) finalAmount = 0;
        }

        let walletAmountUsed = 0;
        let adjustedPaymentMethod = paymentMethod;
        const wallet = await Wallet.findOne({ userId });

        if (paymentMethod === 'Wallet') {
            if (!wallet || wallet.balance < finalAmount) {
                return res.status(400).json({
                    message: `Insufficient wallet balance. Required: ₹${finalAmount.toFixed(2)}, Available: ₹${(wallet?.balance || 0).toFixed(2)}`,
                });
            }

            walletAmountUsed = finalAmount;
            finalAmount = 0;
            adjustedPaymentMethod = 'Wallet';

            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: -walletAmountUsed },
                    $push: {
                        transactions: {
                            amount: walletAmountUsed,
                            type: 'Debit',
                            method: 'OrderPayment',
                            status: 'Completed',
                            description: 'Payment for order',
                            date: new Date(),
                        },
                    },
                    lastUpdated: new Date(),
                }
            );
        }

        // Handle Razorpay payment
        if (paymentMethod === 'Razorpay' && finalAmount > 0) {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                return res.status(500).json({ message: 'Razorpay configuration error' });
            }

            const razorpayOrder = await createRazorpayOrder(finalAmount, userId);
            return res.status(200).json({
                message: 'Razorpay order created',
                razorpayOrder: {
                    id: razorpayOrder.id,
                    amount: razorpayOrder.amount,
                    currency: razorpayOrder.currency,
                    key: process.env.RAZORPAY_KEY_ID,
                },
                orderDetails: {
                    userId,
                    selectedAddress,
                    cartItems: cart.items,
                    totalPrice,
                    discount,
                    finalAmount,
                    walletAmountUsed,
                    couponApplied,
                    adjustedPaymentMethod,
                },
            });
        }

        //  if (finalAmount > 0 && !['COD', 'Razorpay'].includes(paymentMethod)) {
        //     return res.status(400).json({
        //         message: `Invalid payment method for amount: ₹${finalAmount.toFixed(2)}`,
        //     });
        // }

        // Create order
                // Create order
        const order = new Order({
            userId,
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                orderQuantity: item.quantity,
                price: item.productId.salePrice,
            })),
            totalPrice,
            discount,
            tax: 0,
            shipping: 0,
            finalAmount,
            offerDiscount,  
            couponDiscount,  
            address: {
                addressType: selectedAddress.addressType,
                name: selectedAddress.name,
                city: selectedAddress.city,
                landmark: selectedAddress.landMark,
                state: selectedAddress.state,
                pincode: selectedAddress.pincode,
                phone: selectedAddress.phone,
            },
            paymentMethod: adjustedPaymentMethod,
            status: paymentMethod === 'COD' ? 'Pending' : 'Processing',
            couponApplied,
            walletAmountUsed,
        });

         for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity },
            });
        }

        await order.save();
        await Cart.findOneAndDelete({ userId });

        return res.status(200).json({
            message: 'Order placed successfully',
            orderId: order.orderId,
            redirect: '/order-success',
        });
    } catch (error) {
        console.error('Error in placeOrder:', error);
        return res.status(500).json({ message: error.message || 'Server error' });
    }
};

 function getBestOffer(applicableOffers, product) {
    if (!Array.isArray(applicableOffers) || applicableOffers.length === 0) return null;

    let bestOffer = null;
    let maxDiscount = 0;

    for (const offer of applicableOffers) {
        let discount = 0;
        const salePrice = product.productId?.salePrice || product.salePrice || 0;

        if (salePrice <= 0) {
            console.log(`Invalid sale price for product: ${product.productId.productName}`);
            continue;
        }

        if (offer.discountType === 'flat') {
            discount = offer.discountAmount;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productId.productName}: Flat discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        } else if (offer.discountType === 'percentage') {
            discount = (salePrice * offer.discountAmount) / 100;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productId.productName}: Percentage discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        }

        if (discount > maxDiscount) {
            maxDiscount = discount;
            bestOffer = offer;
        }
    }

    return bestOffer;
}

const createRazorpayOrder = async (amount, userId) => {
    try {
        const orderAmount = Math.round(amount * 100); 
        if (orderAmount <= 0) {
            throw new Error('Invalid order amount: Amount must be greater than zero');
        }
        
        const options = {
            amount: orderAmount,
            currency: 'INR',
            receipt: `receipt_${userId}_090`,
        };

        const order = await razorpay.orders.create(options);
        if (!order || !order.id) {
            throw new Error('Razorpay API returned invalid order response');
        }

        return order;
    } catch (error) {
        console.error('Error in createRazorpayOrder:', {
            message: error.message,
            stack: error.stack,
        });
        throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
};

const loadOrderSuccess = async (req, res) => {
    try {
        const userId = req.session.user;
        const order = await Order.findOne({ userId })
            .sort({ createdAt: -1 })
            .populate('orderedItems.product');

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        res.render('successPage', {
            user: await User.findById(userId),
            order,
        });
    } catch (error) {
        console.error('Error in loadOrderSuccess:', error);
        res.redirect('/pageNotFound');
    }
};





const listOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const orders = await Order.find({ userId }).populate('orderedItems.product');

        res.render('userOrder', {
            orderData: orders,
            user,
        });
    } catch (error) {
        console.error('Error in listOrder:', error);
        res.redirect('/pageNotFound');
    }
};

// Load Order Details
const loadOrdDetailes = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        const { orderId } = req.query;

        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
        if (!order) {
            return res.redirect('/pageNotFound');
        }

        res.render('ord-detailes', {
            orderData: order,
            user,
        });
    } catch (error) {
        console.error('Error in loadOrdDetailes:', error);
        res.redirect('/pageNotFound');
    }
};

 const invoicePdf = async (req, res) => {
    try {
        const { orderId } = req.query;
        const userId = req.session.user;

         if (!orderId || !userId) {
            return res.status(400).redirect('/pageNotFound');
        }

         const user = await User.findById(userId);
        const order = await Order.findOne({ _id: orderId })
            .populate('orderedItems.product')
            .populate('userId');

        if (!user || !order) {
            return res.status(404).redirect('/pageNotFound');
        }

         order.orderedItems.forEach(item => {
            if (item.product.productImage && item.product.productImage.length > 0) {
                item.product.productImage[0] = `${req.protocol}://${req.get('host')}/Uploads/product-images/${item.product.productImage[0]}`;
            }
        });

         res.render('invoice', {
            user,
            orderData: order,
            orderDate: order.invoiceDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            invoiceNumber: order._id,
        });
    } catch (error) {
        console.error('Error in invoicePdf:', error);
        res.status(500).redirect('/pageNotFound');
    }
};

 const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.query;
        const userId = req.session.user;

        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
        if (!order) {
            return res.status(400).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }

         order.status = 'Cancelled';
        order.orderedItems.forEach(item => {
            item.returnStatus = 'Cancelled';
        });
        await order.save();

         if (order.paymentMethod !== 'COD') {
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: order.finalAmount },
                    $push: {
                        transactions: {
                            amount: order.finalAmount,
                            type: 'Credit',
                            method: 'Refund',
                            status: 'Completed',
                            description: 'Order Cancelled',
                            date: new Date(),
                        },
                    },
                },
                { upsert: true }
            );
        }

         for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.orderQuantity },
            });
        }

        return res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error in cancelOrder:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

 const returnProduct = async (req, res) => {
    try {
        const { productId, reason, orderID } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderID,
            'orderedItems.product': productId,
        });

        if (!order) {
            return res.status(400).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Order must be delivered to request a return' });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item.product.toString() === productId
        );
        if (itemIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in order' });
        }

        if (order.orderedItems[itemIndex].returnStatus !== 'Not Returned') {
            return res.status(400).json({ success: false, message: 'Return already processed or cancelled for this product' });
        }

         order.orderedItems[itemIndex].returnStatus = 'Return Requested';
        order.orderedItems[itemIndex].returnReason = reason;
        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Return request submitted successfully',
        });
    } catch (error) {
        console.error('Error in returnProduct:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

 const singleCancel = async (req, res) => {
    try {
        const { productId, orderId } = req.body;
        const userId = req.session.user;

        const order = await Order.findOne({
            _id: orderId,
            'orderedItems.product': productId,
        });

        if (!order) {
            return res.status(400).json({ success: false, message: 'Order not found' });
        }

        if (order.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Order is already cancelled' });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item.product.toString() === productId
        );
        if (itemIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in order' });
        }

        if (order.orderedItems[itemIndex].returnStatus !== 'Not Returned') {
            return res.status(400).json({ success: false, message: 'Product is already cancelled or returned' });
        }

         order.orderedItems[itemIndex].returnStatus = 'Cancelled';
        const product = await Product.findById(productId);
        const refundAmount = product.salePrice * order.orderedItems[itemIndex].orderQuantity - order.discount;
        order.finalAmount -= refundAmount;
        if (order.finalAmount < 0) order.finalAmount = 0;

         const allCancelled = order.orderedItems.every(item => item.returnStatus === 'Cancelled');
        if (allCancelled) {
            order.status = 'Cancelled';
        }

        await order.save();

         if (order.paymentMethod !== 'COD') {
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: refundAmount },
                    $push: {
                        transactions: {
                            amount: refundAmount,
                            type: 'Credit',
                            method: 'Refund',
                            status: 'Completed',
                            description: 'Product Cancelled',
                            date: new Date(),
                        },
                    },
                },
                { upsert: true }
            );
        }

         await Product.findByIdAndUpdate(productId, {
            $inc: { quantity: order.orderedItems[itemIndex].orderQuantity },
        });

        return res.json({ success: true, message: 'Product cancelled successfully' });
    } catch (error) {
        console.error('Error in singleCancel:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

const loadPaymentFailedPage = (req,res)=>{
    try {

        res.render('paymentfailedpage')
    } catch (error) {
        
    }
}

module.exports = {
    placeOrder,
     loadOrderSuccess,
    listOrder,
    loadOrdDetailes,
    invoicePdf,
    cancelOrder,
    singleCancel,
    returnProduct,
    loadPaymentFailedPage
};