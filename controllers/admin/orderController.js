const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema')
const Coupon = require('../../models/couponSchema')
const Offer = require('../../models/offerSchema')





const orderList = async (req, res) => { 
    try {
        const search = req.query.search || ""; 
        const page = parseInt(req.query.page) || 1;  
        const limit = 5; 
        const skip = (page - 1) * limit; 
        let query = {};
        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: "i" } },
                { 
                    "userId": { 
                        $in: await User.find({ 
                            name: { $regex: search, $options: "i" } 
                        }).select('_id')
                    }
                }
            ];
        }

         const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

         const orderData = await Order.find(query)
            .populate('orderedItems.product')
            .populate('userId')
            .sort({ createdAt: -1 })  
            .skip(skip)
            .limit(limit);

        res.render('orderList', {
            orderData: orderData,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            searchQuery: search
        });

    } catch (error) {
        console.error('Error in orderList:', error);
        res.redirect('/pageNotFound');
    }
};
const orderDetaile = async (req,res) => {
    try {

        const orderId = req.query.orderId;
        const orderData = await Order.findOne({_id:orderId}).populate('orderedItems.product').populate('userId');
         res.render('detail-ord',{
            orderData:orderData
        });
        
    } catch (error) {
        console.error('Error in orderDetaile', error);
        res.redirect('/pageNotFound')

    }
};
 
const changeStatus = async (req,res)=>{
    try {

        const {status,orderId} = req.body
        console.log(status,orderId);

        const order = await Order.findOne({_id:orderId}).populate('orderedItems.product')

        const updateOrder = await Order.findOneAndUpdate({_id:orderId},{$set:{status:status}},{new:true})


        if(!updateOrder){
           return res.json({success:false,message:"order Does not Available"})
        }

        if(order.status === "Returned"){
            for(let item of order.orderedItems){
                item.returnStatus === "Returned"
            }
        }

        res.json({success:true,message:"status Updated"})
      } catch (error) {
        console.error('Error in changeStatus', error);
        res.redirect('/pageNotFound')

        
    }
}


 

const handleReturn = async (req, res) => {
    try {
        const { action, itemId, orderId } = req.body;
        //console.log('Handling return:', action, itemId, orderId);

        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
        if (!order) {
            return res.json({ success: false, message: 'Order Not Found' });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item._id.toString() === itemId.toString()
        );
        if (itemIndex === -1) {
            return res.json({ success: false, message: 'Item not found in order' });
        }

        const item = order.orderedItems[itemIndex];
        if (item.returnStatus !== 'Return Requested') {
            return res.json({ success: false, message: 'Invalid return status for item' });
        }

        if (action === 'accept') {
            const itemTotalPrice = item.orderQuantity * item.price;
            const itemOfferAmount = item.offerAmount || 0;

            let refundAmount = itemTotalPrice - itemOfferAmount;
            if (refundAmount < 0) {
                console.warn(`Refund amount negative for item ${itemId}. Setting to 0.`);
                refundAmount = 0;
            }

            let couponInvalidated = false;
            if (order.couponApplied && order.couponDiscount > 0 && order.cancelledCouponAmount === 0) {
                const coupon = await Coupon.findById(item.couponId);
                if (coupon) {
                    const remainingPrice = order.orderedItems.reduce((sum, currItem, index) => {
                        if (
                            index !== itemIndex &&
                            (currItem.returnStatus === 'Not Returned' ||
                             currItem.returnStatus === 'Return Requested')
                        ) {
                            return sum + (currItem.orderQuantity * currItem.price - (currItem.offerAmount || 0));
                        }
                        return sum;
                    }, 0);

                    if (remainingPrice < coupon.minimumPrice) {
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

            order.orderedItems[itemIndex].returnStatus = 'Returned';
            order.returnAmount = (order.returnAmount || 0) + refundAmount;

             const remainingItemsPrice = order.orderedItems.reduce((sum, currItem) => {
                if (
                    currItem.returnStatus === 'Not Returned' ||
                    currItem.returnStatus === 'Return Requested'
                ) {
                    return sum + (currItem.orderQuantity * currItem.price - (currItem.offerAmount || 0));
                }
                return sum;
            }, 0);

             order.finalAmount = remainingItemsPrice;
             if (order.cancelledCouponAmount === 0 && order.couponDiscount > 0) {
                order.finalAmount -= order.couponDiscount;
            }
            if (order.finalAmount < 0) {
                console.warn(`Order finalAmount negative after return. Setting to 0.`);
                order.finalAmount = 0;
            }

             await order.save();

            const userId = order.userId;
            if (refundAmount > 0 && order.paymentMethod !== 'COD') {
                const wallet = await Wallet.findOneAndUpdate(
                    { userId },
                    {
                        $inc: { balance: refundAmount },
                        $push: {
                            transactions: {
                                amount: refundAmount,
                                type: 'Credit',
                                method: 'Refund',
                                status: 'Completed',
                                description: `Refund for returned product ${item.product.productName}`,
                                orderId:order._id,
                                date: new Date(),
                            },
                        },
                    },
                    { upsert: true, new: true }
                );
                await wallet.save();
            }

             await Product.findByIdAndUpdate(
                item.product._id,
                { $inc: { quantity: item.orderQuantity } },
                { new: true }
            );

            return res.json({ success: true, message: 'Order Return Accepted' });
        } else if (action === 'reject') {
            order.orderedItems[itemIndex].returnStatus = 'Return Rejected';
            await order.save();
            return res.json({ success: true, message: 'Order Return Rejected' });
        } else {
            return res.json({ success: false, message: 'Invalid action' });
        }
    } catch (error) {
        console.error('Error in handleReturn:', error);
        return res.json({ success: false, message: 'Server error' });
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

module.exports = {
    orderList,
    orderDetaile,
    changeStatus,
    handleReturn
};