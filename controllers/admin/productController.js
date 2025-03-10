const product = require('../../models/productSchema')
const Category = require('../../models/')



const loadProduct = (req,res)=>{
    res.render('product')
}




module.exports = {
    loadProduct
}