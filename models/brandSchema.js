const mongoose = require('mongoose');
const {Schema} = mongoose;

const brandSchema = new Schema({

    brandName:{
        type : String,
        required : true
    },
     
    isListed:{
        type:Boolean,
        default:true
    },
    
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