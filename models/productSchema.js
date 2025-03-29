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
    isDeleted:{
        type:Boolean,
        default:false
    },
    isListed:{
        type:Boolean,
        default:true
    },
    

    processor:{
        type : String,
        required:true
    },

    ram:{
        type:String,
        required:true

    },

    storage:{
        type:String,
        required:true

    },


    graphicsCard:{
        type:String,
        required:true

    }


},{timestamps:true})

const Product = mongoose.model("Product",productSchema)

module.exports = Product