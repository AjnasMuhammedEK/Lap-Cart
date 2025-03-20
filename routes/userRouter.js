const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/ProductController')
const passport = require('passport')
const { userAuth } = require('../middlewares/auth')
const Product = require('../models/productSchema')

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

router.get('/productDetaile',productController.productDetailes)

//forgot password

router.get('/forgot-password',userController.loadEmailPage)
router.get('/forgot-otp',userController.loadForPassOtpPage)
router.get('/rePassword',userController.loadRePassPage)
router.post('/verify-forgot-email',userController.verifyForgotEmail)
router.post('/verify-forgot-otp',userController.verifyForgotOtp)
router.post('/forgotPassword',userController.forgotPassword)
router.get('/forPassReOtp',userController.forPassResendOtp)



//shop page

router.get('/shop',productController.loadShop)
// router.get('/filterProducts',productController.filterProducts)


module.exports = router