const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
const env = require('dotenv').config();



passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:"/auth/google/callback"
},


async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('1');
        
        let user = await User.findOne({googleId: profile.id});
        console.log(`from passport ${user}`);
        
        if(user) {
            if(!user.isBlocked) {
                return done(null, user);
            } else {
                return done(null, false);
            }
        } else {
            const newUser = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id
            });

            await newUser.save();
            return done(null, newUser);
        }
    } catch (error) {
        console.log('catch block', error);
        return done(error, null);
    }
}

))

passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err =>{
        done(err,null)
    })
})


module.exports = passport;