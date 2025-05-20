const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const WishList = require('../../models/wishlistSchema');
const Wallet = require('../../models/walletSchema');
const Transaction = require('../../models/transaction')
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
const singleCancel = async (req, res) => {
    try {
        const { productId, orderId } = req.body;
        const userId = req.session.user;
        const order = await Order.findOne({
            _id: orderId,
            'orderedItems.product': productId,
        }).populate('orderedItems.product');

        if (!order) {
            return res.status(400).json({ success: false, message: 'Order not found' });
        }
        const itemIndex = order.orderedItems.findIndex(
            item => item.product._id.toString() === productId
        );
        if (itemIndex === -1) {
            return res.status(400).json({ success: false, message: 'Product not found in order' });
        }

        const item = order.orderedItems[itemIndex];
        const itemTotalPrice = item.orderQuantity * item.price;
        const itemOfferAmount = item.offerAmount || 0;

        let refundAmount = itemTotalPrice - itemOfferAmount;
        if (refundAmount < 0) {
            console.warn(`Refund amount negative for item ${productId}. Setting to 0.`);
            refundAmount = 0;
        }

        let couponInvalidated = false;
        if (order.couponApplied && order.couponDiscount > 0 && order.cancelledCouponAmount === 0) {
            const coupon = await Coupon.findById(item.couponId);
            if (coupon) {
                const remainingPrice = order.orderedItems.reduce((sum, currItem, index) => {
                    if (index !== itemIndex && (currItem.returnStatus === 'Not Returned' || currItem.returnStatus === 'Return Requested') ) {
                        return sum + (currItem.orderQuantity * currItem.price - (currItem.offerAmount || 0));
                    }
                    return sum;
                }, 0);

                if (remainingPrice < coupon.minimumPrice) {
                    console.log(`Coupon ${coupon._id} no longer valid. Adjusting refundAmount and cancelledCouponAmount.`);
                    couponInvalidated = true;
                    order.cancelledCouponAmount = order.couponDiscount;
                    refundAmount -= order.couponDiscount;
                    if (refundAmount < 0) {
                        console.warn(`Refund amount negative after coupon adjustment. Setting to 0.`);
                        refundAmount = 0;
                    }
                }
            }
        }

        order.orderedItems[itemIndex].returnStatus = 'Cancelled';
        order.cancelledAmount = (order.cancelledAmount || 0) + refundAmount;

        const remainingItemsPrice = order.orderedItems.reduce((sum, currItem) => {
            if (currItem.returnStatus === 'Not Returned' || currItem.returnStatus === 'Return Requested' ) {
                return sum + (currItem.orderQuantity * currItem.price - (currItem.offerAmount || 0));
            }
            return sum;
        }, 0);

        order.finalAmount = remainingItemsPrice;
        if (order.cancelledCouponAmount === 0 && order.couponDiscount > 0) {
            order.finalAmount -= order.couponDiscount;
        }
        if (order.finalAmount < 0) {
            console.warn(`Order finalAmount negative after cancellation. Setting to 0.`);
            order.finalAmount = 0;
        }

        const allCancelled = order.orderedItems.every(item => item.returnStatus === 'Cancelled');
        if (allCancelled) {
            order.status = 'Cancelled';
            console.log(`Order ${order.orderId} status updated to Cancelled as all items are cancelled.`);
        }

        await order.save();

        if (order.paymentMethod !== 'COD' && refundAmount > 0 && order.paymentStatus === 'Completed') {
           await Wallet.findOneAndUpdate(
            {userId},
            {$inc:{balance:refundAmount }}
           )

           const transaction = new Transaction({
                userId,
                amount: refundAmount,
                type: 'Credit',
                method: 'Refund',
                status: 'Completed',
                description: `Refund for cancelled product ${item.product.productName}`,
                orderId:order._id
           })
           await transaction.save()
        }

        await Product.findByIdAndUpdate(productId, {
            $inc: { quantity: item.orderQuantity },
        });

        return res.json({ success: true, message: 'Product cancelled successfully' });
    } catch (error) {
        console.error('Error in singleCancel:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

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
            (sum, item) => sum + Number(item.productId.salePrice) * Number(item.quantity),
            0
        );

        if (totalPrice <= 0) {
            return res.status(400).json({ message: 'Invalid total price' });
        }
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

            const { offer, discountAmount } = getBestOffer(offers, item);
            return {
                product: item,
                bestOffer: offer ? {
                    _id: offer._id,
                    discountAmount,
                    discountType: offer.discountType,
                    offerName: offer.offerName
                } : { discountAmount: 0, discountType: 'flat' },
            };
        });

        let offerDiscount = 0;
        if (result.some(item => item.bestOffer.discountAmount > 0)) {
            offerDiscount = result.reduce((sum, item) => {
                const { bestOffer, product } = item;
                let discount = 0;
                if (bestOffer && bestOffer.discountAmount > 0) {
                    discount = bestOffer.discountAmount * Number(product.quantity);
                    const itemTotal = Number(product.productId.salePrice) * Number(product.quantity);
                    discount = Math.min(discount, itemTotal);
                }
                return sum + discount;
            }, 0);
        }

        if (offerDiscount > totalPrice) {
            console.warn(`Offer discount (${offerDiscount}) exceeds total price (${totalPrice}). Capping to total price.`);
            offerDiscount = totalPrice;
        }

        let couponApplied = false;
        let couponDiscount = 0;
        let couponId = null;
        const selectedCouponId = req.session.appliedCoupon;
        if (selectedCouponId) {
            const coupon = await Coupon.findById(selectedCouponId);
            if (coupon && coupon.isListed && !coupon.isDeleted && currentDate >= coupon.startDate && currentDate <= coupon.endDate && totalPrice >= coupon.minimumPrice ) {
                if (!coupon.offerPrice || coupon.offerPrice <= 0) {
                    console.warn(`Invalid coupon offerPrice for coupon ${selectedCouponId}`);
                } else {
                    couponDiscount = Number(coupon.offerPrice);
                    couponApplied = true;
                    couponId = coupon._id;
                    req.session.appliedCoupon = null;
                }
            } else {
                console.warn(`Coupon ${selectedCouponId} is invalid or not applicable`);
            }
        }

        if (couponDiscount > totalPrice - offerDiscount) {
            console.warn(`Coupon discount (${couponDiscount}) exceeds remaining amount (${totalPrice - offerDiscount})`);
            couponDiscount = totalPrice - offerDiscount;
        }

        const discount = offerDiscount + couponDiscount;
        let finalAmount = totalPrice - discount;
        if (finalAmount < 0) {
            console.warn(`Final amount is negative (${finalAmount}). TotalPrice: ${totalPrice}, Discount: ${discount}`);
            finalAmount = 0;
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
            adjustedPaymentMethod = 'Wallet';
        }

        if (paymentMethod === 'COD' && finalAmount > 1000) {
            return res.status(400).json({
                success: false,
                message: `Cash on Delivery is only available for orders under ₹1000. Your order total is ₹${finalAmount.toFixed(2)}.`,
            });
        }


        
        const order = new Order({
            userId,
            orderedItems: cart.items.map((item, index) => ({
                product: item.productId._id,
                orderQuantity: item.quantity,
                price: Number(item.productId.salePrice),
                offerId: result[index].bestOffer?._id || null,
                offerAmount: Number(result[index].bestOffer.discountAmount * item.quantity) || 0,
                couponId: couponApplied ? couponId : null,
                returnStatus: 'Not Returned',
                returnReason: '',
            })),
            totalPrice,
            discount,
            offerDiscount,
            couponDiscount,
            shipping: 0,
            finalAmount,
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
            status: paymentMethod === 'COD' ? 'Pending' : 'Pending',
            couponApplied,
            walletAmountUsed,
            paymentStatus: paymentMethod === 'Razorpay' ? 'Pending' : 'Completed',
        });

        if (paymentMethod === 'Razorpay' && finalAmount > 0) {
            if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
                order.paymentStatus = 'Failed';
                await order.save();
                await Cart.findOneAndDelete({ userId }); 
                return res.status(500).json({ message: 'Razorpay configuration error', redirect: '/paymentfailedpage' });
            }

            try {
                const razorpayOrder = await createRazorpayOrder(finalAmount, userId);
                order.razorpayOrderId = razorpayOrder.id;
                await order.save();
                await Cart.findOneAndDelete({ userId }); 

                return res.status(200).json({
                    message: 'Razorpay order created',
                    razorpayOrder: {
                        id: razorpayOrder.id,
                        amount: razorpayOrder.amount,
                        currency: razorpayOrder.currency,
                        key: process.env.RAZORPAY_KEY_ID,
                    },
                    orderDetails: {
                        orderId: order._id,
                        userId,
                        selectedAddress,
                        cartItems: cart.items.map((item, index) => ({
                            productId: { _id: item.productId._id, salePrice: item.productId.salePrice },
                            quantity: item.quantity,
                            offerId: result[index].bestOffer?._id || null,
                            offerAmount: result[index].bestOffer.discountAmount * item.quantity || 0,
                            couponId: couponApplied ? couponId : null,
                        })),
                        totalPrice,
                        discount,
                        offerDiscount,
                        couponDiscount,
                        finalAmount,
                        walletAmountUsed,
                        couponApplied,
                        adjustedPaymentMethod,
                    },
                });
            } catch (error) {
                order.paymentStatus = 'Failed';
                await order.save();
                await Cart.findOneAndDelete({ userId }); 
                return res.status(500).json({
                    message: 'Failed to create Razorpay order',
                    redirect: '/paymentfailedpage?error=' + encodeURIComponent(error.message),
                });
            }
        }

        if (paymentMethod === 'COD' && finalAmount >= 1000) {
            return res.json({ success: false, message: `${finalAmount} this amount is not allowed in Cash On Delivery` });
        }

        for (const item of cart.items) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity },
            });
        }

        if (paymentMethod === 'Wallet') {
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: -walletAmountUsed },
                    lastUpdated: new Date(),
                }
            );

            const newTransaction = new Transaction({
                userId,
                amount: walletAmountUsed,
                type: 'Debit',
                method: 'OrderPayment',
                status: 'Completed',
                description: 'Payment for order',
                orderId: order._id,
                date: new Date(),
            })
            await newTransaction.save()
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
        return res.status(500).json({ message: error.message || 'Server error', redirect: '/paymentfailedpage' });
    }
};

const verifyRazorpayPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderDetails,
        } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {
            await Order.findOneAndUpdate(
                { _id: orderDetails.orderId },
                { paymentStatus: 'Failed' }
            );
            return res.status(400).json({ message: 'Invalid payment signature', redirect: '/paymentfailedpage' });
        }

        const {
            orderId,
            userId,
            selectedAddress,
            cartItems,
            totalPrice,
            discount,
            offerDiscount,
            couponDiscount,
            finalAmount,
            walletAmountUsed,
            couponApplied,
            adjustedPaymentMethod,
        } = orderDetails;

        if (Math.abs(discount - (offerDiscount + couponDiscount)) > 0.01) {
            console.warn('Discount mismatch in orderDetails:', { discount, offerDiscount, couponDiscount });
            await Order.findOneAndUpdate(
                { _id: orderId },
                { paymentStatus: 'Failed' }
            );
            return res.status(400).json({ message: 'Invalid discount data', redirect: '/paymentfailedpage' });
        }

        const currentDate = new Date();
        const allOffers = await Offer.find({
            isListed: true,
            isDeleted: false,
            validFrom: { $lte: currentDate },
            validUpto: { $gte: currentDate },
        }).lean();

        const products = await Product.find({
            _id: { $in: cartItems.map(item => item.productId._id) },
        });

        const result = cartItems.map(item => {
            const product = products.find(p => p._id.toString() === item.productId._id.toString());
            if (!product) return { bestOffer: { discountAmount: 0, discountType: 'flat' } };

            const offers = allOffers.filter(offer => {
                const offerId = offer.applicableTo?._id?.toString();
                return (
                    offerId === product.category.toString() ||
                    offerId === product.brand._id.toString() ||
                    offerId === product._id.toString()
                );
            });

            const { offer, discountAmount } = getBestOffer(offers, { productId: product });
            return {
                product: item,
                bestOffer: offer ? { _id: offer._id, discountAmount, discountType: offer.discountType } : { discountAmount: 0, discountType: 'flat' },
            };
        });

        let serverOfferDiscount = 0;
        if (result.some(item => item.bestOffer.discountAmount > 0)) {
            serverOfferDiscount = result.reduce((sum, item) => {
                const { bestOffer, product } = item;
                let discount = 0;
                if (bestOffer && bestOffer.discountAmount > 0) {
                    discount = bestOffer.discountAmount * Number(product.quantity);
                    const itemTotal = Number(product.productId.salePrice) * Number(product.quantity);
                    discount = Math.min(discount, itemTotal);
                }
                return sum + discount;
            }, 0);
        }

        if (serverOfferDiscount > totalPrice) {
            console.warn(`Server offer discount (${serverOfferDiscount}) exceeds total price (${totalPrice}). Capping.`);
            serverOfferDiscount = totalPrice;
        }

        let serverCouponDiscount = 0;
        let serverCouponApplied = false;
        let couponId = null;
        if (couponApplied && orderDetails.cartItems.some(item => item.couponId)) {
            const coupon = await Coupon.findById(orderDetails.cartItems[0].couponId);
            if (coupon && coupon.isListed && !coupon.isDeleted && currentDate >= coupon.startDate && currentDate <= coupon.endDate && totalPrice >= coupon.minimumPrice && coupon.offerPrice > 0 ) {
                serverCouponDiscount = Number(coupon.offerPrice);
                serverCouponApplied = true;
                couponId = coupon._id;
            }
        }

        if (serverCouponDiscount > totalPrice - serverOfferDiscount) {
            console.warn(`Server coupon discount (${serverCouponDiscount}) exceeds remaining amount (${totalPrice - serverOfferDiscount}). Capping.`);
            serverCouponDiscount = totalPrice - serverOfferDiscount;
        }

        const serverDiscount = serverOfferDiscount + serverCouponDiscount;
        if (
            Math.abs(serverOfferDiscount - offerDiscount) > 0.01 ||
            Math.abs(serverCouponDiscount - couponDiscount) > 0.01 ||
            Math.abs(serverDiscount - discount) > 0.01
        ) {
            console.warn('Server-side discount mismatch:', {
                client: { orderId, offerDiscount, couponDiscount, discount },
                server: { serverOfferDiscount, serverCouponDiscount, serverDiscount },
            });
            await Order.findOneAndUpdate(
                { _id: orderId },
                { paymentStatus: 'Failed' }
            );
            return res.status(400).json({ message: 'Discount validation failed', redirect: '/paymentfailedpage' });
        }

        const order = await Order.findOneAndUpdate(
            { _id: orderId },
            {
                paymentStatus: 'Completed',
                status: 'Processing',
                razorpayPaymentId: razorpay_payment_id,
                orderedItems: cartItems.map((item, index) => ({
                    product: item.productId._id,
                    orderQuantity: item.quantity,
                    price: Number(item.productId.salePrice),
                    offerId: result[index].bestOffer?._id || null,
                    offerAmount: Number(result[index].bestOffer.discountAmount * item.quantity) || 0,
                    couponId: serverCouponApplied ? couponId : null,
                    returnStatus: 'Not Returned',
                    returnReason: '',
                })),
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found', redirect: '/paymentfailedpage' });
        }

        for (const item of cartItems) {
            await Product.findByIdAndUpdate(item.productId._id, {
                $inc: { quantity: -item.quantity },
            });
        }

        await Cart.findOneAndDelete({ userId });

        return res.status(200).json({
            message: 'Order placed successfully',
            redirect: '/order-success',
        });
    } catch (error) {
        console.error('Error in verifyRazorpayPayment:', error);
        await Order.findOneAndUpdate(
            { _id: req.body.orderDetails.orderId },
            { paymentStatus: 'Failed' }
        );
        return res.status(500).json({ message: error.message || 'Server error', redirect: '/paymentfailedpage' });
    }
};

const retryRazorpayPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user;

        const order = await Order.findById(orderId).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.paymentMethod !== 'Razorpay' || order.paymentStatus !== 'Pending') {
            return res.status(400).json({ success: false, message: 'Invalid order for retry payment' });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: 'Razorpay configuration error' });
        }

        const outOfStockItems = [];
        for (const item of order.orderedItems) {
            const product = item.product;
            if (product.quantity < item.orderQuantity || !product.isListed || product.isDeleted) {
                outOfStockItems.push(product.productName);
            }
        }
        if (outOfStockItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `The following items are out of stock or unavailable: ${outOfStockItems.join(', ')}`,
            });
        }

        const razorpayOrder = await createRazorpayOrder(order.finalAmount, userId);
        await Order.findByIdAndUpdate(orderId, {
            razorpayOrderId: razorpayOrder.id,
            paymentStatus: 'Pending',
        });

        return res.status(200).json({
            success: true,
            message: 'Razorpay order created for retry',
            razorpayOrder: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key: process.env.RAZORPAY_KEY_ID,
            },
            orderDetails: {
                orderId: order._id,
                userId,
                selectedAddress: order.address,
                cartItems: order.orderedItems.map(item => ({
                    productId: { _id: item.product._id, salePrice: item.price },
                    quantity: item.orderQuantity,
                    offerId: item.offerId || null,
                    offerAmount: item.offerAmount || 0,
                    couponId: item.couponId || null,
                })),
                totalPrice: order.totalPrice,
                discount: order.discount,
                offerDiscount: order.offerDiscount,
                couponDiscount: order.couponDiscount,
                finalAmount: order.finalAmount,
                walletAmountUsed: order.walletAmountUsed,
                couponApplied: order.couponApplied,
                adjustedPaymentMethod: order.paymentMethod,
            },
        });
    } catch (error) {
        console.error('Error in retryRazorpayPayment:', error);
        await Order.findByIdAndUpdate(req.body.orderId, { paymentStatus: 'Failed' });
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create retry payment',
            redirect: '/paymentfailedpage',
        });
    }
};

function getBestOffer(applicableOffers, product) {
    if (!Array.isArray(applicableOffers) || applicableOffers.length === 0) {
        return { offer: null, discountAmount: 0 };
    }

    let bestOffer = null;
    let maxDiscount = 0;
    const salePrice = Number(product.productId?.salePrice || product.salePrice || 0);

    if (salePrice <= 0) {
        console.warn(`Invalid sale price for product: ${product.productId?.productName || product.productName || 'Unknown'}`);
        return { offer: null, discountAmount: 0 };
    }

    for (const offer of applicableOffers) {
        let discount = 0;

        if (!offer.discountAmount || offer.discountAmount <= 0) {
            console.warn(`Invalid discount amount for offer: ${offer._id}`);
            continue;
        }

        if (offer.discountType === 'flat') {
            discount = Math.min(Number(offer.discountAmount), salePrice);
        } else if (offer.discountType === 'percentage') {
            discount = Math.min((salePrice * Number(offer.discountAmount)) / 100, salePrice);
        } else {
            console.warn(`Invalid discount type for offer: ${offer._id}`);
            continue;
        }

        if (discount < 0 || discount > salePrice) {
            console.warn(`Invalid discount calculated for offer ${offer._id}: ${discount}, salePrice: ${salePrice}`);
            continue;
        }

        if (discount > maxDiscount) {
            maxDiscount = discount;
            bestOffer = offer;
        }
    }

    console.log(`Best offer for product ${product.productId?.productName || product.productName || 'Unknown'}:`, {
        offerId: bestOffer?._id,
        discountAmount: maxDiscount,
        discountType: bestOffer?.discountType,
    });

    return { offer: bestOffer, discountAmount: maxDiscount };
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
        const { page = 1 } = req.query;
        const limit = 5;
        const skip = (page - 1) * limit;

        const user = await User.findById(userId);
        const totalOrders = await Order.countDocuments({ userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId })
            .populate('orderedItems.product')
            .skip(skip)
            .limit(limit)
            .sort({createdAt:-1})

        res.render('userOrder', {
            orderData: orders,
            user,
            currentPage: parseInt(page),
            totalPages
        });
    } catch (error) {
        console.error('Error in listOrder:', error);
        res.redirect('/pageNotFound');
    }
};

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
        order.cancelledAmount = order.finalAmount;
        order.orderedItems.forEach(item => {
            item.returnStatus = 'Cancelled';
        });
        

        if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Completed') {
            await Wallet.findOneAndUpdate(
                { userId },
                {
                    $inc: { balance: order.finalAmount },
                },
                { upsert: true }
            );
        }

        const newTransaction = new Transaction({
            userId,
            amount: order.finalAmount,
            type: 'Credit',
            method: 'Refund',
            status: 'Completed',
            description: 'Order Cancelled',
            orderId: order._id,
            date: new Date(),
    
        })
        await newTransaction.save()
        order.finalAmount = 0
        await order.save();

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

const loadPaymentFailedPage = (req, res) => {
    try {
        const errorReason = req.query.error ? decodeURIComponent(req.query.error) : null;
        console.log('Query params:', req.query);
        
        res.render('paymentfailedpage', { errorReason });
    } catch (error) {
        console.error('Error in loadPaymentFailedPage:', error);
        res.render('paymentfailedpage', { errorReason: null });
    }
};

module.exports = {
    placeOrder,
    verifyRazorpayPayment,
    loadOrderSuccess,
    listOrder,
    loadOrdDetailes,
    invoicePdf,
    cancelOrder,
    singleCancel,
    returnProduct,
    loadPaymentFailedPage,
    retryRazorpayPayment,
};