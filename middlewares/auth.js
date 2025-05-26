const User = require('../models/userSchema');
const userAuth = (req,res,next)=>{
    if(!req.session.user){
        return res.redirect('/login')
    }
    User.findOne({_id:req.session.user})
    .then(data => {
        if(data){
            next()
        }else{
            res.redirect('/login')
        }
    })
     .catch(error => {
            console.log('Error i userAuth middleware:', error);
            res.status(500).send('Internal Server Error');
        });
}
const adminAuth = (req, res, next) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    User.findOne({ _id: req.session.admin, isAdmin: true })
        .then(data => {
            if (data) {
                next();
            } else {
                res.redirect('/admin/login');
            }
        })
        .catch(error => {
            console.log('Error in adminAuth middleware:', error);
            res.status(500).send('Internal Server Error');
        });
};

module.exports = {
    userAuth,
    adminAuth
};