const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
const env = require('dotenv').config();
const Wallet = require('../models/walletSchema');
const { v4: uuidv4 } = require('uuid');




passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
},


async (accessToken, refreshToken, profile, done) => {
    try {
         
        let user = await User.findOne({googleId: profile.id});
         
        if(user) {
            if(!user.isBlocked) {
                return done(null, user);
            } else {
                return done(null, false);
            }
        } else {
            const referralCode = uuidv4().slice(0, 8)
            const newUser = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                referralCode:referralCode
            });

            await newUser.save();

            let newWallet = await Wallet.findOne({ userId: newUser._id });
        if (!newWallet) {
            newWallet = new Wallet({
                userId: newUser._id,
                balance: 0,
                currency: 'INR',
                transactions: [],
            });
            await newWallet.save();
         }
            return done(null, newUser);
        }
    } catch (error) {
        console.log('catch block', error);
        return done(error, null);
    }
}

));

passport.serializeUser((user,done)=>{
    done(null,user.id);
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user);
    })
    .catch(err =>{
        done(err,null);
    });
});


module.exports = passport;