const mongoose = require('mongoose');
const {Schema} = mongoose;


const userSchema = new Schema({
    name : {
        type:String,
        required : true
    },

    email : {
        type : String,
        required : true,
        uniquen : true,
    },
    userImage:{
        type:[String],
        required:true
    },
    phone : {
        type : String,
        required : false,
        unique : false,
        sparse : true,
        default : null
    },

    googleId: {
        type : String,
        unique : true,
    },

    password : {
        type : String,
        required : false,
    },

    isBlocked : {
        type : Boolean,
        default : false
    },

    isAdmin : {
        type : Boolean,
        default : false
    },
 
   

    // createdOn : {
    //     type : Date,
    //     default : Date.now,
    // },

    referalCode:{
        type : String,
        // required:true
    },

    redeemed : {
        type : Boolean,
        //default : false
    },

    redeemedUsers:[{
        type : Schema.Types.ObjectId,
        ref : 'user',
        // required:true

    }],

    searchHistory : [{
        category : {
            type : Schema.Types.ObjectId,
            ref : 'Category',
        },
        brand : {
            type : String
        },
        searchOn : {
            type : Date,
            default : Date.now
        }
    }]
     
},
 { timestamps: true }
);

const User = mongoose.model('User',userSchema);
module.exports = User;