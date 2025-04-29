const Wallet = require('../../models/walletSchema')
const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema');




const loadWallet = async (req, res) => {
    try {
        const userId = req.session.user;
        const { page = 1 } = req.query;
        const limit = 5; // Number of transactions per page
        const skip = (page - 1) * limit;

        const userData = await User.findOne({ _id: userId });
        const wallet = await Wallet.findOne({ userId: userId });

        if (!wallet) {
            return res.render('wallet', {
                user: userData,
                wallet: { balance: 0, transactions: [] },
                currentPage: 1,
                totalPages: 1
            });
        }

        // Calculate total transactions and paginated transactions
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        const paginatedTransactions = wallet.transactions.slice(skip, skip + limit);

        res.render('wallet', {
            user: userData,
            wallet: {
                ...wallet._doc,
                transactions: paginatedTransactions
            },
            currentPage: parseInt(page),
            totalPages
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


module.exports = {
    loadWallet
}