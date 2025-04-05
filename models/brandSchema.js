const mongoose = require('mongoose');
const {Schema} = mongoose;

const brandSchema = new Schema({

    brandName:{
        type : String,
        required : true
    },
    // brandImage : {
    //     type :[String],
    //     required : true
    // },
    // isBlocked : {
    //     type : Boolean,
    //     default:false
    // },
    isListed:{
        type:Boolean,
        default:true
    },
    // categoryOffer:{
    //     type:Number,
    //     default:0
    // },
    createdAt: {
        type: Date,
        default: Date.now
    },
    isDeleted:{
        type:Boolean,
        default:false
    }
});


const Brand = mongoose.model('Brand',brandSchema);
module.exports = Brand; 