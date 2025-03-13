const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const nodemailer = require('nodemailer')
const env = require("dotenv").config()
const bcrypt = require('bcrypt')

const pageNotFound = async (req,res) => {
    try{
        res.render('page-404')
    }catch(error){
        res.redirect('/pageNotFound')
    }
}




// const loadHomepage = async (req,res) => {
//     try{
//         const user = req.session.user
//         console.log(`${user} clg1`);
//         if(user){

//             const userData = await User.findOne({_id:user._id})
//             console.log(userData);
//             res.render("home",{user:userData})
//         }else{
//             console.log('else home');
//             return res.render("home")
//         }

//     }catch(error){
//         console.log('Home page not found');
//         res.status(500).send("server error")
//     }
// }
const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user
        const categories = await Category.find({isListed:true,isDeleted:false})
        let productData = await Product.find(
            {
                isDeleted:false,
                category:{$in:categories.map(category=>category._id)},quantity:{$gt:0}
            }
        )


        productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData = productData.slice(0,4)

        
        if (user) {
            const userData = await User.findOne({_id: user})
            
            if (!userData) {
                // Clear the invalid session if user not found
                delete req.session.user;
                return res.render("home");
            }
            
            return res.render("home", {user: userData,products:productData})
        } else {
            return res.render("home",{products:productData})
        }
    } catch (error) {
        console.log('Home page error:', error);
        res.status(500).send("Server error")
    }
}

const loadLogin = async(req,res)=>{
    try{

        if(!req.session.user){
            return res.render('login')
        }else{
            res.redirect('/login')
        }
        
    }catch(err){
        res.redirect("/pageNotFound")
        
    }
}





const loadSignup = async(req,res)=>{
    try{
        return res.render('signup')
    }catch(err){
        console.log('error');
    }
}


function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString()
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
        })
        console.log("Email:", process.env.NODEMAILER_EMAIL);
console.log("Password:", process.env.NODEMAILER_PASSWORD);


        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`you OTP is ${otp}`,
            html:`<b>Your OYP is: ${otp}</b>`
        })

        return info.accepted.length>0

    } catch (error) {
        console.error('sending email',error);
        return false;
    }
    
}

const signup = async(req,res)=>{
    
    try{
         
        const {name,phone,email,password,confirmPassword} = req.body
       

        if(password !== confirmPassword){
            return res.render("signup",{message:"Password not match"})
        }
         

        const findUser = await User.findOne({email})
        if(findUser){
            return res.render("signup",{message:"This email already exist"})
        }

        const otp = generateOtp();

        const emailSent = await sentVerificationEmail(email,otp)
        if(!emailSent){
            return res.json("email-error")
        }

        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password}

        res.render("verify-otp");
        console.log('OTP SENT',otp);

        }catch(error){
            console.error("sign error",error)
            res.redirect('/pageNotFound')
        }
}



const securePassword = async (password) => {
    try {
        
        const passwordHash = await bcrypt.hash(password,10)

        return passwordHash

    } catch (error) {
        
    }
}

// const verifyOtp = async (req, res) => {
//     try {
//         const { otp } = req.body;

//         // Check if OTP exists in session
//         if (!req.session.userOtp) {
//             return res.status(400).json({
//                 success: false, 
//                 message: "OTP session expired. Please restart signup process."
//             });
//         }

//         // Verify OTP
//         if (otp === req.session.userOtp) {
//             const userData = req.session.userData;

//             // Hash password
//             const passwordHash = await securePassword(userData.password);

//             // Create new user
//             const newUser = new User({
//                 name: userData.name,   
//                 email: userData.email,
//                 phone: userData.phone,
//                 password: passwordHash,
//                 isVerified: true
//             });

//             // Save user
//             await newUser.save();

//             // Set user session
//             req.session.user = newUser._id;

//             // Clear OTP and user data from session
//             delete req.session.userOtp;
//             delete req.session.userData;

//             // IMPORTANT: Always send a 200 status with success true
//             return res.status(200).json({
//                 success: true, 
//                 message: "OTP Verified Successfully",
//                 redirectUrl: "/"
//             });
//         } else {
//             // If OTP doesn't match
//             return res.status(200).json({
//                 success: false, 
//                 message: "Invalid OTP. Please try again."
//             });
//         }
//     } catch (error) {
//         console.error("OTP Verification Error", error);
//         // Send 200 status with error message
//         return res.status(200).json({
//             success: false, 
//             message: "An error occurred during verification"
//         });
//     }
// };
// const verifyOtp =  async (req,res)=>{

//     console.log('1');
//     try {

//         const {otp} = req.body

//         console.log('2');

//         if( otp===req.session.userOtp){
            
//         console.log('3')
//             // const user = req.session.userOtp
//             const user = req.session.userData

            
//         console.log(user)
//             const passwordHash = await securePassword(user.password)
            
//         console.log('5')

//             const saveUserData = new User({
//                 name: user.name,   
//                 email: user.email,
//                 phone: user.phone,
//                 password: passwordHash,
//             })
//             console.log(saveUserData);

//             await saveUserData.save();
//             req.session.user =  saveUserData._id;
//             res.redirect("/")
//             // res.json({success:true, redirectUrl:"/"})
//         }else{
//             res.status(400).json({success:false, message:"Invalid OTP Please Try Again"})
//         }
//     } catch (error) {

//         console.error("Error verifying OTP",error)
//         res.status(500).json({success:false, message:"An error occured"})
        
//     }
// }                



// const resendotp = async (req,res)=>{
//     try {
        
//         const {email} = req.session.userData;
//         if(!email){
//             return res.status(400).json({success:false,message:"Email not found in session"})
//         }

//         const otp = generateOtp()
//         req.session.userOtp = otp;

//         const emailSent = await sentVerificationEmail(email,otp);

//         if(emailSent){
//             console.log('resend otp:',otp);
//             res.status(200).json({success:true,message:"OTP Resend Successfully"})
//         }else{
//             res.status(500).json({success:false,message:"Failed to Resend OTP, Please Try Again"})
//         }

//     } catch (error) {
//         console.error('error resending OTP',error);
//         res.status(500).json({success:false,message:"Internal server Error. Please try again"})
//     }
// }

// const resendotp = async (req, res) => {
//     try {
//         const { email } = req.session.userData;
//         if (!email) {
//             return res.status(400).json({ success: false, message: "Email not found in session" });
//         }

//         // Check if an OTP was recently generated
//         const lastOtpTime = req.session.lastOtpTime || 0;
//         const currentTime = Date.now();
//         const otpCooldown = 60000; // 60 seconds cooldown

//         if (currentTime - lastOtpTime < otpCooldown) {
//             return res.status(429).json({ success: false, message: "Please wait before requesting a new OTP" });
//         }

//         // Generate a new OTP
//         const otp = generateOtp();
//         req.session.userOtp = otp;
//         req.session.lastOtpTime = currentTime; // Update last OTP request time

//         const emailSent = await sentVerificationEmail(email, otp);

//         if (emailSent) {
//             console.log('Resent OTP:', otp);
//             res.status(200).json({ success: true, message: "OTP Resent Successfully" });
//         } else {
//             res.status(500).json({ success: false, message: "Failed to Resend OTP, Please Try Again" });
//         }

//     } catch (error) {
//         console.error('Error resending OTP:', error);
//         res.status(500).json({ success: false, message: "Internal Server Error. Please try again" });
//     }
// };

const resendotp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        // Check if an OTP was recently generated
        const lastOtpTime = req.session.lastOtpTime || 0;
        const currentTime = Date.now();
        const otpCooldown = 60000; // 60 seconds cooldown

        if (currentTime - lastOtpTime < otpCooldown) {
            return res.status(429).json({ success: false, message: "Please wait before requesting a new OTP" });
        }

        // Generate a new OTP
        const otp = generateOtp();
        req.session.userOtp = otp;
        req.session.lastOtpTime = currentTime; // Update last OTP request time
        req.session.otpExpiry = currentTime + 60000; // Set 5-minute expiry (300,000 ms)

        const emailSent = await sentVerificationEmail(email, otp);

        if (emailSent) {
            console.log('Resent OTP:', otp);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to Resend OTP, Please Try Again" });
        }

    } catch (error) {
        console.error('Error resending OTP:', error);
        res.status(500).json({ success: false, message: "Internal Server Error. Please try again" });
    }
};

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;

        // Check if OTP exists in session
        if (!req.session.userOtp) {
            return res.status(400).json({
                success: false, 
                message: "OTP session expired. Please restart signup process."
            });
        }

        // Check if OTP is expired (5 minutes)
        const currentTime = Date.now();
        if (req.session.otpExpiry && currentTime > req.session.otpExpiry) {
            delete req.session.userOtp;
            delete req.session.otpExpiry;
            return res.status(200).json({
                success: false,
                message: "OTP has expired. Please request a new one."
            });
        }

        // Verify OTP
        if (otp === req.session.userOtp) {
            const userData = req.session.userData;

            // Hash password
            const passwordHash = await securePassword(userData.password);

            // Create new user
            const newUser = new User({
                name: userData.name,   
                email: userData.email,
                phone: userData.phone,
                password: passwordHash,
                isVerified: true
            });

            // Save user
            await newUser.save();

            // Set user session
            req.session.user = newUser._id;

            // Clear OTP and user data from session
            delete req.session.userOtp;
            delete req.session.userData;
            delete req.session.otpExpiry;

            // IMPORTANT: Always send a 200 status with success true
            return res.status(200).json({
                success: true, 
                message: "OTP Verified Successfully",
                redirectUrl: "/"
            });
        } else {
            // If OTP doesn't match
            return res.status(200).json({
                success: false, 
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP Verification Error", error);
        // Send 200 status with error message
        return res.status(200).json({
            success: false, 
            message: "An error occurred during verification"
        });
    }
};

const login = async (req,res)=>{

    try {
     
        const {email,password} = req.body
        const findUser = await User.findOne({isAdmin:0,email:email})


        if(!findUser){
            return res.render("login",{message:"User not found"})
        }


        if(findUser.isBlocked){
            return res.render("login",{message:"User is BLOCKED by ADMIN"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password)

        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = findUser._id
        res.redirect("/")
    } catch (error) {

        console.error('login error',error)
        res.render("login",{message:"Login Failed , Please Try Again Later"});
        
    }
}


const logout = async (req,res) => {
    try {
        
        req.session.destroy((err)=>{
            if(err){
                console.log('Session distroy error',err.message);
                return res.redirect("/pageNotFound")
            }
            return res.redirect('/login')
        })

    } catch (error) {
        console.log('logout error',error);
        res.redirect("/pageNotFound")
        
    }
}



module.exports = {
    loadHomepage,
    pageNotFound,
    loadLogin,
    loadSignup,
    signup,
    verifyOtp,
    resendotp,
    login,
    logout
}