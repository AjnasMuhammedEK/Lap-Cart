const Category = require('../../models/categorySchema')



const categoryInfo = async (req,res) => {
    try {

         
        const page = parseInt(req.query.page) || 1
        const limit = 4
        const skip = (page-1)*limit

        
        const categoryData = await Category.find({isDeleted:false})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

       
        

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit)

        if(req.session.admMsg){
            var msg = req.session.admMsg
            req.session.admMsg = null
        }

        // if(req.session.addmessage){
        //     var msg = req.session.addmessage
        //     req.session.addmessage = null
        // }

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
       
        const existingCategory = await Category.findOne({name});
        if(existingCategory) {
            // return res.status(400).json({error: "Category already exists"});
           req.session.admMsg = "Category already exists"
           res.redirect('/admin/category')
           return
        }
        
        // Create and save new category
        const newCategory = new Category({
            name,
            description
        });
        
        await newCategory.save();
        console.log('newCategory.save');

        req.session.admMsg = "Category added successfully"
        res.redirect('/admin/category')
        
        // Send success response for AJAX request
        // return res.status(200).json({
        //     success: true,
        //     message: "Category added successfully",
        //     category: newCategory
        // });
        
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
      
        const updateCategory = await Category.findOneAndUpdate(
            { _id: categoryId }, // Correct way to find the document by ID
            { $set: { isDeleted: true } },
            { new: true } // Return the updated document
        );

        req.session.admMsg ="Category Deleted successfully"
        
        console.log('2')
        res.redirect("/admin/category")
        console.log('3')
        
    } catch (error) {
        
    }
}


const editCategory = async (req,res)=>{

    const {editname,editdescription,categoryId} = req.body

    const exCategory = await Category.findOne({name:editname,isDeleted:false})
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