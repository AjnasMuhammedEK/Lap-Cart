const Offer = require('../../models/offerSchema')
const Product = require('../../models/productSchema');
const Brand = require('../../models/brandSchema');
const Category = require('../../models/categorySchema');


const loadOffer = async (req,res) => {
    try {


       let search = '';
              if (req.query.search) {
                  search = req.query.search
              }
      
      
              const page = parseInt(req.query.page) || 1;
              const limit = 4;
              const skip = (page - 1) * limit;
      
              const offer = await Offer.find({
                  isDeleted: false,
                  offerName: { $regex: '.*' + search + '.*', $options: 'i' }
                  
              })
                  .sort({ createdAt: -1 })
                  .skip(skip)
                  .limit(limit);
      
              
      
              const totalBrand = await Offer.countDocuments()
              const totalPages = Math.ceil(totalBrand / limit)
      

        const product = await Product.find({isDeleted:false,isListed:true})
        const brand = await Brand.find({isDeleted:false,isListed:true})
        const category = await Category.find({isDeleted:false,isListed:true})
        console.log(brand);
 
    

        res.render('offer',{
            brands: brand,
            categories: category,
            products: product,
            offer:offer,
            currentPage:page,
            totalPages:totalPages,
        })
    } catch (error) {
        
    }
}

 
const addOffer = async (req, res) => {
    try {
      const {offerName,description,discountType,discountAmount,validFrom,validUpto,offerType,applicableTo} = req.body;
      console.log(req.body);
  
      const offerTypeRef = offerType;  
  
      const newOffer = new Offer({
        offerName,
        description,
        discountType,
        discountAmount,
        validFrom,
        validUpto,
        offerType,
        applicableTo,
        offerTypeRef // include this!
      });
  
      await newOffer.save();
      return res.json({ success: true, message: 'Offer Added Successfully' });
  
    } catch (error) {
      console.error("Error adding offer:", error);
      return res.status(500).json({ success: false, message: "Failed to add offer", error: error.message });
    }
  };



const editOffer = async (req,res) => {
  try {

    const {offerId,offerName,description,discountType,discountAmount,validFrom,validUpto,offerType,applicableTo}= req.body;
    const offerTypeRef = offerType

    console.log('req.body',req.body)

    const editOffer = await Offer.findOneAndUpdate(
      { _id: offerId },
      {
        $set: {
          offerName: offerName,
          description: description,
          discountType: discountType,
          discountAmount: discountAmount,
          validFrom: validFrom,
          validUpto: validUpto,
          applicableTo: applicableTo,
          offerType: offerTypeRef  
        }
      },
      { new: true }
    );
  
    if(!editOffer){
      return res.json({success:false,message:'Something Went Wrong !!'})
    }

 
    return res.json({success:true,message:'Offer Edited Successfully'})

  } catch (error) {
    
  }
}



const deleteOffer = async (req,res) => {
  try {

    const {offerId} = req.body
    console.log(offerId);

    const deleteOffer = await Offer.findOneAndUpdate({_id:offerId},{$set:{isDeleted:true}},{new:true})
    if(!deleteOffer){
      return res.json({success:false,message:'Something Went Wrong !!'})  
    }
    
    return res.json({success:true,message:'Deleted Successfull'})

  } catch (error) {
    
  }
}



const listOffer = async (req,res) =>{
  try {

    const {offerId} = req.body

    const listOffer = await Offer.findOneAndUpdate({_id:offerId},{$set:{isListed:true}},{new:true})

    if(!listOffer){
      return res.json({success:false,message:'Failed In List Offer'})
    }
    return res.json({success:true,message:'Offer Listed Successfully'})
    
  } catch (error) {
    
  }
}





const unListOffer = async (req,res) =>{
  try {

    const {offerId} = req.body
    console.log(offerId);

    const unListOffer = await Offer.findOneAndUpdate({_id:offerId},{$set:{isListed:false}},{new:true})

    if(!unListOffer){
      return res.json({success:false,message:'Failed In List Offer'})
    }
    return res.json({success:true,message:'Offer UnListed Successfully'})
    
  } catch (error) {
    
  }
}
  module.exports = {
    loadOffer,
    addOffer,
    editOffer,
    deleteOffer,
    listOffer,
    unListOffer
}  