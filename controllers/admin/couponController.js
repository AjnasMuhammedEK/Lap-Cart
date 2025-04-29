const Coupon = require('../../models/couponSchema')
const Order = require('../../models/orderSchema')
const { findOneAndUpdate } = require('../../models/userSchema')



const loadCoupon = async (req,res) => {
    try {


        let search = '';
        if (req.query.search) {
            search = req.query.search
        }
              
              
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;
              
        const coupons = await Coupon.find({
            isDeleted: false,
            couponName: { $regex: '.*' + search + '.*', $options: 'i' }

        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
              
                      
              
        const totalBrand = await Coupon.countDocuments()
        const totalPages = Math.ceil(totalBrand / limit)
              

        res.render('couponList',{
            coupon:coupons,
            currentPage:page,
            totalPages:totalPages,
        })
        
    } catch (error) {

        return res.redirect('/pageNotFound')
        
    }
}




const addCoupon = async (req,res) => {
    try {

 
        
        const { couponName,couponCode,startDate,endDate,offerPrice,minimumPrice,description} = req.body


        const existingCode = await Coupon.findOne({couponCode : {$regex : RegExp('^' + couponCode + '$' , 'i')}})

        if (existingCode){
            return res.json({success:false,message:"This Coupon Code Is Existing"})
        }   

        const existingDelCoupon = await Coupon.findOne({ couponName: { $regex: new RegExp('^' + couponName + '$', 'i') }})
        console.log('existing',existingDelCoupon);
        if(existingDelCoupon && existingDelCoupon.isDeleted === true ){
            existingDelCoupon.isDeleted = false;
            existingDelCoupon.couponCode = couponCode;
            existingDelCoupon.description = description;
            existingDelCoupon.startDate = startDate;
            existingDelCoupon.endDate = endDate ;
            existingDelCoupon.offerPrice = offerPrice ;
            existingDelCoupon.minimumPrice = minimumPrice;
            await existingDelCoupon.save()
            return  res.status(200).json({ success: true, message: 'Coupon added successfully' })
        }
 
        const newCoupon = new Coupon({
            couponName: couponName,
            couponCode: couponCode,
            startDate: startDate,
            endDate: endDate,
            offerPrice: offerPrice,
            minimumPrice: minimumPrice,
            description: description  
        });
             
          await newCoupon.save()

          res.json({ success: true, message: "Coupon added successfully",data:newCoupon });


           
 
    } catch (error) {
        console.error('error from add coupon',error)
        
    }
}





const editCoupon = async (req,res) => {
    try {

        const {couponId, couponName,couponCode,startDate,endDate,offerPrice,minimumPrice,description} = req.body
          const editCoupon = await Coupon.findById(couponId)

        if(!editCoupon){
            return res.json({success:false,message:"This Coupon Not Find"})
        }

        

        const existingCode = await Coupon.findOne({
            _id: { $ne: couponId }, // Exclude current coupon
            couponCode: { $regex: new RegExp('^' + couponCode + '$', 'i') }
          });   
        
        const existingDelCoupon = await Coupon.findOne({ couponName: { $regex: new RegExp('^' + couponName + '$', 'i') },isDeleted:true})

        if(existingDelCoupon){
            existingDelCoupon.isDelete = false;
            existingDelCoupon.couponCode = couponCode;
            existingDelCoupon.startDate = startDate;
            existingDelCoupon.endDate = endDate ;
            existingDelCoupon.offerPrice = offerPrice ;
            existingDelCoupon.minimumPrice = minimumPrice;
            await existingDelCoupon.save()
            return res.status(200).json({ success: true, message: 'Coupon added successfully' })



        }
 

        const updateCoupon = await Coupon.findByIdAndUpdate(couponId,{
            couponName,
            couponCode,
            startDate,
            endDate,
            offerPrice,
            minimumPrice,
            description
        },{new:true})

        if (updateCoupon) {
            return res.status(200).json({
                success: true,
                message: "Coupon updated successfully"
            });
            
        } else {
            return res.status(400).json({
                success: false,
                message: "Coupon not found"
            });
        }

 
     } catch (error) {
        res.redirect('/pageNotFound')
        console.error('error from edit coupon',error)
        
    }
}



const deleteCoupon = async (req,res) => {
    try {

        const {couponId} = req.body
        
        const delCoupon = await Coupon.findOneAndUpdate({_id:couponId},{$set:{isDeleted:true}})
        
        if(!delCoupon){
            return res.json({success:false,message:"Something Went Wrong !!"})
        }

        return res.json({success:true,message:"Coupon Deleted Successfully.."})

    } catch (error) {
        res.redirect('/pageNotFound')

    }
}



const unlistCoupon = async (req,res) => {
    try {

        const {couponId} = req.body
        // console.log(couponId);
        const unlistCoupon = await Coupon.findOneAndUpdate({_id:couponId},{$set:{isListed:false}})

        if(!unlistCoupon){
            return res.json({success:false,message:'Something Went Wrong !!'})
        }

        return res.json({success:true,message:'Coupon Unlisted Successfully'})
        
    } catch (error) {
        res.redirect("/pageNotFound")
        console.error('error from unlistCoupon',error)
        
    }
}


const listCoupon = async (req,res) => {
    try {

        const {couponId} = req.body

        const listCoupon = await Coupon.findOneAndUpdate({_id:couponId},{$set:{isListed:true}})

        if(!listCoupon){
            return res.json({success:false,message:'Something Went Wron !!'})
        }
        return res.json({success:true,message:'Coupon Listed Successsfully'})
    } catch (error) {
        res.redirect('/pageNotFound')
        console.error('error in list copuon',error)
    }
}

module.exports = {
    loadCoupon,
    addCoupon,
    editCoupon,
    deleteCoupon,
    unlistCoupon,
    listCoupon
}