const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Offer = require('../../models/offerSchema');
const mongoose = require('mongoose');


const productDetailes = async (req, res) => {
    try {
        const userId = req.session.user;
        let userData = null;
        if (userId) {
            userData = await User.findById(userId);
        }

        const productId = req.query.id;
        if (!productId) {
            return res.redirect('/');
        }

        const product = await Product.findOne({
            _id: productId,
            isDeleted: false,
            isListed: true
        }).populate('category').populate('brand');

        if (!product) {
            return res.redirect('/');
        }

        const relatedProducts = await Product.find({
            category: product.category._id,
            isDeleted: false,
            isListed: true,
            quantity:{$gt:0},
            _id: { $ne: productId }
        }).limit(4);

        let items = 0;
        if (userId) {
            const cart = await Cart.findOne({ userId });
            if (cart) {
                items = cart.items.length;
            }
        }

        const currentDate = new Date();
        const allOffers = await Offer.find({
            isListed: true,
            isDeleted: false,
            validFrom: { $lte: currentDate },
            validUpto: { $gte: currentDate }
        }).lean();

        const offers = allOffers.filter(item => {
            const offerId = item.applicableTo?.toString();
            return (
                offerId &&
                item.offerTypeRef === item.offerType &&
                (
                    (item.offerType === 'Category' && offerId === product.category._id.toString()) ||
                    (item.offerType === 'Brand' && offerId === product.brand?._id?.toString()) ||
                    (item.offerType === 'Product' && offerId === product._id.toString())
                )
            );
        });

        const bestOffer = getBestOffer(offers, product);

        let finalPrice = product.salePrice;
        let discountAmount = 0;
        if (bestOffer) {
            if (bestOffer.discountType === 'percentage') {
                discountAmount = (product.salePrice * bestOffer.discountAmount) / 100;
            } else if (bestOffer.discountType === 'flat') {
                discountAmount = bestOffer.discountAmount;
            }
            finalPrice = product.salePrice - discountAmount;
            finalPrice = finalPrice < 0 ? 0 : finalPrice;
        }

        const findCategory = product.category;

        res.render('pro-detaile', {
            user: userData,
            product,
            quantity: product.quantity,
            category: findCategory,
            relatedProducts,
            items,
            offers,
            bestOffer,  
            finalPrice: finalPrice.toFixed(2),
            discountAmount: discountAmount.toFixed(2) 
        });

    } catch (error) {
        console.error('Error fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};

function getBestOffer(applicableOffers, product) {
    if (!Array.isArray(applicableOffers) || applicableOffers.length === 0) return null;

    let bestOffer = null;
    let maxDiscount = 0;

    for (const offer of applicableOffers) {
        let discount = 0;
        const salePrice = product.productId?.salePrice || product.salePrice || 0;

        if (salePrice <= 0) {
            console.log(`Invalid sale price for product: ${product.productId.productName}`);
            continue;
        }

        if (offer.discountType === 'flat') {
            discount = offer.discountAmount;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productName}: Flat discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        } else if (offer.discountType === 'percentage') {
            discount = (salePrice * offer.discountAmount) / 100;
            if (discount >= salePrice) {
                console.log(`Offer skipped for product ${product.productId.productName}: Percentage discount (${discount}) exceeds or equals sale price (${salePrice})`);
                continue;
            }
        }

        if (discount > maxDiscount) {
            maxDiscount = discount;
            bestOffer = offer;
        }
    }

    return bestOffer;
}








const loadShop = async (req, res) => {
    try {
        const user = req.session.user;
        let userData = null;
        if (user) {
            userData = await User.findById(user);
            if (userData && userData.isBlocked) {
                req.session.destroy();
                return res.redirect('/login');
            }
        }
        userData = user ? await User.findOne({ _id: user }) : null;

        let items = 0;
        if (user) {
            const cart = await Cart.findOne({ userId: user });
            if (cart) {
                items = cart.items.length;
            }
        }

        const { category, brand, minPrice, maxPrice, search, sort, page } = req.query;

        const selectedCategory = category || null;
        const selectedBrand = brand || null;
        const selectedSort = sort || null;
        const currentPage = parseInt(page) || 1;
        const minPriceValue = Number(minPrice) || 0;
        const maxPriceValue = Number(maxPrice) || Infinity;

        let searchValue = null;
        if (search) {
            if (Array.isArray(search)) {
                searchValue = search.find(val => val && val.trim() !== '') || null;
            } else if (search.trim() !== '') {
                searchValue = search;
            }
        }

        const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();
        const categories = await Category.find({ isListed: true, isDeleted: false }).lean();
        const categoryIds = categories.map((cat) => cat._id.toString());

        const query = {
            isDeleted: false,
            isListed: true,
            quantity: { $gt: 0 },
            salePrice: { $gte: minPriceValue, $lte: maxPriceValue }
        };

        if (searchValue) {
            query.productName = { $regex: searchValue, $options: 'i' };
        }

        if (selectedCategory) {
            const findCategory = await Category.findOne({ _id: selectedCategory });
            if (findCategory) {
                query.category = findCategory._id;
            }
        } else {
            query.category = { $in: categoryIds };
        }

        if (selectedBrand && mongoose.Types.ObjectId.isValid(selectedBrand)) {
            const findBrand = await Brand.findOne({ _id: selectedBrand, isListed: true });
            if (findBrand) {
                query.brand = findBrand._id;
            }
        }

        const limit = 6;
        const skip = (currentPage - 1) * limit;
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        let sortOption = {};
        switch (selectedSort) {
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
            .populate('brand')
            .populate('category')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const categoriesWithIds = categories.map(cat => ({
            _id: cat._id,
            name: cat.name
        }));

        res.render('shop', {
            user: userData,
            category: categoriesWithIds,
            brand: brands,
            product: products,
            totalProducts,
            currentPage,
            totalPages,
            selectedCategory,
            selectedBrand,
            selectedSort,
            minPrice: minPriceValue > 0 ? minPriceValue : '',
            maxPrice: maxPriceValue < Infinity ? maxPriceValue : '',
            search: searchValue,
            items
        });

    } catch (error) {
        console.error('Error in loadShop:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productDetailes,
    loadShop,
};