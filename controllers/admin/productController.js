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
            $and:[
                {isDeleted:false},
                {
                    $or:[
                        {productName:{$regex:new RegExp(".*"+search+".*","i")}},
                        {brand:{$regex:new RegExp(".*"+search+".*","i")}},
                    ],

                }
            ]
            
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
         

          const category = await Category.find({isListed:true,isDeleted:false})
          const brand = await Brand.find({isListed:true,isDeleted:false})

        //   console.log(productData);


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

// const ensureDirectoryExists = (directoryPath) => {
//     if (!fs.existsSync(directoryPath)) {
//         fs.mkdirSync(directoryPath, { recursive: true });
//         //console.log(`Directory created: ${directoryPath}`);
//     }
// };

// const addProduct = async(req, res) => {
//     try {
//         const product = req.body;
        
//         // Check if product already exists
//         const productExists = await Product.findOne({
//             productName: product.productName,
//         });
        
//         if (!productExists) {
//             const images = [];
            
//             // Create product-images directory if it doesn't exist
//             const productImagesDir = path.join(process.cwd(), 'public', 'uploads', 'product-images');
//             ensureDirectoryExists(productImagesDir);
            
//             // Process uploaded images
//             if (req.files && req.files.length > 0) {
//                 // Limit to 3 images maximum
//                 const filesToProcess = req.files.slice(0, 3);
                
//                 for (let i = 0; i < filesToProcess.length; i++) {
//                     const originalImagePath = filesToProcess[i].path;
//                     const outputFilename = `product-${Date.now()}-${i}.jpg`;
//                     const resizedImagePath = path.join(productImagesDir, outputFilename);
                    
//                     // Ensure source file exists
//                     if (fs.existsSync(originalImagePath)) {
//                         try {
//                             // Resize image with sharp
//                             await sharp(originalImagePath)
//                                 .resize({ width: 440, height: 440, fit: 'cover' })
//                                 .jpeg({ quality: 80 })
//                                 .toFile(resizedImagePath);
                            
//                             // Add filename to images array
//                             images.push(outputFilename);
                            
//                             // Delete temp file
//                             fs.unlinkSync(originalImagePath);
//                         } catch (sharpError) {
//                             console.error(`Error processing image ${i}:`, sharpError);
//                         }
//                     } else {
//                         console.error(`File not found: ${originalImagePath}`);
//                     }
//                 }
//             }
            
//             // Get category ID from category name
//             const categoryId = await Category.findOne({ name: product.category });
//             if (!categoryId) {
//                 return res.status(400).json({ error: "Invalid category name" });
//             }
            
//             // Create new product
//             const newProduct = new Product({
//                 productName: product.productName,
//                 description: product.productDescription, 
//                 brand: product.brand,
//                 category: categoryId._id,
//                 regularPrice: product.productAmount,
//                 salePrice: product.salePrice,
//                 createdOn: new Date(),
//                 quantity: product.stockCount,
//                 productImage: images,
//                 status: product.status,
//                 isDeleted:false
//             });
            
//             // Save product to database
//             await newProduct.save();
            
//             // Redirect to product list with success message
//             return res.redirect('/admin/product');
//         } else {
//             return res.status(400).json({ error: "Product already exists" });
//         }
//     } catch (error) {
//         console.error("Error saving product:", error);
//         return res.status(500).json({ error: error.message });
//     }
// };


const loadeditProduct = async(req,res)=>{
    try {
        const id = req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({isListed:true,isDeleted:false})
        const brand = await Brand.find({isListed:true,isDeleted:false})
        res.render("edit-product",{
            product:product,
            cat:category,
            brand:brand
        })
    } catch (error) {
        res.redirect('/admin/pageerror')
    }
}


// const editProduct = async (req,res) => {
//     try {

//         console.log('1')
        
//         const id = req.params.id;
//         console.log(id)
//         const product = await Product.findOne({_id:id})
//         // console.log(product)
//         const data = req.body
//         console.log(data)
//         const existingProduct = await Product.findOne({
//             productName:data.productName,
//             _id:{$ne:id}
//         })

//         if(existingProduct){
//             return res.status(400).json({error:"Product with this name already exists.Please try with another name"})
//         }

//         const images = []

//         if(req.files && req.files.length>0){
//             for(let i = 0 ; i < req.files.length;i++){
//                 images.push(req.files[i].filename)
//             }
//         }

//         const updateFields = {
//             productName:data.productName,
//             description:data.description,
//             brand:data.brand,
//             category:product.category,
//             regularPrice:data.regularPrice,
//             salePrice:data.salePrice,
//             quality:data.quantity
//         }
//         // console.log(updateFields)
//         if(req.files.length>0){
//             updateFields.$push = {productImage:{$each:images}}
//         }

//         await Product.findByIdAndUpdate(id,updateFields,{new:true})
//         res.redirect('/admin/product')


//     } catch (error) {
//         console.error(error)
//         res.redirect('/admin/pageerror')
//     }
// }

// const editProduct = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const product = await Product.findOne({ _id: id });
//         const data = req.body;
//         console.log(data);
        
//         const existingProduct = await Product.findOne({
//             productName: data.productName,
//             _id: { $ne: id },
//         });
        
//         if (existingProduct) {
//             return res.status(400).json({
//                 error: "Product with this name already exists. Please try with another name",
//             });
//         }
        
//         // const uploadDir = path.join(__dirname, '../../uploads/product-images');
//         //const uploadDir = path.join(__dirname, '../../uploads/products');

        
//         // Create the directory if it doesn't exist
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//         }
        
//         // Prepare the update fields
//         const updateFields = {
//             productName: data.productName,
//             description: data.productDescription,
//             brand: data.brand,
//             category: data.category,
//             regularPrice: data.productAmount,
//             salePrice: data.salePrice,
//             quantity: data.stockCount,
//             status: data.status
//         };
        
//         // Handle cropped images - Modified to replace only first image
//         const existingImages = Array.isArray(product.productImage) ? product.productImage : [];
//         const newImages = existingImages.slice(); // Copy existing images
        
//         if (data.croppedImages && data.croppedImages.startsWith('data:image')) {
//             const filename = `cropped-image-${Date.now()}.jpg`;
//             const base64Data = data.croppedImages.replace(/^data:image\/\w+;base64,/, "");
//             fs.writeFileSync(path.join(uploadDir, filename), Buffer.from(base64Data, 'base64'));
//             newImages[0] = filename; // Replace only first image
//         }
        
//         // Handle uploaded files - Modified to replace only first image
//         if (req.files && req.files.length > 0) {
//             newImages[0] = req.files[0].filename; // Replace only first image
//         }
        
//         // Update with the combined images array
//         updateFields.productImage = newImages;
        
//         console.log("Update fields:", updateFields);
        
//         await Product.findByIdAndUpdate(id, updateFields, { new: true });
//         res.redirect('/admin/product');
//     } catch (error) {
//         console.error(error);
//         res.redirect('/admin/pageerror');
//     }
// };


// const deleteProductImage = async (req, res) => {
//     try {
//         const productId = req.params.productId;
//         const imageName = req.params.imageName;
        
//         // Find the product
//         const product = await Product.findById(productId);
        
//         if (!product) {
//             return res.status(404).json({ success: false, error: "Product not found" });
//         }
        
//         // Check if the image exists in the product's images array
//         if (!product.productImage || !product.productImage.includes(imageName)) {
//             return res.status(404).json({ success: false, error: "Image not found in product" });
//         }
        
//         // Remove the image from the product's images array
//         const updatedImages = product.productImage.filter(img => img !== imageName);
//         product.productImage = updatedImages;
        
//         // Save the updated product
//         await product.save();
        
//         // Delete the image file from the server
//         const imagePath = path.join(__dirname, '../../uploads/product-images', imageName);
        
//         if (fs.existsSync(imagePath)) {
//             fs.unlinkSync(imagePath);
//         }
        
//         return res.status(200).json({ success: true, message: "Image deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting product image:", error);
//         return res.status(500).json({ success: false, error: "Server error" });
//     }
// };


const deleteProduct = async (req,res) =>{
    try {

        const {productId} = req.body
        console.log('1');
        console.log(productId);
      
        const updateProduct = await Product.findOneAndUpdate(
            { _id: productId }, // Correct way to find the document by ID
            { $set: { isDeleted: true } },
            { new: true } // Return the updated document
        );

        
        
        console.log('2')
        res.redirect("/admin/product")
        console.log('3')
        
    } catch (error) {
        
    }
}


const ensureDirectoryExists = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const productImagesDir = path.join(process.cwd(), 'public', 'uploads', 'product-images');
ensureDirectoryExists(productImagesDir);

const addProduct = async (req, res) => {
    try {
        const product = req.body;
        
        // Check if product already exists
        const productExists = await Product.findOne({ productName: product.productName });
        
        if (productExists) {
            return res.status(400).json({ error: "Product already exists" });
        }
        
        const images = [];
        
        if (req.files && req.files.length > 0) {
            const filesToProcess = req.files.slice(0, 3);
            
            for (let i = 0; i < filesToProcess.length; i++) {
                const originalImagePath = filesToProcess[i].path;
                const outputFilename = `product-${Date.now()}-${i}.jpg`;
                const resizedImagePath = path.join(productImagesDir, outputFilename);
                
                if (fs.existsSync(originalImagePath)) {
                    try {
                        await sharp(originalImagePath)
                            .resize({ width: 440, height: 440, fit: 'cover' })
                            .jpeg({ quality: 80 })
                            .toFile(resizedImagePath);
                        
                        images.push(outputFilename);
                        fs.unlinkSync(originalImagePath);
                    } catch (sharpError) {
                        console.error(`Error processing image ${i}:`, sharpError);
                    }
                } else {
                    console.error(`File not found: ${originalImagePath}`);
                }
            }
        }
        
        const categoryId = await Category.findOne({ name: product.category });
        if (!categoryId) {
            return res.status(400).json({ error: "Invalid category name" });
        }
        
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
            isDeleted: false
        });
        
        await newProduct.save();
        return res.redirect('/admin/product');
    } catch (error) {
        console.error("Error saving product:", error);
        return res.status(500).json({ error: error.message });
    }
};

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id },
        });
        
        if (existingProduct) {
            return res.status(400).json({ error: "Product with this name already exists." });
        }
        
        const existingImages = Array.isArray(product.productImage) ? product.productImage : [];
        let newImages = existingImages.slice();
        
        if (data.croppedImages && data.croppedImages.startsWith('data:image')) {
            const filename = `cropped-image-${Date.now()}.jpg`;
            const base64Data = data.croppedImages.replace(/^data:image\/\w+;base64,/, "");
            
            fs.writeFileSync(path.join(productImagesDir, filename), Buffer.from(base64Data, 'base64'));
            
            if (newImages.length > 0) {
                const oldImagePath = path.join(productImagesDir, newImages[0]);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            newImages[0] = filename;
        }
        
        if (req.files && req.files.length > 0) {
            const uploadedFile = req.files[0];
            const outputFilename = `product-${Date.now()}.jpg`;
            const resizedImagePath = path.join(productImagesDir, outputFilename);
            
            try {
                await sharp(uploadedFile.path)
                    .resize({ width: 440, height: 440, fit: 'cover' })
                    .jpeg({ quality: 80 })
                    .toFile(resizedImagePath);
                
                if (newImages.length > 0) {
                    const oldImagePath = path.join(productImagesDir, newImages[0]);
                    if (fs.existsSync(oldImagePath)) {
                        fs.unlinkSync(oldImagePath);
                    }
                }
                
                newImages[0] = outputFilename;
                fs.unlinkSync(uploadedFile.path);
            } catch (sharpError) {
                console.error("Error processing uploaded image:", sharpError);
            }
        }
        
        const updateFields = {
            productName: data.productName,
            description: data.productDescription,
            brand: data.brand,
            category: data.category,
            regularPrice: data.productAmount,
            salePrice: data.salePrice,
            quantity: data.stockCount,
            status: data.status,
            productImage: newImages,
        };
        
        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect('/admin/product');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
};


module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadeditProduct,
    editProduct,
    deleteProduct
}