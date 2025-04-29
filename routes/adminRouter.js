const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const {userAuth,adminAuth} = require('../middlewares/auth');
const customerController = require('../controllers/admin/customerController');
const categoryController = require('../controllers/admin/categoryController');
const brandController = require('../controllers/admin/brandController');
const productController = require('../controllers/admin/productController');
const orderController = require('../controllers/admin/orderController');
const couponController = require('../controllers/admin/couponController')
const offerConteroller = require('../controllers/admin/offerController')
const dashboardController = require('../controllers/admin/dashboardController')
const multer = require('multer');
const storage = require('../helpers/multer');
// const uploads = multer({storage:storage})
const upload = require('../helpers/multer');



router.get('/pageerror',adminController.pageerror);
router.get('/login',adminController.loadLogin);
router.post('/login',adminController.login);
router.get('/logout',adminController.logout);

//user managment
router.get('/users',adminAuth,customerController.customerInfo);
router.post('/coustomerBlocked',adminAuth,customerController.coustomerBlocked);
router.get('/coustomerunBlocked',adminAuth,customerController.coustomerunBlocked);

//Category Management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/addCategory',adminAuth,categoryController.addCategory);

//soft delete 

router.post('/deleteCategory', categoryController.deleteCategory);
router.post('/editCategory',categoryController.editCategory);
router.get('/listCategory',adminAuth,categoryController.getListCategory);
router.get('/unlistCategory',adminAuth,categoryController.getunListCategory);


// brand managment


router.get('/brand',adminAuth,brandController.brandInfo);
router.post('/addBrand',adminAuth,brandController.addBrand);

//soft delete 

router.post('/deleteBrand', brandController.deleteBrand);
router.post('/editBrand',brandController.editBrand);
router.get('/listBrand',adminAuth,brandController.getListBrand);
router.get('/unlistBrand',adminAuth,brandController.getunListBrand);


//product 

router.get('/product',adminAuth,productController.loadProduct);
router.get('/addProduct',adminAuth,productController.loadAddProduct);
router.post('/addProduct', adminAuth, upload.array('images', 3), productController.addProduct);
router.get('/editProduct',adminAuth,productController.loadeditProduct);
router.post('/editProduct/:id', adminAuth, upload.array('images', 3), productController.editProduct);
router.post('/deleteProduct', productController.deleteProduct);
router.get('/listProduct',adminAuth,productController.getListProduct);
router.get('/unlistProduct',adminAuth,productController.getunListProduct);



//order mnagment
router.get('/orderList', adminAuth, orderController.orderList); 
router.get('/detail-ord',adminAuth,orderController.orderDetaile);
router.post('/change-status',adminAuth,orderController.changeStatus)
router.post('/handle-return',adminAuth,orderController.handleReturn)



// coupon managment




router.get('/loadCoupon',adminAuth,couponController.loadCoupon)
router.post('/addCoupon',adminAuth,couponController.addCoupon)
router.post('/editCoupon',adminAuth,couponController.editCoupon)
router.post('/deleteCoupon',adminAuth,couponController.deleteCoupon)
router.post('/unlistCoupon',adminAuth,couponController.unlistCoupon)
router.post('/listCoupon',adminAuth,couponController.listCoupon)



//offer managment




router.get('/offer',adminAuth,offerConteroller.loadOffer)
router.post('/addOffer',adminAuth,offerConteroller.addOffer)
router.post('/editOffer',adminAuth,offerConteroller.editOffer)
router.post('/deleteOffer',adminAuth,offerConteroller.deleteOffer)
router.post('/listOffer',adminAuth,offerConteroller.listOffer)
router.post('/unListOffer',adminAuth,offerConteroller.unListOffer)

//sale report

router.get('/saleReport',adminAuth,dashboardController.loadSaleReport)
router.get('/sale-report/download-pdf', dashboardController.downloadPDFReport);
router.get('/sale-report/download-excel',dashboardController.downloadExcelReport);

//wallet managment

router.get('/userWallet',adminAuth,dashboardController.loadUserWallet)
router.post('/getOrder',adminAuth,dashboardController.getOrder)

router.get('/dashboard',adminAuth,dashboardController.loadDashboard)
module.exports = router;