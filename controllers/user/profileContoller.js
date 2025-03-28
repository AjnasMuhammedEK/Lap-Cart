const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const Address = require('../../models/addressSchema') 
const nodemailer = require('nodemailer')
const env = require("dotenv").config()
const bcrypt = require('bcrypt')




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


const userProfile = async (req,res)=>{

    try {

        let msg ;

        if(req.session.userMsg){
            msg = req.session.userMsg
            req.session.userMsg = null
        }

        const userId = req.session.user
        const userData = await User.findById(userId);
        const addressData = await  Address.findOne({userId:userId})
        if(msg){
           return res.render('profile',{
                user:userData,
                userAddress:addressData,
                msg:msg
            })

        } 
            res.render('profile',{
                user:userData,
                userAddress:addressData,
                msg:msg
            })
       
       
        
    } catch (error) {

        console.error('error for profile data',error);
        res.redirect('/pageNotFound')
        
    }
}


const addProfileImage = async (req,res) => {

    console.log('hai');

}


const changeEmail = async (req,res)=>{
    try {

        const userId = req.session.user
        const userData = await User.findById(userId);

        res.render('change-email',{
            user:userData
        })
        
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}


const verifyEmailChange = async (req,res) => {
    try {

        const {email} =req.body

 
        userExist = await User.findOne({email})

        if(userExist){
            const otp = generateOtp()
            const emailSent = await sentVerificationEmail(email,otp)
            if(emailSent){

                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email
                console.log(`OTP FROM EMAIL CHANGE ${otp}`);
                res.render("ChangeEmailOtp")

            }else{
                res.json('email-error')
            }
           
        }else{
            res.render('change-email',{
                message:"User With this email not exist"
            })
        }
        
        
    } catch (error) {
        
    }
}


const verifyEmailOtp = async (req,res) => {
    try {

        const enteredOtp = req.body.otp
        console.log(enteredOtp);
        if(enteredOtp === req.session.userOtp){
            req.session.userData = req.body.userData
            res.render("new-email",{
                userData:req.session.userData
            })
        }else{
            res.render("ChangeEmailOtp",{
                message:"OTP NOT MATCHING",
                userData:req.session.userData
            })
        }
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}


const updateEmail = async (req,res) => {
    try {
        
        const newEmail = req.body.newEmail
        const userId = req.session.user;
        await User.findByIdAndUpdate(userId,{email:newEmail})
        res.redirect('/userProfile')

    } catch (error) {

        res.redirect("/pageNotFound")
        
    }
}

const emailReOtp = async (req, res) => {
    try {
        // Get email from session or request body
        const email = req.session.email || req.body.email;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email not found' });
        }
        
        // Generate new OTP
        const otp = generateOtp();
        
        // Send email with new OTP
        const emailSent = await sentVerificationEmail(email, otp);
        
        if (emailSent) {
            // Update session with new OTP
            req.session.userOtp = otp;
            console.log(`Resent OTP: ${otp}`);
            
            return res.json({ success: true, message: 'OTP sent successfully' });
        } else {
            return res.json({ success: false, message: 'Failed to send email' });
        }
    } catch (error) {
        console.error('Error in forPassReOtp:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

 

const loadeditProfile = async (req,res) => {
    try {
        const userId = req.session.user
        console.log(userId);
        const userData = await User.findById(userId)
        console.log(userData);
        res.render('edit-profile',{
            user:userData
        })
        
    } catch (error) {
        
    }
}

const updateProfile = async (req,res) => {
    try {

        const userId = req.session.user
        const {username,phone} = req.body
        const updateUser = await User.findByIdAndUpdate(userId,{name:username,phone:phone})

        req.session.userMsg = "Updated Successfully"

        res.redirect('/userProfile')
    } catch (error) {
        
    }
}
const loadAddress = async (req, res) => {
    try {
       
            const userId = req.session.user;
            const userData = await User.findById(userId)

            const userAddress = await Address.findOne({ userId: userId });
            res.render('address', {
                    user: userData,
                    userAddress: userAddress   
                });
        
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

const addAddress = async (req,res) => {
    try {

        const user = req.session.user
        
        res.render("add-address",{user:user})
        
    } catch (error) {
        
    }
}



// const postAddAddress = async (req,res) => {
//     try {

//         const userId = req.session.user
//         const userData = await User.findOne({_id:userId})
//         const {addressType,name,city,landMark,state,pincode,phone} = req.body
//         console.log('1');
//         const userAddress = await Address.findOne({userId:userData._id})
//         if(!userAddress){
//             const newAddress = new Address({
//                 userId : userData._id,
//                 address : [{addressType,name,city,landMark,state,pincode,phone}]
//             })
//             await newAddress.save()
//             console.log('2');

//         }else{
//             console.log('3');

//             userAddress.address.push({addressType,name,city,landMark,state,pincode,phone})
//             await newAddress.save()
//         }
//         console.log('4');

//         res.redirect('/address')


//     } catch (error) {

//         console.error('error from newAddress save',error)
//         res.redirect('/pageNotFound')
        
//     }
// }
const postAddAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({_id: userId})
        const {addressType, name, city, landMark, state, pincode, phone} = req.body
         
        const userAddress = await Address.findOne({userId: userData._id})
        
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{addressType, name, city, landMark, state, pincode, phone}]
            })
            await newAddress.save()
         } else {
             userAddress.address.push({addressType, name, city, landMark, state, pincode, phone})
            await userAddress.save()   
        }
        console.log('4');

        res.redirect('/address')
    } catch (error) {
        console.error('error from newAddress save', error)
        res.redirect('/pageNotFound')
    }
}

const editAddress = async (req,res) =>{
    try {

        const addressId = req.query.addressId
         console.log(addressId);
        const user = req.session.user
        const currentAddress = await Address.findOne({
            "address._id": addressId
        });
 
        if (!currentAddress) {
            return res.redirect("/pageNotFound");
        }

        const addressData = currentAddress.address.find((item)=>{
            return item._id.toString()===addressId.toString()
        })

        if(!addressData){
            return res.redirect('/pageNotFound')
        }

        res.render('edit-address',{address:addressData,user:user})
        console.log(addressData);
        
    } catch (error) {

        console.error('error in edit address',error)
        res.redirect('/pageNotFound')
        
    }
}

const postEditAddress = async (req, res) => {
    try {
         const userId = req.session.user;

        const { addressId , addressType, name, city, landMark, state, pincode, phone } = req.body;

        console.log(addressId)
        const findAddress =  await Address.findOne({
            "address._id": addressId
        });
        if(!findAddress){
            return res.redirect("/pageNotFound")
        }
        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$.addressType": addressType,
                    "address.$.name": name,
                    "address.$.city": city,
                    "address.$.landMark": landMark,
                    "address.$.state": state,
                    "address.$.pincode": pincode,
                    "address.$.phone": phone
                }
            }
        )

        return res.redirect("/address")
        


    } catch (error) {
        console.error("Error in edit address:", error);
       
        return res.redirect("/pageNotFound");
        
    }
};


const deleteAddress = async (req,res) => {
    try {

        const addressId = req.query.id
        const findAddress = await Address.findOne({"address._id":addressId})
        if(!findAddress){
            return res.status(404).send("Address Not Found")
        }
        await Address.updateOne({
            "address._id":addressId
        },
        {
            $pull : {
                address : {
                    _id : addressId
                }
            }
        }
    )        
    res.redirect('/address')
    } catch (error) {
        console.error("erron in delete address")
        res.redirect("/pageNotFound")
        
    }
}



module.exports = {
    userProfile,
    addProfileImage,
    changeEmail,
    verifyEmailChange,
    verifyEmailOtp,
    updateEmail,
    loadeditProfile,
    updateProfile,
    loadAddress,
    emailReOtp,
    addAddress,
    postAddAddress,
    editAddress,
    postEditAddress,
    deleteAddress,
     
}