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
        const product = await Product.findById(productId).populate('category')
       
        const relatedProducts = await Product.find({
          category: product.category._id, // Match by category
          _id: { $ne: productId },       // Exclude current product
      }).limit(4);

        const findCategory = product.category
        res.render('pro-detaile',{
            // user:userData,
            product:product,
            quantity:product.quantity,
            category:findCategory,
            relatedProducts: relatedProducts, // Add related products
        })

    } catch (error) {

        console.error("error for fetching product detailes ",error)
        res.redirect('/pageNotFound')
        
    }
}


//shop page managment

// const loadShop = async (req,res) => {
//     try {

//         const user = req.session.user
//         const userData = await User.findOne({_id:user})




//         const brand = await Brand.find({isListed:true,isDeleted:false})
//         const categories = await Category.find({isListed:true,isDeleted:false})
//         const categoyIds = categories.map((category)=>category._id.toString())

         
//         // console.log('=====================================================');
//         // console.log(`this category ${category}`);


//         const page = parseInt(req.query.page) || 1
//         const limit = 9;
//         const skip = (page-1)*limit;
        
//         const product = await Product.find({
//             isDeleted:false,
//             category:{$in:categoyIds},
//             quantity:{$gt:0}
//         }).sort({creattedOn:-1}).skip(skip).limit(limit)

//         const totalProducts = await Product.countDocuments({
//             isDeleted:false,
//             category:{$in:categoyIds},
//             quantity:{$gt:0}
//         })
//         const totalPages = Math.ceil(totalProducts/limit)

//             const categoriesWithIds = categories.map(category => ({_id:category._id,name:category.name}))

//         // console.log(product);
        
//         res.render('shop',{
//             user:userData,
//             category:categoriesWithIds,
//             brand:brand,
//             product:product,
//             totalProducts:totalProducts,
//             currentPage:page,
//             totalPages:totalPages
//         })
        
//     } catch (error) {

        
//     }
// }
// const filterProducts = async (req, res) => {
//     try {
//       console.log('its inside of filterProducts');
//       const user = req.session.user;
//       const category = req.query.category || null
//       const brand = req.query.brand || null
//       let minPrice = Number(req.query.minPrice) || 0;
//       let maxPrice = Number(req.query.maxPrice) || Infinity;
//       let search = req.query.search || null;
//       let sort = req.query.sort || null; // Default sorting is A-Z
  
//       const findCategory = category ? await Category.findOne({ name: category }) : null;
//       const findBrand = brand ? await Brand.findOne({ brandName: brand }) : null;
//       const brands = await Brand.find({}).lean();
  
//       const query = {
//         isDeleted: false,
//         quantity: { $gt: 0 },
//         salePrice: { $gt: minPrice, $lt: maxPrice }
//       };
  
//       if (search) {
//         query.productName = { $regex: ".*" + search + ".*", $options: "i" };
//       }
  
//       if (findCategory) {
//         query.category = findCategory._id;
//       }
  
//       if (findBrand) {
//         query.brand = findBrand.brandName;
//       }
  
//       let findProducts = await Product.find(query).lean();
  
//       // Apply sorting based on the sort parameter
//       switch (sort) {
//         case 'a-z':
//           findProducts.sort((a, b) => a.productName.localeCompare(b.productName));
//           break;
//         case 'z-a':
//           findProducts.sort((a, b) => b.productName.localeCompare(a.productName));
//           break;
//         case 'price-low-high':
//           findProducts.sort((a, b) => a.salePrice - b.salePrice);
//           break;
//         case 'price-high-low':
//           findProducts.sort((a, b) => b.salePrice - a.salePrice);
//           break;
//         default:
//           // Default sort by newest first (as in your original code)
//           findProducts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
//       }
  
//       const categories = await Category.find({ isListed: true, isDeleted: false });
  
//       const page = parseInt(req.query.page) || 1;
//       const limit = 9;
//       const skip = (page - 1) * limit;

//       let userData = null;
//       if (user) {
//         userData = await User.findOne({ _id: user });
//         if (userData) {
//           const searchEntry = {
//             category: findCategory ? findCategory._id : null,
//             brand: findBrand ? findBrand.brandName : null,
//             searchedOn: new Date()
//           };
//           userData.searchHistory.push(searchEntry);
//           await userData.save();
//         }
//       }
  
//       req.session.filterProducts = currentProduct;
  
//       res.render('shop', {
//         user: userData,
//         product: currentProduct,
//         category: categories,
//         brand: brands,
//         totalPages,
//         currentPage,
//         selectedCategory: category || null,
//         selectedBrand: brand || null,
//         selectedSort: sort ||null // Pass the selected sort to the view
//       });
  
//     } catch (error) {
//       console.error('Error in filterProducts:', error);
//       res.redirect('/pageNotFound');
//     }
//   };

const loadShop = async (req, res) => {
  try {
      const user = req.session.user;
      const userData = user ? await User.findOne({ _id: user }) : null;

      // Filter parameters from query
      const category = req.query.category || null;
      const brand = req.query.brand || null;
      let minPrice = Number(req.query.minPrice) || 0;
      let maxPrice = Number(req.query.maxPrice) || Infinity;
      let search = req.query.search || null;
      let sort = req.query.sort || null;

      // Fetch brands and categories
      const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
      const categories = await Category.find({ isListed: true, isDeleted: false });
      const categoryIds = categories.map((category) => category._id.toString());

      // Build query object
      const query = {
          isDeleted: false,
          quantity: { $gt: 0 },
          salePrice: { $gt: minPrice, $lt: maxPrice }
      };

      // Apply filters if present
      if (search) {
          query.productName = { $regex: ".*" + search + ".*", $options: "i" };
      }

      if (category) {
          const findCategory = await Category.findOne({ name: category });
          if (findCategory) {
              query.category = findCategory._id;
          }
      } else {
          // If no specific category, show all active categories
          query.category = { $in: categoryIds };
      }

      if (brand) {
          const findBrand = await Brand.findOne({ brandName: brand });
          if (findBrand) {
              query.brand = findBrand.brandName;
          }
      }

      // Pagination parameters
      const page = parseInt(req.query.page) || 1;
      const limit = 9;
      const skip = (page - 1) * limit;

      // Get total products count
      const totalProducts = await Product.countDocuments(query);
      const totalPages = Math.ceil(totalProducts / limit);

      // Fetch products with sorting and pagination
      const products = await Product.find(query)
          .sort(
              sort === 'a-z' ? { productName: 1 } :
              sort === 'z-a' ? { productName: -1 } :
              sort === 'price-low-high' ? { salePrice: 1 } :
              sort === 'price-high-low' ? { salePrice: -1 } :
              { createdAt: -1 }  // Default sort by newest
          )
          .skip(skip)
          .limit(limit)
          .lean();

      // Update user search history if logged in and filters applied
      if (userData && (search || category || brand)) {
          const searchEntry = {
              category: category ? (await Category.findOne({ name: category }))?._id : null,
              brand: brand || null,
              searchedOn: new Date()
          };
          userData.searchHistory.push(searchEntry);
          await userData.save();
      }

      // Prepare categories with IDs for rendering
      const categoriesWithIds = categories.map(category => ({
          _id: category._id,
          name: category.name
      }));

      // Render shop page
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
    // filterProducts
}