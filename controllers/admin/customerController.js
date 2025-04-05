const Category = require('../../models/categorySchema');
const User = require('../../models/userSchema');



const customerInfo = async (req,res) => {
    try {

        let search='';
        if(req.query.search){
            search = req.query.search;
        }
        let page = 1;
        if(req.query.page){
            page = req.query.page;
        }

        const limit = 3;
        const userData = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*' + search + '.*'}},
                {email:{$regex:'.*' + search + '.*'}}
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                {name:{$regex:'.*' + search + '.*'}},
                {email:{$regex:'.*' + search + '.*'}}
            ]
        }).countDocuments();

        userData.forEach(user => {
            user.formattedDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US') : 'N/A';
        });

        res.render('coustomers',{
            data:userData,
            totalPages:Math.ceil(count/limit),
            currentPage:page
        });

    } catch (error) {
        res.redirect('/pageerror');
    }
};

const coustomerBlocked = async (req,res) => {
    try {
        
        let {user_id} = req.body;
        // console.log(user_id);
        await User.updateOne({_id:user_id},{$set:{isBlocked:true}});
        res.redirect('/admin/users');

    } catch (error) {
        res.redirect('/pageerror');
    }
};


const coustomerunBlocked = async (req,res) => {
    try {

        let id = req.query.id;

        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect('/admin/users');
        
    } catch (error) {
        res.redirect('/pageerror');
    }
};



module.exports = {
    customerInfo,
    coustomerBlocked,
    coustomerunBlocked,
   
};