const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport = require('passport')

router.get('/pageNotFound',userController.pageNotFound)
router.get('/',userController.loadHomepage)
router.get('/login',userController.loadLogin)
router.get('/signup',userController.loadSignup)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendotp)


router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}))
router.get('/auth/google/callback',passport.authenticate('google',{failureRedirect:'/signup'}),(req,res)=>{
    res.redirect('/')
})


router.post('/login',userController.login)
router.get('/logout',userController.logout)


//product detailes


module.exports = router