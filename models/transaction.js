const mongoose = require('mongoose')
const {Schema} = mongoose


const walletTransactionSchema = new Schema({
    userId : {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
     transactionId: {
            type: String,
            unique: true,
            sparse: true,
            default: () => Math.random().toString(36).substr(2, 9)
        },
        amount: {
            type: Number,
            required: true        
        },
        type: {
            type: String,
            enum: ["Credit", "Debit"],
            required: true
        },
        method: {
            type: String,
            enum: ["Razorpay", "Cashback", "Refund","OrderPayment"],
            required: true
        },
        status: {
            type: String,
            enum: ["Pending", "Completed", "Failed"],
            default: "Pending"
        },
        date: {
            type: Date,
            default: Date.now
        },
        description: {
            type: String,
            default: "No description provided"
        },
        orderId:{
            type: String,
        },    
    
        lastUpdated: {
            type: Date,
            default: Date.now
        }
})


const walletTransaction = mongoose.model('walletTransaction',walletTransactionSchema)
module.exports = walletTransaction 