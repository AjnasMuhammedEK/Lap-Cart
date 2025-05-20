const Wallet = require('../../models/walletSchema')
const Transaction = require('../../models/transaction')
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');



const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;

        const type = req.query.type;

        const filter = {
            userId: userId
        };
        if (type) {
            filter.type = type;
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const userData = await User.findOne({ _id: userId });
        const wallet = await Wallet.findOne({ userId: userId });
        const transaction = await Transaction.find(filter)
            .sort({ date: -1 }) 
            .skip(skip)
            .limit(limit);

        const totalTransactions = await Transaction.countDocuments(filter);
        const totalPages = Math.ceil(totalTransactions / limit);

        res.render('wallet', {
            user: userData,
            wallet,
            transaction,
            currentPage: page,
            totalPages: totalPages,
            type: type || '' 
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};
 

module.exports = {
    loadWallet
}