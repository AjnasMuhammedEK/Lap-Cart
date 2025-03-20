const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');
const passport = require('passport');
const env = require('dotenv').config();



passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:"/auth/google/callback"
},


async (accessToken,refreshToken,profile,done)=>{
    try {


        console.log('1');
        

        let user = await User.findOne({googleId:profile.id})
        console.log(`from passport ${user}`);
        // let userBlock await User.findOne({isBlocked:false})
        if(!user.isBlocked){
           
            done(null,user)
            console.log('if==true');
            return
        }else{
            console.log('if==else - before save');

            user = new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id
            })

            await user.save()
            return done(null,user)
        }

    } catch (error) {
        
        console.log('catch bock');
        return done(error,null)
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