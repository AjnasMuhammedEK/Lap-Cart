const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')


const loadProduct = async (req,res)=>{

    try {
        
        const search = req.query.search || ""
        const page = req.query.page || 1
        const limit = 4

        const productData = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],

        }).limit(limit*1)
          .skip((page-1)*limit)
          .populate('category')
          .exec()

          const count = await Product.find({
            $or:[
                {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                {brand:{$regex:new RegExp(".*"+search+".*","i")}}
            ],
          }).countDocuments()
          console.log(productData)

          const category = await Category.find({isListed:true,isDeleted:false})
          const brand = await Brand.find({isListed:true,isDeleted:false})


          if(category && brand){
            res.render('product',{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand

            })
          }else{
            res.render('page-404')
          }


    } catch (error) {
        res.redirect('/admin/pageerror')
    }

    
}


const loadAddProduct = async (req,res)=>{
    try {

        const category = await Category.find({isListed:true,isDeleted:false})
        
        const brand = await Brand.find({isListed:true,isDeleted:false})
        console.log(brand)
        // const status = await Product.find({})
        // console.log(status)
        
        res.render("product-add",{
            cat:category,
            brand:brand
        })
        
    } catch (error) {

        res.redirect('/pageerror')
        
    }
}

// const addProduct = async(req,res)=>{
//     try {

//         const product = req.body
//         const productExixts = await Product.findOne({
//             productName:product.productName,

//         })

//         if(!productExixts){
//             const images = []

//             if(req.files && req.files.length>0){
//                 for(let i = 0 ; i < req.files.length;i++){
//                     const originalImagePath = req.files[i].path

//                     const resizedImagePath = path.join('public','uploads','product-images',req.files[i].filename)
//                     await sharp(originalImagePath).resize({width:440,height:440}).toFile(resizedImagePath)
//                     images.push(req.files[i].filename)
//                 }
//             }
//             const categoryId = await Category.findOne({name:product.category})

//             if(!categoryId){
//                 return res.status(400).send("Invalid category name")

//             }

//             const newProduct = new Product({
//                 productName:product.productName,
//                 description:product.description,
//                 brand:product.brand,
//                 category:categoryId._id,
//                 regularPrice:product.productAmount,
//                 salePrice:product.salePrice,
//                 createdOn:new Date(),
//                 quantity:product.stockCount,
//                 productImage:images,
//                 status:'Available'
//             })

//             await newProduct.save()
//             return res.redirect('/admin/addProduct')
//         }else{
//             return res.status(400).json("Product Already Exists")
//         }
        
//     } catch (error) {

//         console.error("Error Saving Product",error);
//         return res.redirect('/admin/pageerror')
        
        
//     }
// }

const ensureDirectoryExists = (directoryPath) => {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
        console.log(`Directory created: ${directoryPath}`);
    }
};

const addProduct = async(req, res) => {
    try {
        const product = req.body;
        
        // Check if product already exists
        const productExists = await Product.findOne({
            productName: product.productName,
        });
        
        if (!productExists) {
            const images = [];
            
            // Create product-images directory if it doesn't exist
            const productImagesDir = path.join(process.cwd(), 'public', 'uploads', 'product-images');
            ensureDirectoryExists(productImagesDir);
            
            // Process uploaded images
            if (req.files && req.files.length > 0) {
                // Limit to 3 images maximum
                const filesToProcess = req.files.slice(0, 3);
                
                for (let i = 0; i < filesToProcess.length; i++) {
                    const originalImagePath = filesToProcess[i].path;
                    const outputFilename = `product-${Date.now()}-${i}.jpg`;
                    const resizedImagePath = path.join(productImagesDir, outputFilename);
                    
                    // Ensure source file exists
                    if (fs.existsSync(originalImagePath)) {
                        try {
                            // Resize image with sharp
                            await sharp(originalImagePath)
                                .resize({ width: 440, height: 440, fit: 'cover' })
                                .jpeg({ quality: 80 })
                                .toFile(resizedImagePath);
                            
                            // Add filename to images array
                            images.push(outputFilename);
                            
                            // Delete temp file
                            fs.unlinkSync(originalImagePath);
                        } catch (sharpError) {
                            console.error(`Error processing image ${i}:`, sharpError);
                        }
                    } else {
                        console.error(`File not found: ${originalImagePath}`);
                    }
                }
            }
            
            // Get category ID from category name
            const categoryId = await Category.findOne({ name: product.category });
            if (!categoryId) {
                return res.status(400).json({ error: "Invalid category name" });
            }
            
            // Create new product
            const newProduct = new Product({
                productName: product.productName,
                description: product.productDescription, 
                brand: product.brand,
                category: categoryId._id,
                regularPrice: product.productAmount,
                salePrice: product.salePrice,
                createdOn: new Date(),
                quantity: product.stockCount,
                productImage: images,
                status: product.status,
            });
            
            // Save product to database
            await newProduct.save();
            
            // Redirect to product list with success message
            return res.redirect('/admin/addProduct?success=true');
        } else {
            return res.status(400).json({ error: "Product already exists" });
        }
    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({ error: error.message });
    }
};


module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct


}