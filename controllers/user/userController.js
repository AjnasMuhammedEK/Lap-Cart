const User = require('../../models/userSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema')
const Wallet = require('../../models/walletSchema')
const nodemailer = require('nodemailer');
const env = require('dotenv').config();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pageNotFound = async (req,res) => {
    try{
        res.render('page-404');
    }catch(error){
        res.redirect('/pageNotFound');
    }
};


 
const loadHomepage = async (req, res) => {
    try {
         let user = req.session && req.session.user ? req.session.user : null;
        let userData = null;

        if (user) {
            userData = await User.findById(user);
            if (userData && userData.isBlocked) {
                req.session.destroy((err) => {
                    if (err) console.error('Session destroy error:', err);
                    return res.redirect('/login');
                });
                return;  
            }
        }
        console.log('1');

         const categories = await Category.find({ isListed: true, isDeleted: false });
        let productData = await Product.find({
            isDeleted: false,
            isListed: true,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        });

        let items = 0;

        if(user){
            const cart = await Cart.findOne({userId:user})
            if(cart){
                const carts = cart.items
                items = carts.length
            }
        }
        console.log('2');

        

         productData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        productData = productData.slice(0, 4);



         if (user && userData) {
            return res.render('home', { user: userData, products: productData,items: items || 0 });
        } else {
            return res.render('home', { products: productData,items: items || 0  });
        }
    } catch (error) {
        console.error('Home page error:', error);
        res.redirect("/pageNotFound")
     }
};


const loadLogin = (req,res)=>{
    try{
        let userMsg;
        if(req.session.userMsg){
            userMsg =req.session.userMsg;
            req.session.userMsg = null;
        }

        if(req.session.user){
            console.log('redirect/');
            return res.redirect('/')
        }

         
            return res.render('login',{
                msg:userMsg
            });
         
        
        
    }catch(err){
        res.redirect('/pageNotFound');
        
    }
};


const loadSignup = (req, res) => {
    try {
        const referralCode = req.query.ref || null;
        // console.log('Referral code in loadSignup:', referralCode);
        return res.render('signup', { referralCode, message: null });
    } catch (err) {
        console.error('loadSignup error:', err);
        res.redirect('/pageNotFound');
    }
};



const signup = async (req, res) => {
    try {
        const { name, phone, email, password, confirmPassword, ref } = req.body;

        if (password !== confirmPassword) {
            return res.render('signup', { message: 'Password does not match', referralCode: ref || req.query.ref });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render('signup', { message: 'This email already exists', referralCode: ref || req.query.ref });
        }

        const otp = generateOtp();
        const emailSent = await sentVerificationEmail(email, otp);
        if (!emailSent) {
            return res.json('email-error');
        }

        const referralCode = uuidv4().slice(0, 8);

        const referredByCode = ref || req.query.ref;
        // console.log('Referral code from body:', ref);
        // console.log('Referral code from query:', req.query.ref);
        // console.log('Using referral code:', referredByCode);

        let referredByUser = null;
        if (referredByCode) {
            referredByUser = await User.findOne({ referralCode: referredByCode });
            if (!referredByUser) {
                console.warn('Invalid referral code:', referredByCode);
                return res.render('signup', { message: 'Invalid referral code. Please try again or sign up without a referral.', referralCode: referredByCode });
            }
            console.log('Referrer found:', referredByUser._id);
        } else {
            console.log('No referral code provided, proceeding without referral');
        }

        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 60000;
        req.session.userData = { name, phone, email, password, referralCode, referredBy: referredByUser ? referredByUser._id.toString() : null };
        // console.log('Stored userData in session:', req.session.userData);

        res.render('verify-otp');
        console.log('OTP SENT', otp);
    } catch (error) {
        console.error('sign error', error);
        res.redirect('/pageNotFound');
    }
};
 
function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}

async function sentVerificationEmail(email,otp) {

    try {
        
        const transporter = nodemailer.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        });
        
        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:'Verify your account',
            text:`you OTP is ${otp}`,
            html:`<b>Your OYP is: ${otp}</b>`
        });

        return info.accepted.length>0;

    } catch (error) {
        console.error('sending email',error);
        return false;
    }
    
}

const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10);

        return passwordHash;

    } catch (error) {
        
    }
};

const resendotp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found in session' });
        }

        
        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.otpExpiry = Date.now() + 60000;

        const emailSent = await sentVerificationEmail(email, otp);

        if (emailSent) {
            console.log('Resent OTP:', otp);
            res.status(200).json({ success: true, message: 'OTP Resent Successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to Resend OTP, Please Try Again' });
        }

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error. Please try again' });
    }
};
 



const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        if (!req.session.userOtp) {
            return res.status(400).json({
                success: false,
                message: 'OTP session expired. Please restart signup process.',
            });
        }

        if (Date.now() > req.session.otpExpiry) {
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new OTP.',
            });
        }

        if (otp !== req.session.userOtp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP. Please try again.',
            });
        }

        const userData = req.session.userData;
        if (!userData) {
            console.error('Session userData missing');
            return res.status(400).json({
                success: false,
                message: 'User data not found in session.',
            });
        }

        console.log('Session userData:', userData);

        const passwordHash = await securePassword(userData.password);
        if (!passwordHash) {
            throw new Error('Password hashing failed');
        }

        const newUser = new User({
            name: userData.name,
            email: userData.email,
            phone: userData.phone,
            password: passwordHash,
            isVerified: true,
            referralCode: userData.referralCode,
            userImage: ['default.jpg'],
            redeemed: userData.referredBy ? true : false,
        });

        await newUser.save();
 
        let newWallet = await Wallet.findOne({ userId: newUser._id });
        if (!newWallet) {
            newWallet = new Wallet({
                userId: newUser._id,
                balance: 0,
                currency: 'INR',
                transactions: [],
            });
            await newWallet.save();
         } else {
            console.log('Existing wallet found for user:', newWallet);
        }

        let rewardMessage = 'OTP Verified Successfully';
        if (userData.referredBy) {
             const referrer = await User.findById(userData.referredBy);
            if (!referrer) {
                console.warn(`Referrer not found for ID: ${userData.referredBy}`);
            } else {
                console.log('Referrer found:', referrer._id.toString());

                 referrer.redeemedUsers = referrer.redeemedUsers || [];
                if (!referrer.redeemedUsers.some(id => id.toString() === newUser._id.toString())) {
                    referrer.redeemedUsers.push(newUser._id);
                    await referrer.save();
                    console.log('Referrer redeemedUsers updated:', referrer.redeemedUsers.map(id => id.toString()));
                }

                 let referrerWallet = await Wallet.findOne({ userId: referrer._id });
                if (!referrerWallet) {
                    referrerWallet = new Wallet({
                        userId: referrer._id,
                        balance: 0,
                        currency: 'INR',
                        transactions: [],
                    });
                    await referrerWallet.save();
                    console.log('New wallet created for referrer:', referrer._id.toString());
                } else {
                    console.log('Existing wallet found for referrer:', referrerWallet);
                }

                 const referrerTransactionId = `TXN-REF-${Date.now()}-${uuidv4().slice(0, 8)}`;
                const referrerTransaction = {
                    transactionId: referrerTransactionId,
                    amount: 100,
                    type: 'Credit',
                    method: 'Cashback',
                    status: 'Completed',
                    date: new Date(),
                    description: `Referral bonus for new user ${newUser.email}`,
                };

                 const referrerUpdate = await Wallet.findOneAndUpdate(
                    { userId: referrer._id },
                    {
                        $inc: { balance: 100 },
                        $push: { transactions: referrerTransaction },
                        $set: { lastUpdated: new Date() },
                    },
                    { new: true }
                );
                if (!referrerUpdate) {
                    console.error('Referrer wallet update returned null');
                    throw new Error('Failed to update referrer wallet');
                }
                console.log('Referrer wallet updated:', {
                    userId: referrerUpdate.userId.toString(),
                    balance: referrerUpdate.balance,
                    transactionId: referrerTransactionId,
                });

                 const newUserTransactionId = `TXN-NEW-${Date.now()}-${uuidv4().slice(0, 8)}`;
                const newUserTransaction = {
                    transactionId: newUserTransactionId,
                    amount: 100,
                    type: 'Credit',
                    method: 'Cashback',
                    status: 'Completed',
                    date: new Date(),
                    description: 'Referral bonus for signing up',
                };

                 const newUserUpdate = await Wallet.findOneAndUpdate(
                    { userId: newUser._id },
                    {
                        $inc: { balance: 100 },
                        $push: { transactions: newUserTransaction },
                        $set: { lastUpdated: new Date() },
                    },
                    { new: true }
                );
                if (!newUserUpdate) {
                    console.error('New user wallet update returned null');
                    throw new Error('Failed to update new user wallet');
                }
              

                rewardMessage = 'OTP Verified Successfully! You and your referrer earned ₹100!';
            }
        } else {
            console.log('No referredBy in userData, skipping referral rewards');
        }

        req.session.user = newUser._id.toString();

        delete req.session.userOtp;
        delete req.session.otpExpiry;
        delete req.session.userData;

        return res.status(200).json({
            success: true,
            message: rewardMessage,
            redirectUrl: '/',
        });
    } catch (error) {
        console.error('OTP Verification Error:', error);
        return res.status(500).json({
            success: false,
            message: `An error occurred during verification: ${error.message}`,
        });
    }
};

const login = async (req,res)=>{

    try {
     
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:false,email:email});
        

        if(!findUser){
            return res.render('login',{message:'User not found'});
        }


        if(findUser.isBlocked){
            return res.render('login',{message:'User is BLOCKED by ADMIN'});
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);

        if(!passwordMatch){
            return res.render('login',{message:'Incorrect Password'});
        }

        req.session.user = findUser._id;
        res.redirect('/');
    } catch (error) {

        console.error('login error',error);
        res.render('login',{message:'Login Failed , Please Try Again Later'});
        
    }
};


const logout = async (req,res) => {
    try {
        
        // req.session.destroy((err)=>{
        //     if(err){
        //         console.log('Session distroy error',err.message);
        //         return res.redirect('/pageNotFound');
        //     }
        //     return res.redirect('/login');
        // });

        req.session.user = null
        return res.redirect('/login');
        

    } catch (error) {
        console.log('logout error',error);
        res.redirect('/pageNotFound');
        
    }
};



const loadEmailPage = (req,res) => {
    try {
        let errMsg = null;
        if(req.session.userMsg){
            errMsg = req.session.userMsg;
            req.session.userMsg = null;
        }
        res.render('email-forgot',{
            errorMsg:errMsg
        });
    } catch (error) {
        res.redirect('/pageNotFound');
    }
};

const loadForPassOtpPage = (req,res)=>{
    try {

        let errMsg = null;
        if(req.session.userMsg){
            errMsg = req.session.userMsg;
            req.session.userMsg = null;
        }

        res.render('forPass-otp',{
            errorMsg:errMsg
        });     
        
    } catch (error) {
        
    }
};

const loadRePassPage = (req,res)=>{
    try {

        let msg = null;
        if(req.session.userMsg){
            msg = req.session.userMsg;
            req.session.userMsg = null;
        }

        console.log(`message from otp ${msg}`);

        res.render('forgot-password',{
            message:msg
        });        
    } catch (error) {
        
    }
};


const verifyForgotEmail = async (req,res) => {
    try {
        
        const {email} = req.body;
        console.log(email);

        req.session.email = email;
        const user = await User.findOne({email});
        if(!user){
            req.session.userMsg='This User Does Not Exist. Please Check You EMAIL !!';
            return res.redirect('/forgot-password');
        }

        const forPassOtp = await generateOtp();
        const emailSent = await sentVerificationEmail(email, forPassOtp);

        req.session.forPassOtp = forPassOtp;
        req.session.forPassOtpExpiry = Date.now() + 60000;

        console.log(`Forgot Password OTP : ${forPassOtp}`);

        res.redirect('/forgot-otp');     
        
    } catch (error) {
        
    }
};

const verifyForgotOtp = async (req,res) => {
    try {

        const {forgotOtp} = req.body;
        const otp = req.session.forPassOtp; 

        if (Date.now() > req.session.forPassOtpExpiry) {
            req.session.userMsg = 'OTP has expired. Please request a new OTP.';
            return res.redirect('/forgot-otp');
        }

        if(otp===forgotOtp){
            req.session.userMsg='otp verification successful';

            console.log(`from user enter otp : ${forgotOtp}`);
            res.redirect('/rePassword');

        }else{
            req.session.userMsg='Invalid OTP !!';
            res.redirect('/forgot-otp');
        }
        

        
    } catch (error) {
        
    }
};

const forgotPassword = async (req,res) => {
    try {

        const {newPassword} = req.body;
        const email = req.session.email;
        console.log(`email from last ${email}`);

        const user = await User.findOne({email});
        console.log(`user from last${user}`);

        const hashForPass = await securePassword(newPassword);
        console.log(`hashed password${hashForPass}`);

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { password: hashForPass },
            { new: true }
        );

        req.session.userMsg='password changed successfully';

        
        console.log(`update user ${updatedUser}`);
        if(req.session.user){
            res.redirect('/userProfile');
        }else{
            res.redirect('/login');
        }
        


          
       
        
    } catch (error) {
        
    }
};


const forPassResendOtp = async (req,res)=>{
    try {

        let useremail = req.session.email;

        const reforPassOtp = await generateOtp();
        const emailSent = await sentVerificationEmail(useremail, reforPassOtp);
        req.session.forPassOtp = reforPassOtp;
        req.session.forPassOtpExpiry = Date.now() + 60000;

        res.redirect('/forgot-otp');

       


        console.log(`user from resenotp ${useremail} resend otp is ${reforPassOtp}`);


        


    } catch (error) {
        
    }
};


module.exports = {
    loadHomepage,
    pageNotFound,
    loadLogin,
    loadSignup,
    signup,
    verifyOtp,
    resendotp,
    login,
    logout,
     loadEmailPage,
    loadForPassOtpPage,
    loadRePassPage,
    verifyForgotEmail,
    verifyForgotOtp,
    forgotPassword,
    forPassResendOtp
};