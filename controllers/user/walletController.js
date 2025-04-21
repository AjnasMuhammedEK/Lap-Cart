const Wallet = require('../../models/walletSchema')
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');

const loadWallet = async (req,res) => {
    try {

        const userId = req.session.user
        const userData = await User.findOne({_id:userId})
        
        const wallet = await Wallet.findOne({userId:userId})
console.log(userData,wallet);
        res.render('wallet',{
            user:userData,
            wallet:wallet
        })
        
    } catch (error) {
        
    }
}

module.exports = {
    loadWallet
}