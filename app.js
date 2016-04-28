process.env.PWD = process.cwd();
var express = require('express');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session)
var flash = require('connect-flash');
var bodyParser = require('body-parser');
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var methodOverride = require('method-override')
var mongoose = require('mongoose');
var moment = require('moment');
var bcrypt = require('bcrypt-node');
var passport = require('passport');
var async = require('async');
var fs = require("fs");
var upload = multer({ dest: './assets/boletos/' });
var app = express();

moment.locale('pt-BR', {
    weekdays : [
        "Domingo", "Segunda-Feira", "Terça-Feira", "Quarta-Feira", "Quinta-Feira", "Sexta-Feira", "Sábado"
    ]
});

// DataBase Connection
mongoose.connect('mongodb://localhost/condo');
var db = mongoose.connection;

db.on('error', function(msg) {
  console.log('Mongoose connection error %s', msg);
});

db.once('open', function() {
  console.log('Mongoose connection established');

 //Schemas:
  var userSchema = mongoose.Schema({
  name: {type: String, required: true},
  email: {type:  String, required:  true, index: {unique:  true}},
  password: {type: String, required:  true},
  apartment: {type: String, required: true},
  sindico: {type: Boolean, default: false},
  admin: {type: Boolean, default: false}
  });

userSchema.methods.generateHash = function(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.isValidPassword = function(password) {
  return bcrypt.compareSync(password, this.password);
};

var postSchema = mongoose.Schema({
content: {type: String, required: true},
postedById: {type: String, required: true},
postedByName: {type: String, required: true},
postedByApartment: {type: String, required: true},
date: { type: Date, default: Date.now }
});

var contractorSchema = mongoose.Schema({
name: {type: String, required: true},
phone: {type: String, required: true},
profession: {type: String, required: true},
comment: {type: String, required: true},
postedById: {type: String, required: true},
postedByName: {type: String, required: true},
postedByApartment: {type: String, required: true},
date: { type: Date, default: Date.now }
});

var partySchema = mongoose.Schema({
date: Date,
period: {type: String, required: true},
clean: {type: String, required: true},
postedByName: {type: String, required: true},
postedByApartment: {type: String, required: true},
postedById: {type: String, required: true},
});



// models
var User = mongoose.model('users', userSchema);
var Post = mongoose.model('posts', postSchema);
var Contractor = mongoose.model('contractors', contractorSchema);
var Party = mongoose.model('parties', partySchema);




// set the view engine to ejs
app.set('view engine', 'ejs');


// middleware

app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride(function(req, res) {
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method
    delete req.body._method
    return method
  }
}));

app.use(session({
        secret: 'secret', 
        resave: true,
        saveUninitialized: true,
        cookie: { maxAge: 60000*1000*24 },
        store: new MongoStore({ mongooseConnection: mongoose.connection })
      }));

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.use(flash());
app.use(function(req, res, next) {
  res.locals.message = req.flash();
  next();
});


//app.use(express.static('assets'));
app.use(express.static(__dirname + '/assets'));




//ROUTES


app.get('/login', function(req, res){
  if (req.user){     
    res.redirect('/')
  } else {
  res.render('login');
  }
});


app.post('/login', function(req, res) {
  
  User.findOne({email: req.body.email}, function(err, user) {
      if (err) {
      res.status(500);
      res.render('500');  
      console.log('500 error');
    } else if (!user || !user.isValidPassword(req.body.password)) {
      req.flash('danger', 'Nome ou senha inválidos');
      res.redirect('/login');
    } else {
     req.login(user, function(err) {
        if (err) { 
        res.status(500);
        res.render('500');
        console.log('500 error'); 
      } else {
        console.log("logged: " + req.user.name);
        res.redirect('/');
      }
    });
  }
 });  
});

app.get('/logout', function(req, res) {
  req.logout();
  req.flash('success', "Logout efetuado com sucesso.");
  res.redirect('/login');
});

app.post('/signup', function(req, res) {
  User.findOne({name: req.body.email}, function(err, user) {
    if (err) {
      res.status(500);
      res.render('500');
      console.log('500 error 1');
    } else if (user) {
      req.flash('danger', 'Usuário já existe');
      res.redirect('/login');
    } else {
      var user = new User();
      user.name = req.body.name;
      user.apartment = req.body.apartment;
      user.email = req.body.email;
      user.password = user.generateHash(req.body.password);
      user.save(function(err) {
        if (err) {
          res.status(500);
          res.render('500');
          console.log('500 error 2');
        } else {
          req.login(user, function(err){ 
            if(err){
            res.status(500);
            res.render('500');
            console.log('500 error 3') 
            } else
          req.flash('success', "Obrigado por se cadastrar");
          res.redirect('/');
          });
        }
      });
    }
  });
});



app.all('/*', function (req, res, next) { //<-----login wall
  if (!req.isAuthenticated()) {
    res.redirect('/login');
  } else {
   next();
  }
});



app.get('/', function(req, res) {
 async.parallel([
   function(callback) { 
        Post.find({}).sort('-date').limit(5).exec(function(err, posts){
            callback(null, posts);
        });
    },
   function(callback) { 
        Contractor.find({}).limit(5).exec(function(err, contractors){
          callback(null, contractors);
    });
  },
  function(callback) { 
        Party.find({}).limit(5).exec(function(err, parties){
          callback(null, parties);
    });
  }      
], function(err, results) {
    var posts = results [0];
    var contractors = results[1];
    var parties = results [2]
    res.render('index', {posts: posts, contractors:contractors, parties:parties, currentUser: req.user, moment: moment});
  });  
});


app.get('/recados', function (req, res) {
  Post.find({}).sort('-date').exec(function(err, posts){
  res.render('posts', {posts: posts, currentUser: req.user, moment: moment});
  });
});


app.get('/recados/new', function (req, res) {
  res.render('newpost', {currentUser: req.user});
});


app.post('/recados/new', function(req, res) {
      var post = new Post();
      post.content = req.body.content;
      post.postedById = req.user.id;
      post.postedByName = req.user.name,
      post.postedByApartment = req.user.apartment 
      post.save(function(err) {
        if (err) {
          res.status(500);
          res.render('500');
          console.log('500 error 2');
        } else {
          req.flash('success', "seu recado foi postado");
          res.redirect('/recados');
         }
       });
     });

app.delete('/recados', function(req, res) {
  Post.findByIdAndRemove(req.body.postId, function(err) {
    if (err) {
      res.status(500);
      res.render('500');
      console.log("db save error in DELETE");
      res.render(err);
    } else {
      console.log("post deletado");
       req.flash('success', "seu recado foi deletado");
      res.redirect('/recados');
    }
  });
});

app.get('/fornecedores', function (req, res) {
  Contractor.find({}).exec(function(err, contractors){
  res.render('contractors', {contractors: contractors, currentUser: req.user});
  });
});


app.get('/fornecedores/new', function (req, res) {
  res.render('newcontractor', {currentUser: req.user});
});


app.post('/fornecedores/new', function(req, res) {
      var contractor = new Contractor();
      contractor.name = req.body.name;
      contractor.profession = req.body.profession;
      contractor.phone = req.body.phone;
      contractor.comment = req.body.comment;
      contractor.postedById = req.user.id;
      contractor.postedByName = req.user.name,
      contractor.postedByApartment= req.user.apartment; 
      contractor.save(function(err) {
        if (err) {
          res.status(500);
          res.render('500');
          console.log('500 error 2');
        } else {
          req.flash('success', "fornecedor cadastrado");
          res.redirect('/fornecedores');
         }
       });
     });


app.delete('/fornecedores', function(req, res) {
  Contractor.findByIdAndRemove(req.body.contractorId, function(err) {
    if (err) {
      res.status(500);
      res.render('500');
      console.log("db  error in DELETE");
    } else {
      console.log("fornecedor deletado");
       req.flash('success', "fornecedor deletado");
       res.redirect('/fornecedores');
    }
  });
});


app.get('/salao', function (req, res) {
  Party.find({}).sort('date').exec(function(err, parties){
  res.render('parties', {parties: parties, currentUser: req.user, moment: moment});
  });
});


app.get('/salao/new', function (req, res) {
  res.render('newparty', {currentUser: req.user});
});


app.post('/salao/new', function (req, res) {
      var party = new Party();
      party.date = new Date(req.body.date);
      party.period = req.body.period;
      party.clean = req.body.clean;
      party.postedById = req.user.id;
      party.postedByName = req.user.name,
      party.postedByApartment= req.user.apartment; 
      party.save(function(err) {
        if (err) {
          res.status(500);
          res.render('500');
          console.log('500 error 2');
        } else {
          req.flash('success', "festa agendada");
          res.redirect('/salao');
         }
       });
     });

app.delete('/salao', function(req, res) {
  Party.findByIdAndRemove(req.body.partyId, function(err) {
    if (err) {
      res.status(500);
      res.render('500');
      console.log("db  error in DELETE");
    } else {
      console.log("festa deletada");
       req.flash('success', "festa deletada");
       res.redirect('/salao');
    }
  });
});




//END OF ROUTES

}); //<--closes the connection with DataBase


// THIS IS THE SERVER

var server = app.listen(process.env.PORT || 3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);
});