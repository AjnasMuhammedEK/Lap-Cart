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


const deleteProduct = async (req,res) =>{
    try {

        const {productId} = req.body
        console.log('1');
        console.log(productId);
      
        const updateProduct = await Product.findOneAndUpdate(
            { _id: productId }, 
            { $set: { isDeleted: true } },
            { new: true } 
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

// const editProduct = async (req, res) => {
//     try {
//         const id = req.params.id;
//         const product = await Product.findOne({ _id: id });
//         const data = req.body;

//         const existingProduct = await Product.findOne({
//             productName: data.productName,
//             _id: { $ne: id },
//         });
        
//         if (existingProduct) {
//             return res.status(400).json({ error: "Product with this name already exists." });
//         }
        
//         const existingImages = Array.isArray(product.productImage) ? product.productImage : [];
//         let newImages = existingImages.slice();
        
//         if (data.croppedImages && data.croppedImages.startsWith('data:image')) {
//             const filename = `cropped-image-${Date.now()}.jpg`;
//             const base64Data = data.croppedImages.replace(/^data:image\/\w+;base64,/, "");
            
//             fs.writeFileSync(path.join(productImagesDir, filename), Buffer.from(base64Data, 'base64'));
            
//             if (newImages.length > 0) {
//                 const oldImagePath = path.join(productImagesDir, newImages[0]);
//                 if (fs.existsSync(oldImagePath)) {
//                     fs.unlinkSync(oldImagePath);
//                 }
//             }
//             newImages[0] = filename;
//         }
        
//         if (req.files && req.files.length > 0) {
//             const uploadedFile = req.files[0];
//             const outputFilename = `product-${Date.now()}.jpg`;
//             const resizedImagePath = path.join(productImagesDir, outputFilename);
            
//             try {
//                 await sharp(uploadedFile.path)
//                     .resize({ width: 440, height: 440, fit: 'cover' })
//                     .jpeg({ quality: 80 })
//                     .toFile(resizedImagePath);
                
//                 if (newImages.length > 0) {
//                     const oldImagePath = path.join(productImagesDir, newImages[0]);
//                     if (fs.existsSync(oldImagePath)) {
//                         fs.unlinkSync(oldImagePath);
//                     }
//                 }
                
//                 newImages[0] = outputFilename;
//                 fs.unlinkSync(uploadedFile.path);
//             } catch (sharpError) {
//                 console.error("Error processing uploaded image:", sharpError);
//             }
//         }
        
//         const updateFields = {
//             productName: data.productName,
//             description: data.productDescription,
//             brand: data.brand,
//             category: data.category,
//             regularPrice: data.productAmount,
//             salePrice: data.salePrice,
//             quantity: data.stockCount,
//             status: data.status,
//             productImage: newImages,
//         };
        
//         await Product.findByIdAndUpdate(id, updateFields, { new: true });
//         res.redirect('/admin/product');
//     } catch (error) {
//         console.error(error);
//         res.redirect('/admin/pageerror');
//     }
// };
// 
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
        
        // Clone existing product images array
        const existingImages = Array.isArray(product.productImage) ? product.productImage : [];
        let newImages = existingImages.slice();
        
        // Handle cropped images
        if (data.croppedImages) {
            // Convert to array if it's not already
            const croppedImagesArray = Array.isArray(data.croppedImages) ? data.croppedImages : [data.croppedImages];
            
            // Get positions from the imagePositions field
            const imagePositions = data.imagePositions ? data.imagePositions.split(',').map(pos => parseInt(pos)) : [];
            
            // Process each cropped image with its corresponding position
            for(let i = 0; i < croppedImagesArray.length; i++) {
                const croppedImage = croppedImagesArray[i];
                
                // Only process if it's a valid base64 image
                if (croppedImage && croppedImage.startsWith('data:image')) {
                    // Use the position from imagePositions if available, otherwise default to index
                    const position = imagePositions[i] !== undefined ? imagePositions[i] : i;
                    
                    // Generate unique filename
                    const filename = `cropped-image-${Date.now()}-${i}.jpg`;
                    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, "");
                    
                    fs.writeFileSync(path.join(productImagesDir, filename), Buffer.from(base64Data, 'base64'));
                    
                    // If there's an old image at this position, delete it
                    if (newImages[position] && fs.existsSync(path.join(productImagesDir, newImages[position]))) {
                        fs.unlinkSync(path.join(productImagesDir, newImages[position]));
                    }
                    
                    // Update the image at the correct position
                    if (position >= newImages.length) {
                        // Fill any gaps with null values
                        while (newImages.length < position) {
                            newImages.push(null);
                        }
                        newImages.push(filename); // Add at the end
                    } else {
                        newImages[position] = filename; // Replace at position
                    }
                }
            }
        }
        
        // Handle removed images
        if (data.removedImages) {
            const removedImages = data.removedImages.split(',');
            for (const removedImage of removedImages) {
                const index = newImages.indexOf(removedImage);
                if (index !== -1) {
                    // Remove the image file
                    if (fs.existsSync(path.join(productImagesDir, removedImage))) {
                        fs.unlinkSync(path.join(productImagesDir, removedImage));
                    }
                    // Set to null to maintain position
                    newImages[index] = null;
                }
            }
            // Filter out null values
            newImages = newImages.filter(img => img !== null);
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
        res.redirect('/admin/product?success=true');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
}
module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadeditProduct,
    editProduct,
    deleteProduct
}