const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart =  require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const WishList = require('../../models/wishlistSchema');
const Address = require('../../models/addressSchema'); 
const pdfpdfument = require('pdfkit');
const fs = require('fs');
const path = require('path');
  

 const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddressId, paymentMethod } = req.body;

    const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const addresspdf = await Address.findOne({ userId });

    if (!user || !cart || !addresspdf) {
      return res.status(400).json({ message: 'User, cart, or address not found' });
    }

     const selectedAddress = addresspdf.address.find(addr => 
      addr._id.toString() === selectedAddressId
    );
    if (!selectedAddress) {
      return res.status(400).json({ message: 'Selected address not found' });
    }

     let outOfStockItems = [];
    for (let item of cart.items) {
      const product = item.productId;
      if (product.quantity < item.quantity || !product.isListed || product.isDeleted) {
        outOfStockItems.push(product.productName);
      }
    }
    if (outOfStockItems.length > 0) {
      return res.status(400).json({ 
        message: `The following items are out of stock or unavailable: ${outOfStockItems.join(', ')}` 
      });
    }

     const subtotal = cart.items.reduce((sum, item) => 
      sum + (item.productId.regularPrice * item.quantity), 0);
    const discount = cart.items.reduce((sum, item) => 
      sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0);
    const finalAmount = cart.items.reduce((sum, item) => 
      sum + (item.productId.salePrice * item.quantity), 0);

     const order = new Order({
      userId,
      orderedItems: cart.items.map(item => ({
        product: item.productId._id,
        orderQuantity: item.quantity,
        price: item.productId.salePrice
      })),
      totalPrice: subtotal,
      discount: discount,
      finalAmount: finalAmount,
      address: {
        addressType: selectedAddress.addressType,
        name: selectedAddress.name,
        city: selectedAddress.city,
        landmark: selectedAddress.landMark,
        state: selectedAddress.state,
        pincode: selectedAddress.pincode,
        phone: selectedAddress.phone
      },
      paymentMethod: paymentMethod,
      status: paymentMethod === 'COD' ? 'Pending' : 'Processing'
    });

     for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      });
    }

     await order.save();
    await Cart.findOneAndDelete({ userId });

    res.status(200).json({
      message: 'Order placed successfully',
      orderId: order.orderId,
      redirect: '/order-success'
    });

  } catch (error) {
    console.log('Error in placeOrder:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

 const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const order = await Order.findOne({ userId }).sort({ createdAt: -1 })
      .populate('orderedItems.product');

    if (!order) {
      return res.redirect('/pageNotFound');
    }

    res.render('successPage', {
      user: await User.findById(userId),
      order: order
    });
  } catch (error) {
    console.log('Error in loadOrderSuccess:', error);
    res.redirect('/pageNotFound');
  }
};


const listOrder = async (req,res) => {
  try {

    const user = req.session.user;
    const userdata = await User.findById(user);

    const userId = req.session.user;
    const userData =await User.findOne({_id:userId});
    const OrderData = await Order.find({userId : userId}).populate('orderedItems.product');
 
    res.render('userOrder',{
      orderData:OrderData,
      user : userdata
    });
    
  } catch (error) {
    console.log('error from listOrder',error);

  }
};

  

const loadOrdDetailes = async (req,res) => {
  try {
    const user = req.session.user;
    const userdata = await User.findById(user);

    const {orderId }= req.query;
    
 
    const orderData = await Order.findOne({_id:orderId}).populate('orderedItems.product');
    res.render('ord-detailes',{
      orderData : orderData,
      user : userdata
    });
     
  } catch (error) {

    console.log('error from loadOrdDetailes',error);
    
  }
 
};

const invoicePdf = async (req, res) => {

  try {
      
      const { orderId } = req.query;
      console.log("orderid",orderId)
      const userId = req.session.user;

      const user = await User.findById(userId);
      if (!user) {
          return res.redirect("/pageNotFound");
      }

      const orderData = await Order.findOne({ _id: orderId })
          .populate("orderedItems.product")
          .populate("userId");

      if (!orderData) {
          return res.redirect("/pageNotFound");
      }

      res.render("invoice", {
          user: user,
          orderData: orderData,
          orderDate: orderData.invoiceDate.toLocaleDateString(),
          invoiceNumber: orderData._id
      });

  } catch (error) {
      console.log("error in getInvoice", error);
      return res.redirect("/pageNotFound");
  }
};






const cancelOrder = async (req,res) => {
  try {

    const {orderId} = req.query;
    console.log(orderId);

    const orderData = await Order.findOne({_id:orderId}).populate('orderedItems.product');

    const updated = await Order.findOneAndUpdate({_id:orderId},{$set:{status:'cancelled'}},{ new: true } );
    
   

    if(updated){
      res.json({success:true,message:'Your Order is Cancelled'});
    }else{
      res.json({success:false,message:'Something Went Wrong'});
    }
    console.log(orderData);
    for (const item of orderData.orderedItems) {
      await Product.findByIdAndUpdate(
        item.product._id,
        { $inc: { quantity: item.orderQuantity } }
      );
    }
    
  } catch (error) {

    console.log('error from cancel order',error);
    res.redirect('/pageNotFound');
    
  }
};

const returnProduct = async (req, res) => {
  try {
      

      const { productId, reason, orderID } = req.body;


       const orderData = await Order.findOne({ _id: orderID, 'orderedItems.product': productId });
      
       if (!orderData) {
          return res.status(400).json({ success: false, message: "Order not found" });
      }

       const itemIndex = orderData.orderedItems.findIndex(item => item.product.toString() === productId);
      if (itemIndex === -1) {
          return res.status(400).json({ success: false, message: "Product not found in order" });
      }

       orderData.orderedItems[itemIndex].returnStatus = "Return Requested";
      orderData.orderedItems[itemIndex].returnReason = reason;
 
 
      await orderData.save();

      return res.status(200).json({ success: true, message: "Return request submitted successfully" });

  } catch (error) {
      console.log("Error in returnProduct:", error);
      return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
 
  placeOrder,           
  loadOrderSuccess,        
  listOrder,
  loadOrdDetailes,
  invoicePdf,
  cancelOrder,
  returnProduct
};