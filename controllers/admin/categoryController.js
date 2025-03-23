const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')



const categoryInfo = async (req,res) => {
    try {

         
        let search = '';
        if (req.query.search) {
            search = req.query.search;
        }


        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            isDeleted: false,
            name: { $regex: ".*" + search + ".*", $options: "i" }
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)


        

       
        

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit)

        if(req.session.admMsg){
            var msg = req.session.admMsg
            req.session.admMsg = null
        }

        

        res.render('category',{
            
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories: totalCategories,
            msg:msg
        })
        
    } catch (error) {
        console.error("Error From Category Info",error);
        res.redirect('/pageerror')
    }
}


const addCategory = async(req, res) => {
    const {name, description} = req.body;

    try {
       
        const existingCategory = await Category.findOne({ name: { $regex: new RegExp("^" + name + "$", "i") } });
        if(existingCategory) {
           req.session.admMsg = "Category already exists"
           return res.redirect('/admin/category')
          
        }
        
        const newCategory = new Category({
            name,
            description
        });
        
        await newCategory.save();
        console.log('newCategory.save');

        req.session.admMsg = "Category added successfully"
        res.redirect('/admin/category')
        
       
        
    } catch (error) {
        console.error("Error adding category:", error);
        return res.status(500).json({error: "Internal server error"});
    }
}


const deleteCategory = async (req,res) =>{
    try {

        const {categoryId} = req.body
        console.log('1');
        console.log(categoryId);

        const existProductWithCategory = await Product.find({category:categoryId})
        console.log(existProductWithCategory);
        if(existProductWithCategory.length===0){

            const updateCategory = await Category.findOneAndUpdate(
                { _id: categoryId }, 
                { $set: { isDeleted: true } },
                { new: true }
            );
           
        }else{
            req.session.admMsg = "Have some products with this categories"
            return res.redirect("/admin/category")

           

        }
      
        

        req.session.admMsg ="Category Deleted successfully"
        
        console.log('2')
        res.redirect("/admin/category")
        console.log('3')
        
    } catch (error) {
        
    }
}


const editCategory = async (req,res)=>{

    const {editname,editdescription,categoryId} = req.body

    const exCategory = await Category.findOne({name:editname,description:editdescription,isDeleted:false})
    if(exCategory){
        req.session.admMsg = "This Category Already Existing"
        res.redirect('/admin/category')
        return
    }

    const editCategory= await Category.findOneAndUpdate({_id:categoryId},{$set:{name:editname,description:editdescription}}, { new: true, runValidators: true } )
   
    req.session.admMsg = "Category Edited Successfully"
    res.redirect('/admin/category')
}



const getListCategory = async (req,res) => {
    try {


        let id = req.query.id
        console.log(id);
        await Category.updateOne({_id:id},{$set:{isListed:false}})
        res.redirect('/admin/category')
        
    } catch (error) {
        res.redirect('/pageerror')
    }
}


const getunListCategory = async (req,res) => {
    try {

        let id = req.query.id
        await Category.updateOne({_id:id},{$set:{isListed:true}})
        res.redirect('/admin/category')
        
    } catch (error) {
        res.redirect('/pageerror')
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    deleteCategory,
    editCategory,
    getListCategory,
    getunListCategory
}