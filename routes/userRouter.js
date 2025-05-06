const express = require('express');
const router = express.Router();
const userController = require('../controllers/user/userController');
const productController = require('../controllers/user/ProductController');
const profileController = require('../controllers/user/profileContoller');
const cartController = require('../controllers/user/CartMgmtController ');
const orderController = require('../controllers/user/orderController');
const walletController = require('../controllers/user/walletController')
const passport = require('passport');
const { userAuth } = require('../middlewares/auth');
const Product = require('../models/productSchema');
const multer = require('multer');
const upload = require('../helpers/multer');



router.get('/pageNotFound',userController.pageNotFound);
router.get('/',userController.loadHomepage);
router.get('/login',userController.loadLogin);
router.get('/signup',userController.loadSignup);
router.post('/signup',userController.signup);
router.post('/verify-otp',userController.verifyOtp);
router.post('/resend-otp',userController.resendotp);


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id;
    res.redirect('/');
});


router.post('/login',userController.login);
router.get('/logout',userController.logout);


//product detailes

router.get('/productDetaile',userAuth,productController.productDetailes);

//forgot password

router.get('/forgot-password',userController.loadEmailPage);
router.get('/forgot-otp',userController.loadForPassOtpPage);
router.get('/rePassword',userController.loadRePassPage);
router.post('/verify-forgot-email',userController.verifyForgotEmail);
router.post('/verify-forgot-otp',userController.verifyForgotOtp);
router.post('/forgotPassword',userController.forgotPassword);
router.get('/forPassReOtp',userController.forPassResendOtp);



//shop page

router.get('/shop',userAuth,productController.loadShop);


router.get('/userProfile',userAuth,profileController.userProfile);
 
router.get('/edit-profile',userAuth,profileController.loadeditProfile);
router.post('/updateProfile', userAuth, upload.single('userImage'), profileController.updateProfile);
router.post('/forPassReOtp',userAuth,profileController.emailReOtp);
router.get('/changeEmail', userAuth, profileController.changeEmail);
router.post('/verifyEmailChange', userAuth, profileController.verifyEmailChange);

router.get('/verify-email-otp', userAuth,profileController.loadEmailOtp)
router.post('/verify-email-otp', userAuth, profileController.verifyEmailOtp);
router.get('/new-email', userAuth,profileController.newEmail);
router.post('/emailReOtp', userAuth, profileController.emailReOtp);
router.post('/updateEmail', userAuth, profileController.updateEmail);


router.get('/address',userAuth,profileController.loadAddress);
router.get('/addAddress',userAuth,profileController.addAddress);
router.post('/addAddress',userAuth,profileController.postAddAddress);
router.get('/editAddress',userAuth,profileController.editAddress);
router.post('/posteditAddress',userAuth,profileController.postEditAddress);
router.get('/deleteAddress',userAuth,profileController.deleteAddress);
 
router.get('/getCart', userAuth, cartController.loadCart);
router.post('/cartAdd', userAuth, cartController.addToCart);
router.post('/cartQuantity', userAuth, cartController.manageCartQuantity);
router.post('/deleteCart', userAuth, cartController.deleteCart);
router.post('/cartCheckout', userAuth, cartController.cartCheckout);

router.get('/whishlist', userAuth, cartController.loadWhishList);
router.get('/addWhishlist', userAuth, cartController.addWhishList);
router.post('/removeWishlist', userAuth, cartController.removeFromWishlist);
router.post('/addToCartFromWishlist', userAuth, cartController.addToCartFromWishlist);

router.get('/checkout',userAuth,cartController.loadCheckOut);
router.post('/checkAddAddress',userAuth,cartController.checkoutAddAddress);
router.post('/checkeditAddress',userAuth,cartController.checkoutEditAddress);

router.post('/place-order',userAuth,orderController.placeOrder);
router.get('/order-success',userAuth,orderController.loadOrderSuccess);
router.post('/verify-razorpay-payment', orderController.verifyRazorpayPayment);
router.post('/retry-razorpay-payment', userAuth, orderController.retryRazorpayPayment);
router.get('/paymentfailedpage',userAuth,orderController.loadPaymentFailedPage)
router.get('/listOrder',userAuth,orderController.listOrder);
router.get('/ord-detailes',userAuth,orderController.loadOrdDetailes);
router.get('/downloadInvoice',orderController.invoicePdf);
router.get('/cancelOrder',userAuth,orderController.cancelOrder);
router.post('/singleCancel',userAuth,orderController.singleCancel)
router.post('/returnProduct',userAuth,orderController.returnProduct);

//Wallet Mangment

router.get('/wallet',userAuth,walletController.loadWallet)
router.post('/applyCoupon',userAuth,cartController.applyCoupon)
router.post('/removeCoupon',userAuth,cartController.removeCoupon)


 

module.exports = router;