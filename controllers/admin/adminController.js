const User = require('../../models/userSchema');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');



const pageerror = async (req,res)=>{
    res.render('admin-error');
};


const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect(('/admin/dashboard'));
    }
    res.render('admin-login',{message:null});
};

const login = async (req,res)=>{
    try {

        const {email,password} = req.body;

        const admin = await User.findOne({email,isAdmin:true});

        // console.log('its from admin');

        if(admin){
            const passwordMatch = bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin = admin._id;
                return res.redirect('/admin/dashboard');
            }else{
                return res.redirect('/admin/login');
            }
        }else{
            return res.redirect('/admin/login');
        }
        
    } catch (error) {
        console.log('login error',error);
        return res.redirect('/pageerror');
    }
};

 


const logout = async (req,res) =>{
    // console.log('11');
    try {
        // console.log('1');
        // req.session.destroy(err=>{
        //     if(err){
        //         console.log('Error destroying session',err);
        //         return res.redirect('/pageerror');
        //     }
        //     res.redirect('/admin/login');
        // });
         req.session.admin = null
        return res.redirect('/admin/login');


    } catch (error) {
        console.log('unexpected error during logout',error);
        res.redirect('/pageerror');
    }
};


module.exports = {
    loadLogin,
    login,
    pageerror,
    logout
};