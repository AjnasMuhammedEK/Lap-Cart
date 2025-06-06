const express = require('express');
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require('express-session');
const passport = require('./config/passport');
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const errorHandler = require('./middlewares/errorHandling');

const morgan = require('morgan');

db();

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use('/uploads', express.static('uploads'));
app.use(morgan('dev'));


app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}));

app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));



app.use('/',userRouter);
app.use('/admin',adminRouter);


app.use((req, res, next) => {
    res.status(404).render('page-404');
});

app.use(errorHandler);



app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})

app.use(passport.initialize());
app.use(passport.session());





const port = process.env.PORT || 3000;
app.listen(port,()=>{
    console.log(`server started at ${port}`);
});

module.exports = app;