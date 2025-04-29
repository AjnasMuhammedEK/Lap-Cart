const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const WishList = require('../../models/wishlistSchema');
const Address = require('../../models/addressSchema');
const Offer = require('../../models/offerSchema');
const Coupon = require('../../models/couponSchema');

const loadCart = async (req, res) => {
  try {
    const userId = req.session && req.session.user ? req.session.user : null;
    const user = await User.findById(userId);

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: {
        path: 'brand',
      },
    });

    if (!cart) {
      return res.render('cart', {
        user: user,
        cartItems: [],
        subtotal: 0,
        total: 0,
        totalDiscount: 0,
        coupons: [],
        appliedCoupon: null,
        couponDiscount: 0,
        result: [],
      });
    }

    const product = cart.items;

    const currentDate = new Date();
    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    const coupons = await Coupon.find({
      isListed: true,
      isDeleted: false,
      startDate: { $lte: currentDate },
      endDate: { $gte: currentDate },
    }).lean();

    const result = product.map((product) => {
      const offers = allOffers.filter((item) => {
        const offerId = item.applicableTo?._id?.toString();
        return (
          offerId === product.productId.category.toString() ||
          offerId === product.productId.brand._id.toString() ||
          offerId === product.productId._id.toString()
        );
      });

      const bestOffer = getBestOffer(offers, product);

      return {
        product,
        bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
      };
    });

    const cartItems = cart.items;

    const subtotal = result.reduce((sum, item) => sum + item.product.totalPrice, 0);

    const totalDiscount = result.reduce((sum, item) => {
      const { bestOffer, product } = item;
      let discount = 0;
      if (bestOffer && bestOffer.discountAmount > 0) {
        if (bestOffer.discountType === 'flat') {
          discount = bestOffer.discountAmount * product.quantity;
        } else if (bestOffer.discountType === 'percentage') {
          discount = (product.totalPrice * bestOffer.discountAmount) / 100;
        }
      }
      return sum + discount;
    }, 0);

    let couponDiscount = 0;
    let appliedCoupon = null;
    const selectedCouponId = req.session.appliedCoupon;

    if (selectedCouponId) {
      const coupon = await Coupon.findById(selectedCouponId);
      if (
        coupon &&
        coupon.isListed &&
        !coupon.isDeleted &&
        currentDate >= coupon.startDate &&
        currentDate <= coupon.endDate &&
        subtotal >= coupon.minimumPrice
      ) {
        couponDiscount = coupon.offerPrice;
        appliedCoupon = coupon;
      } else {
        req.session.appliedCoupon = null;
      }
    }

    let total = subtotal - totalDiscount - couponDiscount;
    if (total < 0) total = 0;

    res.render('cart', {
      user: user,
      cartItems: cartItems,
      subtotal: subtotal,
      total: total,
      totalDiscount: totalDiscount,
      result: result,
      coupons: coupons,
      appliedCoupon: appliedCoupon,
      couponDiscount: couponDiscount,
    });
  } catch (error) {
    console.log('Error in cart', error);
    res.redirect('/pageNotFound');
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
      if (newQuantity === 5) {
        return res.status(400).json({ message: "You Have purchase Only 5 " });
      }
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
      } else if (newQuantity > 5) {
        return res.status(400).json({ 
          message: "Limit reached! Maximum 5 items allowed per customer." 
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

    const updatedCart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'brand' }
    });

    const cartProduct = updatedCart.items;

    const currentDate = new Date();
    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    const result = cartProduct.map((product) => {
      const offers = allOffers.filter((item) => {
        const offerId = item.applicableTo?._id?.toString();
        return (
          offerId === product.productId.category.toString() ||
          offerId === product.productId.brand._id.toString() ||
          offerId === product.productId._id.toString()
        );
      });

      const bestOffer = getBestOffer(offers, product);

      return {
        product,
        bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
      };
    });

    const subtotal = result.reduce(
      (sum, item) => sum + item.product.totalPrice,
      0
    );

    const totalDiscount = result.reduce((sum, item) => {
      const { bestOffer, product } = item;
      let discount = 0;
      if (bestOffer && bestOffer.discountAmount > 0) {
        if (bestOffer.discountType === 'flat') {
          discount = bestOffer.discountAmount * product.quantity;
        } else if (bestOffer.discountType === 'percentage') {
          discount = (product.totalPrice * bestOffer.discountAmount) / 100;
        }
      }
      return sum + discount;
    }, 0);

    let couponDiscount = 0;
    let appliedCoupon = null;
    const selectedCouponId = req.session.appliedCoupon;

    if (selectedCouponId) {
      const coupon = await Coupon.findById(selectedCouponId);
      if (
        coupon &&
        coupon.isListed &&
        !coupon.isDeleted &&
        currentDate >= coupon.startDate &&
        currentDate <= coupon.endDate &&
        subtotal >= coupon.minimumPrice
      ) {
        couponDiscount = coupon.offerPrice;
        appliedCoupon = coupon;
      } else {
        req.session.appliedCoupon = null;
      }
    }

    let total = subtotal - totalDiscount - couponDiscount;
    if (total < 0) total = 0;

    res.status(200).json({ 
      message: 'Quantity updated', 
      cart: updatedCart, 
      totalDiscount,
      subtotal,
      total,
      couponDiscount,
      appliedCoupon
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

    const updatedCart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'brand' }
    });

    const currentDate = new Date();
    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    let subtotal = 0;
    let totalDiscount = 0;
    let couponDiscount = 0;
    let appliedCoupon = null;
    let result = [];

    if (updatedCart && updatedCart.items.length > 0) {
      const cartProduct = updatedCart.items;

      result = cartProduct.map((product) => {
        const offers = allOffers.filter((item) => {
          const offerId = item.applicableTo?._id?.toString();
          return (
            offerId === product.productId.category.toString() ||
            offerId === product.productId.brand._id.toString() ||
            offerId === product.productId._id.toString()
          );
        });

        const bestOffer = getBestOffer(offers, product);

        return {
          product,
          bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
        };
      });

      subtotal = result.reduce(
        (sum, item) => sum + item.product.totalPrice,
        0
      );

      totalDiscount = result.reduce((sum, item) => {
        const { bestOffer, product } = item;
        let discount = 0;
        if (bestOffer && bestOffer.discountAmount > 0) {
          if (bestOffer.discountType === 'flat') {
            discount = bestOffer.discountAmount * product.quantity;
          } else if (bestOffer.discountType === 'percentage') {
            discount = (product.totalPrice * bestOffer.discountAmount) / 100;
          }
        }
        return sum + discount;
      }, 0);

      const selectedCouponId = req.session.appliedCoupon;
      if (selectedCouponId) {
        const coupon = await Coupon.findById(selectedCouponId);
        if (
          coupon &&
          coupon.isListed &&
          !coupon.isDeleted &&
          currentDate >= coupon.startDate &&
          currentDate <= coupon.endDate &&
          subtotal >= coupon.minimumPrice
        ) {
          couponDiscount = coupon.offerPrice;
          appliedCoupon = coupon;
        } else {
          req.session.appliedCoupon = null;
        }
      }
    }

    let total = subtotal - totalDiscount - couponDiscount;
    if (total < 0) total = 0;

    res.status(200).json({ 
      message: 'Product removed from cart', 
      cart: updatedCart, 
      subtotal,
      total,
      totalDiscount,
      couponDiscount,
      appliedCoupon,
      result
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

    console.log('addWhishList',req.query);
    const userId = req.session.user;
    const {productId} = req.query

    const product = await Product.findById(productId)
    const user = await User.findOne({ _id: userId });

    if (!product || !user) {
      return res.status(404).json({sucess:false, message: 'Product or user not found' });
    }

    const cart = await Cart.findOne({ userId });
    if (cart && cart.items.some(item => item.productId.toString() === productId)) {
      return res.json({
        success:false,
        message: 'This product is already in your cart',
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

    console.log('existProduct',existProduct);

    if (existProduct) {
      console.log('existProductexistProductexistProduct');
      return res.json({ 
        success:false,
        message: 'This product is already in your wishlist',
       });
    }

    userWishlist.products.push({ 
      productId: productId,
      addedOn: Date.now()  
    });

    await userWishlist.save();

    res.status(200).json({ 
      success:true,
      message: 'Product added to wishlist successfully',
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
      redirect: '/getCart'
    });
  } catch (error) {
    console.log('Error in addToCartFromWishlist:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const loadCheckOut = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login');
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.redirect('/login');
    }

    const cart = await Cart.findOne({ userId })
      .populate({
        path: 'items.productId',
        populate: { path: 'brand' }
      })
      .lean();
    if (!cart || cart.items.length === 0) {
      return res.redirect('/getCart');
    }

    const address = await Address.findOne({ userId }).lean();
    const appliedCouponId = req.session.appliedCoupon;
    let appliedCoupon = null;
    let couponDiscount = 0;

    if (appliedCouponId) {
      appliedCoupon = await Coupon.findById(appliedCouponId).lean();
      if (appliedCoupon) {
        couponDiscount = appliedCoupon.offerPrice;
      }
    }

    const currentDate = new Date();
    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    const result = cart.items.map((item) => {
      const offers = allOffers.filter((offer) => {
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
        bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
      };
    });

    const subtotal = result.reduce(
      (sum, item) => sum + item.product.totalPrice,
      0
    );

    const totalDiscount = result.reduce((sum, item) => {
      const { bestOffer, product } = item;
      let discount = 0;
      if (bestOffer && bestOffer.discountAmount > 0) {
        if (bestOffer.discountType === 'flat') {
          discount = bestOffer.discountAmount * product.quantity;
        } else if (bestOffer.discountType === 'percentage') {
          discount = (product.totalPrice * bestOffer.discountAmount) / 100;
        }
      }
      return sum + discount;
    }, 0);

    let total = subtotal - totalDiscount - couponDiscount;
    if (total < 0) total = 0;

    res.render('checkout', {
      user,
      cart,
      address,
      subtotal,
      totalDiscount,
      total,
      appliedCoupon,
      couponDiscount,
      result,
    });
  } catch (error) {
    console.error('Error in loadCheckOut:', error);
    res.redirect('/pageNotFound');
  }
};

const checkoutAddAddress = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findOne({ _id: userId });
    const { addressType, name, city, landMark, state, pincode, phone } = req.body;

    const userAddress = await Address.findOne({ userId: userData._id });

    if (!userAddress) {
      const newAddress = new Address({
        userId: userData._id,
        address: [{ addressType, name, city, landMark, state, pincode, phone }]
      });
      await newAddress.save();
    } else {
      userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone });
      await userAddress.save();
    }

    res.redirect('/checkout');
  } catch (error) {
    console.error('error from newAddress save', error);
    res.redirect('/pageNotFound');
  }
};

const checkoutEditAddress = async (req, res) => {
  try {
    //console.log('req.body=================================',req.body);
    const userId = req.session.user;
    const { addressId, addressType, name, city, landMark, state, pincode, phone } = req.body;

    const findAddress = await Address.findOne({
      'address._id': addressId
    });
    if (!findAddress) {
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

const applyCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    const userId = req.session.user;

    if (!couponId) {
      return res.json({ success: false, message: 'No coupon ID provided' });
    }
    if (!userId) {
      return res.json({ success: false, message: 'User not authenticated' });
    }

    if (req.session.appliedCoupon) {
      return res.json({ success: false, message: 'A coupon is already applied' });
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon || !coupon.isListed || coupon.isDeleted) {
      return res.json({ success: false, message: 'Invalid or expired coupon' });
    }

    const currentDate = new Date();
    if (currentDate < coupon.startDate || currentDate > coupon.endDate) {
      return res.json({ success: false, message: 'Coupon is not valid at this time' });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'brand' }
    });
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: 'Cart is empty' });
    }

    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    const result = cart.items.map((product) => {
      const offers = allOffers.filter((item) => {
        const offerId = item.applicableTo?._id?.toString();
        return (
          offerId === product.productId.category.toString() ||
          offerId === product.productId.brand._id.toString() ||
          offerId === product.productId._id.toString()
        );
      });

      const bestOffer = getBestOffer(offers, product);

      return {
        product,
        bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
      };
    });

    const subtotal = result.reduce(
      (sum, item) => sum + item.product.totalPrice,
      0
    );

    if (subtotal < coupon.minimumPrice) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minimumPrice} required for this coupon`,
      });
    }

    const totalDiscount = result.reduce((sum, item) => {
      const { bestOffer, product } = item;
      let discount = 0;
      if (bestOffer && bestOffer.discountAmount > 0) {
        if (bestOffer.discountType === 'flat') {
          discount = bestOffer.discountAmount * product.quantity;
        } else if (bestOffer.discountType === 'percentage') {
          discount = (product.totalPrice * bestOffer.discountAmount) / 100;
        }
      }
      return sum + discount;
    }, 0);

    req.session.appliedCoupon = couponId;

    const couponDiscount = coupon.offerPrice || 0;
    let total = subtotal - totalDiscount - couponDiscount;
    if (total < 0) total = 0;

    return res.json({
      success: true,
      message: 'Coupon applied successfully',
      couponDiscount,
      total,
      subtotal,
      totalDiscount,
      appliedCoupon: coupon,
      result
    });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.json({ success: false, message: 'User not authenticated' });
    }

    req.session.appliedCoupon = null;

    const cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      populate: { path: 'brand' }
    });
    if (!cart) {
      return res.json({ success: false, message: 'Cart not found' });
    }

    const currentDate = new Date();
    const allOffers = await Offer.find({
      isListed: true,
      isDeleted: false,
      validFrom: { $lte: currentDate },
      validUpto: { $gte: currentDate },
    }).lean();

    const result = cart.items.map((product) => {
      const offers = allOffers.filter((item) => {
        const offerId = item.applicableTo?._id?.toString();
        return (
          offerId === product.productId.category.toString() ||
          offerId === product.productId.brand._id.toString() ||
          offerId === product.productId._id.toString()
        );
      });

      const bestOffer = getBestOffer(offers, product);

      return {
        product,
        bestOffer: bestOffer || { discountAmount: 0, discountType: 'flat', offerName: '' },
      };
    });

    const subtotal = result.reduce(
      (sum, item) => sum + item.product.totalPrice,
      0
    );

    const totalDiscount = result.reduce((sum, item) => {
      const { bestOffer, product } = item;
      let discount = 0;
      if (bestOffer && bestOffer.discountAmount > 0) {
        if (bestOffer.discountType === 'flat') {
          discount = bestOffer.discountAmount * product.quantity;
        } else if (bestOffer.discountType === 'percentage') {
          discount = (product.totalPrice * bestOffer.discountAmount) / 100;
        }
      }
      return sum + discount;
    }, 0);

    let total = subtotal - totalDiscount;
    if (total < 0) total = 0;

    return res.json({
      success: true,
      message: 'Coupon removed successfully',
      couponDiscount: 0,
      total,
      subtotal,
      totalDiscount,
      appliedCoupon: null,
      result
    });
  } catch (error) {
    console.error('Error in removeCoupon:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
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
  checkoutEditAddress,
  applyCoupon,
  removeCoupon
};