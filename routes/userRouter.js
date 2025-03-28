const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/ProductController')
const profileController = require('../controllers/user/profileContoller')
const cartController = require('../controllers/user/CartMgmtController ')
const passport = require('passport')
const { userAuth } = require('../middlewares/auth')
const Product = require('../models/productSchema')
const multer = require('multer')
const storage = require('../helpers/multer')



router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)
router.get('/login',userController.loadLogin)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendotp)


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    req.session.user = req.user._id
    res.redirect('/')
})


router.post('/login',userController.login)
router.get('/logout',userController.logout)


//product detailes

router.get('/productDetaile',userAuth,productController.productDetailes)

//forgot password

router.get('/forgot-password',userController.loadEmailPage)
router.get('/forgot-otp',userController.loadForPassOtpPage)
router.get('/rePassword',userController.loadRePassPage)
router.post('/verify-forgot-email',userController.verifyForgotEmail)
router.post('/verify-forgot-otp',userController.verifyForgotOtp)
router.post('/forgotPassword',userController.forgotPassword)
router.get('/forPassReOtp',userController.forPassResendOtp)



//shop page

router.get('/shop',userAuth,productController.loadShop)


router.get('/userProfile',userAuth,profileController.userProfile)
// router.post('/addProfileImage', userAuth, upload.array('images', 1), profileController.addProfileImage);
router.get('/changeEmail',userAuth,profileController.changeEmail)
router.post('/verifyEmailChange',userAuth,profileController.verifyEmailChange)
router.post('/verify-email-otp',userAuth,profileController.verifyEmailOtp)
router.post('/updateEmail',userAuth,profileController.updateEmail)
router.get('/edit-profile',userAuth,profileController.loadeditProfile)
router.post('/updateProfile',userAuth,profileController.updateProfile)
// Add this to your routes file
router.post('/forPassReOtp',userAuth,profileController.emailReOtp);

router.get('/address',userAuth,profileController.loadAddress)
router.get('/addAddress',userAuth,profileController.addAddress)
router.post('/addAddress',userAuth,profileController.postAddAddress)
router.get("/editAddress",userAuth,profileController.editAddress)
router.post("/posteditAddress",userAuth,profileController.postEditAddress)
router.get("/deleteAddress",userAuth,profileController.deleteAddress)
 
router.get("/getCart", userAuth, cartController.manageGetCartPage);
router.post("/cartAdd", userAuth, cartController.manageAddToCart);
router.post("/cartQuantity", userAuth, cartController.manageCartQuantity);
router.post("/deleteCart", userAuth, cartController.manageDeleteCart);
router.post("/cartCheckout", userAuth, cartController.manageCartCheckout);

router.get('/whishlist', userAuth, cartController.loadWhishList);
router.get('/addWhishlist', userAuth, cartController.addWhishList);
router.post('/removeWishlist', userAuth, cartController.removeFromWishlist);
router.post('/addToCartFromWishlist', userAuth, cartController.addToCartFromWishlist);

router.get('/checkout',userAuth,cartController.loadCheckOut)

module.exports = router