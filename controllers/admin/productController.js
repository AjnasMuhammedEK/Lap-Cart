const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');


const loadProduct = async (req,res)=>{

    try {

        // console.log('1');
        
        const search = req.query.search || '';
        const page = req.query.page || 1;
        const limit = 5;
        // console.log('90909090');

        const query = {
            isDeleted: false,
          };
          if (search) {
            query.productName = { $regex: new RegExp('.*' + search + '.*', 'i') };
          }
      
          const productData = await Product.find(query)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate(['category', 'brand'])
            .sort({ createdAt: -1 })
            .exec();
        //   console.log('m,m,m,m,m,');
      
           const count = await Product.find(query).countDocuments();
        //   console.log('2'); 
 
          const category = await Category.find({isListed:true,isDeleted:false});
          const brand = await Brand.find({isListed:true,isDeleted:false})
        //   console.log('brands===============',brand);

       

 

          if(category && brand){
            res.render('product',{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand
            });
          }else{
            res.render('page-404');
          }


    } catch (error) {
        res.redirect('/admin/pageerror');
    }

    
};


const loadAddProduct = async (req,res)=>{
    try {

        const category = await Category.find({isListed:true,isDeleted:false});
        
        const brand = await Brand.find({isListed:true,isDeleted:false});
        
        // const status = await Product.find({})
        // console.log(status)
        
        res.render('product-add',{
            cat:category,
            brand:brand
        });
        
    } catch (error) {

        res.redirect('/pageerror');
        
    }
};



const loadeditProduct = async(req,res)=>{
    try {
        const id = req.query.id;
        const product = await Product.findOne({_id:id});
        const category = await Category.find({isListed:true,isDeleted:false});
        const brand = await Brand.find({isListed:true,isDeleted:false});
        res.render('edit-product',{
            product:product,
            cat:category,
            brand:brand
        });
    } catch (error) {
        res.redirect('/admin/pageerror');
    }
};


const deleteProduct = async (req,res) =>{
    try {

        const {productId} = req.body;
        // console.log('1');
        // console.log(productId);
      
        const updateProduct = await Product.findOneAndUpdate(
            { _id: productId }, 
            { $set: { isDeleted: true } },
            { new: true } 
        );

        
        
       // console.log('2');
        res.redirect('/admin/product');
       // console.log('3');
        
    } catch (error) {
        
    }
};



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
       // console.log(req.body);
        const productExists = await Product.findOne({ productName: product.productName });
        
        if (productExists) {
            return res.json({ error: 'Product already exists' });
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
            return res.json({ error: 'Invalid category name' });
        }

        const bradId = await Brand.findOne({brandName:product.brand})
        
        const newProduct = new Product({
            productName: product.productName,
            description: product.productDescription,
            brand: bradId._id,
            category: categoryId._id,
            regularPrice: product.productAmount,
            salePrice: product.salePrice,
            createdOn: new Date(),
            quantity: product.stockCount,
            productImage: images,
            processor:product.processor,
            storage:product.storage,
            ram:product.ram,
            graphicsCard:product.graphicsCard,
            isDeleted: false
        });
        
        await newProduct.save();
        return res.redirect('/admin/product');
    } catch (error) {
        console.error('Error saving product:', error);
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
            return res.status(400).json({ error: 'Product with this name already exists.' });
        }
        
        const existingImages = Array.isArray(product.productImage) ? product.productImage : [];
        let newImages = existingImages.slice();
        
        if (data.croppedImages) {
            const croppedImagesArray = Array.isArray(data.croppedImages) ? data.croppedImages : [data.croppedImages];
            
            const imagePositions = data.imagePositions ? data.imagePositions.split(',').map(pos => parseInt(pos)) : [];
            
            for(let i = 0; i < croppedImagesArray.length; i++) {
                const croppedImage = croppedImagesArray[i];
                
                if (croppedImage && croppedImage.startsWith('data:image')) {
                    const position = imagePositions[i] !== undefined ? imagePositions[i] : i;
                    
                    const filename = `cropped-image-${Date.now()}-${i}.jpg`;
                    const base64Data = croppedImage.replace(/^data:image\/\w+;base64,/, '');
                    
                    fs.writeFileSync(path.join(productImagesDir, filename), Buffer.from(base64Data, 'base64'));
                    
                    if (newImages[position] && fs.existsSync(path.join(productImagesDir, newImages[position]))) {
                        fs.unlinkSync(path.join(productImagesDir, newImages[position]));
                    }
                    
                    if (position >= newImages.length) {
                        while (newImages.length < position) {
                            newImages.push(null);
                        }
                        newImages.push(filename); 
                    } else {
                        newImages[position] = filename;
                    }
                }
            }
        }
        
        if (data.removedImages) {
            const removedImages = data.removedImages.split(',');
            for (const removedImage of removedImages) {
                const index = newImages.indexOf(removedImage);
                if (index !== -1) {
                    if (fs.existsSync(path.join(productImagesDir, removedImage))) {
                        fs.unlinkSync(path.join(productImagesDir, removedImage));
                    }
                    newImages[index] = null;
                }
            }
            newImages = newImages.filter(img => img !== null);
        }

        const bradId = await Brand.findOne({brandName:data.brand})

        
        const updateFields = {
            productName: data.productName,
            description: data.productDescription,
            brand: bradId._id,
            category: data.category,
            regularPrice: data.productAmount,
            salePrice: data.salePrice,
            quantity: data.stockCount,
            productImage: newImages,
            processor:data.processor,
            storage:data.storage,
            ram:data.ram,
            graphicsCard:data.graphicsCard,
        };
        
        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect('/admin/product?success=true');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageerror');
    }
};



const getListProduct = async (req,res) => {
    //console.log('getListProduct');


    try {


        let id = req.query.id;
        //console.log(id);
        await Product.updateOne({_id:id},{$set:{isListed:false}});
        res.redirect('/admin/product');
        
    } catch (error) {
        console.log('error from listproduct');
        res.redirect('/pageerror');
    }
};


const getunListProduct = async (req,res) => {
    try {

        //console.log('getunListProduct');
        let id = req.query.id;
        //console.log(`id = ${id}`);
        await Product.updateOne({_id:id},{$set:{isListed:true}});
        res.redirect('/admin/product');
        
    } catch (error) {
        res.redirect('/pageerror');
    }
};

module.exports = {
    loadProduct,
    loadAddProduct,
    addProduct,
    loadeditProduct,
    editProduct,
    deleteProduct,
    getListProduct,
    getunListProduct
};