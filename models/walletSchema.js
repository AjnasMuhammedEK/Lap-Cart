    const mongoose = require('mongoose');
    const {Schema} = mongoose;

    const walletSchema = new Schema({
        userId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },
        balance: {
            type: Number,
            required: true,
            default: 0,
            min: 0
        },
        currency: {
            type: String,
            default: "INR" 
        },
    }, {
        timestamps: true
    });


    const Wallet = mongoose.model('wallet',walletSchema);
    module.exports = Wallet;