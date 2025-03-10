const mongoose = require('mongoose')
const {Schema} = mongoose;

const productSchema= new Schema({
    productName:{
        type:String,
        required : true,
    },
    description:{
        type:String,
        requited:true
    },
    brand:{
        type:String,
        requited:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required : true
    },
    regularPrice:{
        type:Number,
        required:true
    },
    salePrice:{
        type:Number,
        required:true
    },
    productOffer:{
        type:Number,
        default:0
    },
    quantity:{
        type:Number,
        default:true
    },
    color:{
        type:String,
        requited:true
    },
    productImage:{
        type:[String],
        required:true
    },
    isBlocked:{
        type:Boolean,
        deault:false
    },
    status:{
        type:String,
        enum:["Available","out of stock","Discountinued"],
        required:true,
        default:"Available"
    },
},{timestamps:true})

const Product = mongoose.model("Product",productSchema)

module.exports = Product