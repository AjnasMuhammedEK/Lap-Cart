const Brand = require('../../models/brandSchema')

let a = 10;

const brandInfo = async (req,res) => {
    try {

       

        let search = '';
        if (req.query.search) {
            search = req.query.search
        }


        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const brandData = await Brand.find({
            isDeleted: false,
            brandName: { $regex: '.*' + search + '.*', $options: 'i' }
            
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        

        const totalBrand = await Brand.countDocuments()
        const totalPages = Math.ceil(totalBrand / limit)

        if(req.session.admMsg){
            var msg = req.session.admMsg
            req.session.admMsg = null
        }

      

        res.render('brand',{
            
            cat:brandData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories: totalBrand,
            msg:msg
        });
        
    } catch (error) {
        console.error('Error From Category Info',error)
        res.redirect('/pageerror')
    }
};


const addBrand = async(req, res) => {
    const {brandName} = req.body
    console.log(brandName)
    try {
       
        const existingBrand = await Brand.findOne({brandName:brandName})
        if(existingBrand) {
           
           req.session.admMsg = 'Brand already exists'
           res.redirect('/admin/brand')
           return;
        }
       
        const newBrand = new Brand({
            brandName
            
        });
        console.log('brand saved')
        
        await newBrand.save();
        console.log('newBrand.save')

        req.session.admMsg = 'Category added successfully'
        res.redirect('/admin/brand')
        
    } catch (error) {
        console.error('Error adding category:', error)
        return res.status(500).json({error: 'Internal server error'})
    }
};


const deleteBrand = async (req,res) =>{
    try {

        const {brandId} = req.body
        console.log('1')
        console.log(brandId)
      
        const updateBrand = await Brand.findOneAndUpdate(
            { _id: brandId }, 
            { $set: { isDeleted: true } },
            { new: true }
        );

        req.session.admMsg ='Brand Deleted successfully'
        
        console.log('2')
        res.redirect('/admin/brand')
        console.log('3')
        
    } catch (error) {
        
    }
};


const editBrand = async (req,res)=>{

    const {editname,brandId} = req.body
    console.log(editname,brandId)

    const exBrand = await Brand.findOne({brandName:editname,isDeleted:false})
    if(exBrand){
        req.session.admMsg = 'This Brand Already Existing'
        res.redirect('/admin/brand')
        return
    }

    const editBrand= await Brand.findOneAndUpdate({_id:brandId},{$set:{brandName:editname}}, { new: true, runValidators: true } )
   
    req.session.admMsg = 'Brand Edited Successfully'
    res.redirect('/admin/brand')
};



const getListBrand = async (req,res) => {
    try {


        let id = req.query.id;
         
        await Brand.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect('/admin/brand')
        
    } catch (error) {
        res.redirect('/pageerror')
    }
};


const getunListBrand = async (req,res) => {
    try {

        let id = req.query.id;
        await Brand.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect('/admin/brand')
        
    } catch (error) {
        res.redirect('/pageerror')
    }
};

module.exports = {
    brandInfo,
    addBrand,
    editBrand,
    getListBrand,
    getunListBrand,
    deleteBrand
     
};