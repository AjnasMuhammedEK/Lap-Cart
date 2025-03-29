const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Cart =  require('../../models/cartSchema')
const Order = require('../../models/orderSchema')
const WishList = require('../../models/wishlistSchema')
const Address = require('../../models/addressSchema') 
 

 const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user;
    const { selectedAddressId, paymentMethod } = req.body;

     const user = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const addressDoc = await Address.findOne({ userId });

    if (!user || !cart || !addressDoc) {
      return res.status(400).json({ message: "User, cart, or address not found" });
    }

     const selectedAddress = addressDoc.address.find(addr => 
      addr._id.toString() === selectedAddressId
    );
    if (!selectedAddress) {
      return res.status(400).json({ message: "Selected address not found" });
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
        message: `The following items are out of stock or unavailable: ${outOfStockItems.join(", ")}` 
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
        quantity: item.quantity,
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
      status: paymentMethod === "COD" ? "Pending" : "Processing"
    });

     for (let item of cart.items) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { quantity: -item.quantity }
      });
    }

     await order.save();
    await Cart.findOneAndDelete({ userId });

    res.status(200).json({
      message: "Order placed successfully",
      orderId: order.orderId,
      redirect: "/order-success"
    });

  } catch (error) {
    console.log("Error in placeOrder:", error);
    res.status(500).json({ message: "Server error" });
  }
};

 const loadOrderSuccess = async (req, res) => {
  try {
    const userId = req.session.user;
    const order = await Order.findOne({ userId }).sort({ createdAt: -1 })
      .populate("orderedItems.product");

    if (!order) {
      return res.redirect("/pageNotFound");
    }

    res.render("successPage", {
      user: await User.findById(userId),
      order: order
    });
  } catch (error) {
    console.log("Error in loadOrderSuccess:", error);
    res.redirect("/pageNotFound");
  }
};

  
module.exports = {
 
  placeOrder,           
  loadOrderSuccess   
};