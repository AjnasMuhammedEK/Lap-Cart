const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const { options } = require('../../routes/userRouter')

const productDetailes = async (req,res) => {
    try {

        console.log('1');
        
        // const userId = req.session.user
        // const userData = await User.findById(userId)

        const productId = req.query.id
        console.log(productId);
        const product = await Product.findOne({_id:productId,isDeleted:false,isListed:true}).populate('category')

        if(!product){
            return res.redirect('/')
        }
       
        const relatedProducts = await Product.find({
          category: product.category._id,  
          _id: { $ne: productId },        
      }).limit(4);

        const findCategory = product.category
        res.render('pro-detaile',{
            // user:userData,
            product:product,
            quantity:product.quantity,
            category:findCategory,
            relatedProducts: relatedProducts,  
        })

    } catch (error) {

        console.error("error for fetching product detailes ",error)
        res.redirect('/pageNotFound')
        
    }
}



const loadShop = async (req, res) => {
  try {
      const user = req.session.user;
      let userData = null
      if (user) {
        userData = await User.findById(user);
        if (userData && userData.isBlocked) {
            req.session.destroy();
            return res.redirect('/login');
        }
    }
    userData = user ? await User.findOne({ _id: user }) : null;

    const category = req.query.category || null;
    const brand = req.query.brand || null;
    let minPrice = Number(req.query.minPrice) || 0;
    let maxPrice = Number(req.query.maxPrice) || Infinity;
    let search = req.query.search || null;
    let sort = req.query.sort || null;

    const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
    const categories = await Category.find({ isListed: true, isDeleted: false });
    const categoryIds = categories.map((category) => category._id.toString());

    const query = {
        isDeleted: false,
        // isListed:true,
        quantity: { $gt: 0 },
        salePrice: { $gt: minPrice, $lt: maxPrice }
    };

    if (search) {
        query.productName = { $regex: ".*" + search + ".*", $options: "i" };
    }

    if (category) {
        const findCategory = await Category.findOne({ name: category });
        if (findCategory) {
            query.category = findCategory._id;
        }
    } else {
        query.category = { $in: categoryIds };
    }

    if (brand) {
        const findBrand = await Brand.findOne({ brandName: brand ,isListed:true});
        if (findBrand) {
            query.brand = findBrand.brandName;
        }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    let sortOption = {};
    switch (sort) {
        case 'a-z':
            sortOption = { productName: 1 };
            break;
        case 'z-a':
            sortOption = { productName: -1 };
            break;
        case 'price-low-high':
            sortOption = { salePrice: 1 };
            break;
        case 'price-high-low':
            sortOption = { salePrice: -1 };
            break;
        default:
            sortOption = { createdAt: -1 };  
            break;
    }

    const products = await Product.find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();

    
    const categoriesWithIds = categories.map(category => ({
        _id: category._id,
        name: category.name
    }));

    res.render('shop', {
        user: userData,
        category: categoriesWithIds,
        brand: brands,
        product: products,
        totalProducts: totalProducts,
        currentPage: page,
        totalPages: totalPages,
        selectedCategory: category || null,
        selectedBrand: brand || null,
        selectedSort: sort || null
    });

  } catch (error) {
      console.error('Error in loadShop:', error);
      res.redirect('/pageNotFound');
  }
};
module.exports = {
    productDetailes,
    loadShop,
}