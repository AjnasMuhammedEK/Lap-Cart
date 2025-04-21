const mongoose = require('mongoose');
const {Schema} = mongoose;

const couponSchema = new Schema({
    couponName : {
        type:String,
        required : true,
        unique:true
    },
    couponCode:{
        type:String,
        required:true
    },
    startDate:{
        type:Date,
        default:Date.now,
        required:true
    },
    description:{
        type:String,
        required:true,
    },
     
    endDate:{
        type:Date,
        required:true
    },
    offerPrice:{
        type:Number,
        required:true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    isListed:{
        type:Boolean,
        default:true
    },
    isDeleted:{
        type : Boolean,
        default:false
    },
    userId : {
        type : Schema.Types.ObjectId,
        ref : 'User',
    }
});




const Coupon = mongoose.model('Coupon',couponSchema);
module.exports = Coupon;