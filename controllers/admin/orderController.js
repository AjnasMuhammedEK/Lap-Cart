const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema')





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
        console.log('Handling return:', action, itemId, orderId);

        const order = await Order.findOne({ _id: orderId }).populate('orderedItems.product');
  
        if (!order) {
            return res.json({ success: false, message: "Order Not Found" });
        }

        if (action === "accept") {
            const updatedOrder = await Order.findOneAndUpdate(
                { _id: orderId, "orderedItems._id": itemId },
                { $set: { "orderedItems.$.returnStatus": "Returned" } },
                { new: true }
            ).populate('orderedItems.product');

            if (!updatedOrder) {
                return res.json({ success: false, message: "Failed to update return status" });
            }

            const returnedItem = updatedOrder.orderedItems.find(item => item._id.toString() === itemId.toString());

            const userId = req.session.user;
            const product = returnedItem.product;
            updatedOrder.finalAmount = updatedOrder.finalAmount - product.salePrice 
            const wallet = await Wallet.findOneAndUpdate({userId:userId},{ $inc: { balance: product.salePrice -updatedOrder.discount }},{new:true})
            wallet.transactions.push({
                amount: product.salePrice -updatedOrder.discount,
                type: "Credit",
                method: "Refund",
                status: "Completed",
                description: "Product Cancelled"
              });
              await wallet.save() 
            
            if (returnedItem && returnedItem.returnStatus === "Returned") {
                await Product.findByIdAndUpdate(
                    returnedItem.product._id,
                    { $inc: { quantity: returnedItem.orderQuantity } },
                    { new: true }
                );
            }




            return res.json({ success: true, message: "Order Return Accepted" });

        } else if (action === "reject") {
            const updateProductStatusR = await Order.findOneAndUpdate(
                { _id: orderId, "orderedItems._id": itemId },
                { $set: { "orderedItems.$.returnStatus": "Return Rejected" } },
                { new: true }
            );
            return res.json({ success: true, message: "Order Return Rejected" });

        } else {
            return res.json({ success: false, message: "WRONG !!" });
        }

    } catch (error) {
        console.error('Error in handleReturn', error);
        res.redirect('/pageNotFound')
     }
};

module.exports = {
    orderList,
    orderDetaile,
    changeStatus,
    handleReturn
};