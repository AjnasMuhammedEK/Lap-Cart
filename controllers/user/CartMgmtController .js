const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart =  require('../../models/cartSchema');
const WishList = require('../../models/wishlistSchema');
const Address = require('../../models/addressSchema'); 
 
  

const loadCart = async (req, res) => {
  try {
    const userId = req.session && req.session.user ? req.session.user : null;
    const user = await User.findById(userId);

     

    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart) {
      return res.render('cart', { 
        user: user,
        cartItems: [],
        subtotal: 0,
        total: 0 
      });
    }

    const cartItems = cart.items;
    const subtotal = cartItems.reduce((sum, item) => sum + (item.productId.regularPrice * item.quantity), 0);
    const total = cartItems.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);

    res.render('cart', { 
      user: user,
      cartItems: cartItems,
      subtotal: subtotal,
      total: total 
    });
  } catch (error) {
    console.log('Error in cart', error);
    res.redirect('/pageNotFound');
  }
};

const addToCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: 'Product not found' });
    }

    const category = await Category.findById(product.category);
    if (!product.isListed || product.isDeleted || !category.isListed || category.isDeleted) {
      return res.status(400).json({ message: 'Product or category is not available' });
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
      cart.items[itemIndex].totalPrice = newQuantity * product.salePrice;
    } else {
      cart.items.push({
        productId,
        quantity: parseInt(quantity),
        price: product.salePrice,
        totalPrice: product.salePrice * parseInt(quantity),
      });
    }

    await cart.save();

    const wishlist = await WishList.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
      await wishlist.save();
    }

    res.status(200).json({ 
      message: 'Product added to cart successfully',
      redirect: `/productDetaile?id=${productId}`
    });
  } catch (error) {
    console.log('Error in manageAddToCart', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const manageCartQuantity = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId, action } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(400).json({ message: 'Cart not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(400).json({ message: 'Product not found' });
    }

    const itemIndex = cart.items.findIndex((item) => 
      item.productId.toString() === productId
    );
    if (itemIndex === -1) {
      return res.status(400).json({ message: 'Product not in cart' });
    }

    let newQuantity = cart.items[itemIndex].quantity;

    if (action === 'increment') {
      newQuantity += 1;
      if (newQuantity > product.quantity) {
        return res.status(400).json({ 
          message: `Cannot add more. Only ${product.quantity} items left in stock` 
        });
      }
    } else if (action === 'decrement') {
      newQuantity -= 1;
      if (newQuantity < 1) {
        return res.status(400).json({ 
          message: 'Quantity cannot be less than 1' 
        });
      }
    }

    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].totalPrice = newQuantity * product.salePrice;

    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate('items.productId');
    const subtotal = updatedCart.items.reduce((sum, item) => 
      sum + (item.productId.regularPrice * item.quantity), 0
    );
    const total = updatedCart.items.reduce((sum, item) => 
      sum + (item.productId.salePrice * item.quantity), 0
    );

    res.status(200).json({ 
      message: 'Quantity updated', 
      cart: updatedCart, 
      subtotal: subtotal,
      total: total 
    });
  } catch (error) {
    console.log('Error in manageCartQuantity', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteCart = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(400).json({ message: 'Cart not found' });
    }

    cart.items = cart.items.filter((item) => 
      item.productId.toString() !== productId
    );
    await cart.save();

    const updatedCart = await Cart.findOne({ userId }).populate('items.productId');
    const subtotal = updatedCart ? 
      updatedCart.items.reduce((sum, item) => sum + (item.productId.regularPrice * item.quantity), 0) : 
      0;
    const total = updatedCart ? 
      updatedCart.items.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0) : 
      0;

    res.status(200).json({ 
      message: 'Product removed from cart', 
      cart: updatedCart, 
      subtotal: subtotal,
      total: total 
    });
  } catch (error) {
    console.log('Error in manageDeleteCart', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const cartCheckout = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
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

    res.status(200).json({ message: 'Cart validated successfully' });
  } catch (error) {
    console.log('Error in manageCartCheckout', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const loadWhishList = async (req, res) => {
  try {
    const userId = req.session.user;
    const wishlist = await WishList.findOne({ userId }).populate('products.productId');

    res.render('wishlist', { data: wishlist || { products: [] } });
  } catch (error) {
    console.log('Error in loadWhishList:', error);
    res.status(500).render('wishlist', { 
      data: { products: [] },
      error: 'Failed to load wishlist'
    });
  }
};

const addWhishList = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId = req.query.productId;

    const product = await Product.findOne({ _id: productId });
    const user = await User.findOne({ _id: userId });

    if (!product || !user) {
      return res.status(404).json({ message: 'Product or user not found' });
    }

    const cart = await Cart.findOne({ userId });
    if (cart && cart.items.some(item => item.productId.toString() === productId)) {
      return res.status(400).json({
        message: 'This product is already in your cart',
        redirect: '/productDetaile'
      });
    }

    let userWishlist = await WishList.findOne({ userId });
    
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
      return res.status(400).json({ 
        message: 'This product is already in your wishlist',
        redirect: '/productDetaile'
      });
    }

    userWishlist.products.push({ 
      productId: productId,
      addedOn: Date.now()  
    });

    await userWishlist.save();

    res.status(200).json({ 
      message: 'Product added to wishlist successfully',
      redirect: '/whishlist'
    });
  } catch (error) {
    console.log('Error adding to wishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const wishlist = await WishList.findOne({ userId });
    if (!wishlist) {
      return res.status(400).json({ message: 'Wishlist not found' });
    }

    wishlist.products = wishlist.products.filter(
      (item) => item.productId.toString() !== productId
    );
    await wishlist.save();

    res.status(200).json({ 
      message: 'Product removed from wishlist successfully' 
    });
  } catch (error) {
    console.log('Error in removeFromWishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const addToCartFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isListed || product.isDeleted) {
      return res.status(400).json({ message: 'Product not available' });
    }

    if (product.quantity < 1) {
      return res.status(400).json({ message: 'Product out of stock' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const itemIndex = cart.items.findIndex((item) => 
      item.productId.toString() === productId
    );

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += 1;
      cart.items[itemIndex].totalPrice = cart.items[itemIndex].quantity * cart.items[itemIndex].price;
    } else {
      cart.items.push({
        productId,
        quantity: 1,
        price: product.salePrice,
        totalPrice: product.salePrice,
      });
    }

    await cart.save();

    const wishlist = await WishList.findOne({ userId });
    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        (item) => item.productId.toString() !== productId
      );
      await wishlist.save();
    }

    res.status(200).json({ 
      message: 'Product added to cart and removed from wishlist',
      redirect: '/cart'
    });
  } catch (error) {
    console.log('Error in addToCartFromWishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;
    const address = await Address.findOne({ userId });
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    const cartItems = cart.items;
    const subTotal = cartItems.reduce((sum, item) => sum + (item.productId.regularPrice * item.quantity), 0);

    const totalAmount = cartItems.reduce((sum, item) => sum + (item.productId.salePrice * item.quantity), 0);
    const Discount = cartItems.reduce((sum, item) => sum + ((item.productId.regularPrice - item.productId.salePrice) * item.quantity), 0);
    
    res.render('checkout', {
      address: address,
      cart: cart,
      total: totalAmount,
      subtotal : subTotal,
      Discount: Discount
    });
  } catch (error) {
     
  }
};

const checkoutAddAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findOne({_id: userId});
        const {addressType, name, city, landMark, state, pincode, phone} = req.body;
         
        const userAddress = await Address.findOne({userId: userData._id});
        
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{addressType, name, city, landMark, state, pincode, phone}]
            });
            await newAddress.save();
         } else {
             userAddress.address.push({addressType, name, city, landMark, state, pincode, phone});
            await userAddress.save();   
        }
        console.log('4');

        res.redirect('/checkout');
    } catch (error) {
        console.error('error from newAddress save', error);
        res.redirect('/pageNotFound');
    }
};

const checkoutEditAddress = async (req, res) => {
    try {
      console.log('from edut');
         const userId = req.session.user;

        const { addressId , addressType, name, city, landMark, state, pincode, phone } = req.body;

        console.log(addressId);
        const findAddress =  await Address.findOne({
            'address._id': addressId
        });
        if(!findAddress){
            return res.redirect('/pageNotFound');
        }
        await Address.updateOne(
            { 'address._id': addressId },
            {
                $set: {
                    'address.$.addressType': addressType,
                    'address.$.name': name,
                    'address.$.city': city,
                    'address.$.landMark': landMark,
                    'address.$.state': state,
                    'address.$.pincode': pincode,
                    'address.$.phone': phone
                }
            }
        );

        return res.redirect('/checkout');
        


    } catch (error) {
        console.error('Error in edit address:', error);
       
        return res.redirect('/pageNotFound');
        
    }
};

module.exports = {
  loadCart,
  addToCart,
  manageCartQuantity,
  deleteCart,
  cartCheckout,
  loadWhishList,
  addWhishList,
  removeFromWishlist,
  addToCartFromWishlist,
  loadCheckOut,
  checkoutAddAddress,
  checkoutEditAddress
};