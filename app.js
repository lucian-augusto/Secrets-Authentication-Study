//jshint esversion:6

// Requiring packages
require('dotenv').config(); // Requiring the package that allows the use of Environment Variables
const bodyParser = require('body-parser');
const ejs = require('ejs');
const express = require('express');
const mongoose = require('mongoose');
// const encrypt = require('mongoose-encryption');
// const md5 = require('md5');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const findOrCreate = require('mongoose-findorcreate');

// Setting up Strategies
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Setting up the 'app' constant
const app = express();

// Setting up ejs, body-parser and public folder
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static('public'));

// Setting up session
app.use(session({
  secret: 'Our little secret.',
  resave: false,
  saveUninitialized: false
}));

// Setting up/Using passport (starting passport)
app.use(passport.initialize());

// Using passport to manage the sessions
app.use(passport.session());

// Connecting MongoDB/mongoose
mongoose.connect('mongodb://localhost:27017/userDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});

// Creating Schemas
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

// Adding the passport to the userSchema as a plugin
userSchema.plugin(passportLocalMongoose);

// Adding the findOrCreate plugin to the Schema
userSchema.plugin(findOrCreate);

// // Encrypting the schema in the database (Only the password)
// userSchema.plugin(encrypt, {
//   secret: process.env.SECRET,
//   encryptedFields: ['password']
// }); // This should be done before creating the model!

// Creating Model
const User = new mongoose.model('User', userSchema);

// Passport-local Configuration
// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

// Setting up Google OAuth
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/secrets',
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo'
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

// Setting up home Route
app.get('/', function(req, res) {
  res.render('home');
});

// Setting up the '/auth/google' route
app.get('/auth/google',
  passport.authenticate('google',{scope: ['profile']})
);

// Setting up the '/auth/google/secrets' route
app.get('/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect secrets.
    res.redirect('/secrets');
  });

// Setting up login Route
app.get('/login', function(req, res) {
  res.render('login');
});

// Setting up register Route
app.get('/register', function(req, res) {
  res.render('register');
});

// Setting up the get request for the '/submit' route
app.get('/submit',function(req,res){
  if (req.isAuthenticated()) {
    res.render('submit');
  } else {
    res.redirect('/login');
  }
});

// Setting up post request for the '/register' route
app.post('/register', function(req, res) {
  // Setting up registration with passport/pasport-local-mongoose
  User.register({
    username: req.body.username
  }, req.body.password, function(err, user) {
    if (!err) {
      passport.authenticate('local')(req, res, function() {
        res.redirect('/secrets');
      });
    } else {
      console.log(err);
      res.redirect('/register');
    }
  });

  // // Generating salted hash with bcrypt
  // bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
  //   // Store hash in your password DB.
  //   const newUser = new User({
  //     email: req.body.username,
  //     password: hash
  //   });
  //
  //   newUser.save(function(err) {
  //     if (!err) {
  //       res.render('secrets');
  //     } else {
  //       console.log(err);
  //     }
  //   });
  // });

  // Creating new user using basic md5 hash (no hash at all)
  // const newUser = new User({
  //   email: req.body.username,
  //   password: md5(req.body.password)
  // });
  //
  // newUser.save(function(err) {
  //   if (!err) {
  //     res.render('secrets');
  //   } else {
  //     console.log(err);
  //   }
  // });
});

// Setting up the '/secrets' route
app.get('/secrets', function(req, res) {
  User.find({'secret': {$ne:null}}, function(err, foundUsers){
    if(err){
      console.log(err);
    } else{
      if(foundUsers){
        res.render('secrets', {userWithSecrets: foundUsers});
      }
    }
  });
});

 // Setting up the post request for the '/submit' Route
 app.post('/submit',function(req,res){
   const submittedSecret = req.body.secret;

   console.log(req.user.id);

   User.findById(req.user.id, function(err,foundUser){
     if(err){
       consloe.log(err);
     }else{
       if(foundUser){
         foundUser.secret = submittedSecret;
         foundUser.save(function(){
           res.redirect('/secrets');
         });
       }
     }
   });
 });

// Setting up the '/logout' Route
app.get('/logout',function(req,res){
  req.logout(); // logout the current user
  res.redirect('/');
});

// Setting up the post request for the '/login' route
app.post('/login', function(req, res) {
  // Authenticating using Passport
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  // Authentication
  req.login(user,function(err){
    if(!err){
      passport.authenticate('local')(req,res,function(){
        res.redirect('/secrets');
      });
    }else{
      console.log(err);
    }
  });

  // const username = req.body.username;
  // // const password = md5(req.body.password);
  // const password = req.body.password;
  //
  // //  Finding the user
  // User.findOne({
  //   email: username
  // }, function(err, foundUser) {
  //   if (!err) {
  //     if (foundUser) {
  //       // if (foundUser.password === password) {
  //       //   res.render('secrets');
  //       // }
  //
  //       // Comparing the password using bcrypt
  //       bcrypt.compare(password, foundUser.password, function(err, result) {
  //         // res == true
  //         if(result){
  //           res.render('secrets');
  //         }
  //       });
  //     }
  //   } else {
  //     console.log(err);
  //   }
  // });
});

// Setting up the port listener
app.listen(3000, function() {
  console.log('Server started on port 3000.');
});
