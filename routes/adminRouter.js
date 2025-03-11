const express = require('express')
const router = express.Router()
const adminController = require('../controllers/admin/adminController')
const {userAuth,adminAuth} = require('../middlewares/auth')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const brandController = require('../controllers/admin/brandController')
const productController = require('../controllers/admin/productController')
const multer = require('multer')
const storage = require('../helpers/multer')
// const uploads = multer({storage:storage})
const upload = require('../helpers/multer')


router.get('/pageerror',adminController.pageerror)
router.get('/login',adminController.loadLogin)
router.post('/login',adminController.login)
router.get('/',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)

//user managment
router.get('/users',adminAuth,customerController.customerInfo)
router.post('/coustomerBlocked',adminAuth,customerController.coustomerBlocked)
router.get('/coustomerunBlocked',adminAuth,customerController.coustomerunBlocked)

//Category Management
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)

//soft delete 

router.post('/deleteCategory', categoryController.deleteCategory);
router.post('/editCategory',categoryController.editCategory)
router.get('/listCategory',adminAuth,categoryController.getListCategory)
router.get('/unlistCategory',adminAuth,categoryController.getunListCategory)


// brand managment


router.get('/brand',adminAuth,brandController.brandInfo)
router.post('/addBrand',adminAuth,brandController.addBrand)

//soft delete 

router.post('/deleteBrand', brandController.deleteBrand);
router.post('/editBrand',brandController.editBrand)
router.get('/listBrand',adminAuth,brandController.getListBrand)
router.get('/unlistBrand',adminAuth,brandController.getunListBrand)


//product 

router.get('/product',adminAuth,productController.loadProduct)
router.get('/addProduct',adminAuth,productController.loadAddProduct)
router.post('/addProduct', adminAuth, upload.array('images', 3), productController.addProduct);

module.exports = router