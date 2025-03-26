const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Cart =  require('../../models/cartSchema')
const WishList = require('../../models/wishlistSchema')
// const Address = require('../../models/addressSchema') 
// const nodemailer = require('nodemailer')
// const env = require("dotenv").config()
// const bcrypt = require('bcrypt')


// const loadCart = async (req,res) => {
//     try {


        


 

//         res.render('cart')
        
//     } catch (error) {
        
//     }
// }

// const addToCart = async (req,res) => {
//     try {

//         const userId = req.session.user
//         const userData = await User.findOne({_id: userId})
        

//         const productId = req.query.productId
//         console.log(`this is product id ${productId}`);
//         const product = await Product.findOne({_id:productId})
//         console.log(product);

//         const userCart = await Cart.findOne({userId:userId})
//         console.log(object);

//         if(!userCart){
//             const newCart = new Cart({
//                 userId: userData._id,
//                 items:[{
//                     productId,
//                     price:product.price
//                 }]
//             })
//             await newCart.save()
//         }else{
//             userCart.cart.push({productId})
//             await userCart.save()
//         }


//         res.redirect('/cart')
        
        
//     } catch (error) {
        
//     }
// }
//  module.exports = {
//     loadCart,
//     addToCart
// }
const manageGetCartPage = async (req, res) => {
  try {

    const userId = req.session && req.session.user ? req.session.user : null;
    console.log("User ID:", userId);
    const user = await User.findById(userId);

    if (!user) {
      console.log("No user found, redirecting to login");
      return res.redirect("/login");
    }

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    console.log("Cart:", cart);

    if (!cart) {
      console.log("No cart found, rendering empty cart");
      return res.render("cart", { 
        user: user,
        cartItems: [],
        total: 0 
      });
    }

    const cartItems = cart.items;
    const total = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
    console.log("Cart Items:", cartItems);
    console.log("Total:", total);

    res.render("cart", { 
      user: user,
      cartItems: cartItems,
      total: total 
    });
  } catch (error) {
    console.log("Error in manageGetCartPage:", error);
    res.redirect("/pageNotFound");
  }
};

const manageAddToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    const category = await Category.findById(product.category);

    if (!product.isListed || product.isDeleted) {
      return res.status(400).json({ message: "Product is not available" });
    }

    if (!category.isListed || category.isDeleted) {
      return res.status(400).json({ message: "Category is not available" });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ 
        message: `Only ${product.quantity} items left in stock` 
      });
    }

    let cart = await Cart.findOne({ userId });
    
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => 
      item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      const newQuantity = cart.items[itemIndex].quantity + parseInt(quantity);
      if (newQuantity > product.quantity) {
        return res.status(400).json({ 
          message: `Cannot add more. Only ${product.quantity} items left in stock` 
        });
      }
      cart.items[itemIndex].quantity = newQuantity;
      cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;
    } else {
      cart.items.push({
        productId,
        quantity: parseInt(quantity),
        price: product.salePrice,
        totalPrice: product.salePrice * parseInt(quantity),
      });
    }

    await cart.save();
    // Redirect back to product detail page instead of cart
    res.status(200).json({ 
      message: "Product added to cart",
      redirect: `/productDetaile?id=${productId}`
    });
  } catch (error) {
    console.log("Error in manageAddToCart", error);
    res.status(500).json({ message: "Server error" });
  }
};

const manageCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, action } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(400).json({ message: "Cart not found" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    const itemIndex = cart.items.findIndex((item) => 
      item.productId.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(400).json({ message: "Product not in cart" });
    }

    let newQuantity = cart.items[itemIndex].quantity;

    if (action === "increment") {
      newQuantity += 1;
      if (newQuantity > product.quantity) {
        return res.status(400).json({ 
          message: `Cannot add more. Only ${product.quantity} items left in stock` 
        });
      }
    } else if (action === "decrement") {
      newQuantity -= 1;
      if (newQuantity < 1) {
        return res.status(400).json({ 
          message: "Quantity cannot be less than 1" 
        });
      }
    }

    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].totalPrice = newQuantity * cart.items[itemIndex].price;

    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
    const total = updatedCart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    res.status(200).json({ message: "Quantity updated", cart: updatedCart, total });
  } catch (error) {
    console.log("Error in manageCartQuantity", error);
    res.status(500).json({ message: "Server error" });
  }
};

const manageDeleteCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(400).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((item) => 
      item.productId.toString() !== productId
    );
    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate("items.productId");
    const total = updatedCart ? 
      updatedCart.items.reduce((sum, item) => sum + item.totalPrice, 0) : 
      0;

    res.status(200).json({ 
      message: "Product removed from cart", 
      cart: updatedCart, 
      total 
    });
  } catch (error) {
    console.log("Error in manageDeleteCart", error);
    res.status(500).json({ message: "Server error" });
  }
};

const manageCartCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
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

    res.status(200).json({ message: "Cart validated successfully" });
  } catch (error) {
    console.log("Error in manageCartCheckout", error);
    res.status(500).json({ message: "Server error" });
  }
};


const loadWhishList = async (req,res) => {
  try {

    const userId = req.session.user
     const wishlist = await WishList.findOne({ userId }).populate("products.productId");

     res.render("wishlist", { data: wishlist || { products: [] } }); // Ensure data is not null

    
  } catch (error) {
    
  }
}

// const addWhishList = async (req,res) => {
//   try {

//     const userId = req.session.user
//     const productId = req.query.productId 

//     console.log('1');

//     const product = await Product.findOne({_id:productId})
//     const user = await User.findOne({_id:userId})

//     console.log('2');


//     const userWhislist = await WhisList.findById(userId)
//     console.log(userWhislist);
//     console.log('3');

//     if(!userWhislist){
//       const whisList = new WhisList({userId, products : []})
//     }

//     console.log('4');

//     // const existProduct = userWhislist.products.some((item)=>item.productId.toString()===productId)

//     // if(existProduct){
//     //   return
//     // }
//     console.log('5');

//     userwishlist.products.push({ productId });

//     await userWhislist.save()
//     console.log('6');

//     res.redirect('/whishlist')
 
//      console.log(product);
//      console.log(user);
    
//   } catch (error) { 
    
//   }
// }



const addWhishList = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.query.productId;

     const product = await Product.findOne({ _id: productId });
    const user = await User.findOne({ _id: userId });

    if (!product) {
      return res.status(404).send('Product not found');
    }
    if (!user) {
      return res.status(404).send('User not found');
    }

     let userWishlist = await WishList.findOne({ userId: userId });
    
    if (!userWishlist) {
       userWishlist = new WishList({
        userId: userId,
        products: []
      });
    }

     const existProduct = userWishlist.products.some(
      (item) => item.productId.toString() === productId
    );

    if (existProduct) {
      return res.redirect('/productDetaile')
    }

     userWishlist.products.push({ 
      productId: productId,
      addedOn: Date.now()  
    });

     await userWishlist.save();

     res.redirect('/whishlist');

  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).send('Server error');
  }
};
module.exports = {
  manageGetCartPage,
  manageAddToCart,
  manageCartQuantity,
  manageDeleteCart,
  manageCartCheckout,
  loadWhishList,
  addWhishList
};