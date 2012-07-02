
/**
 * Module dependencies.
 */
var express = require('express'),
	routes = require('./routes'),
	mongoose = require('mongoose'),
	models = require('./models'),
	User;

var app = module.exports = express.createServer();

app.configure('development', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.use(express.errorHandler());
});

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

// Models
models.defineModels(mongoose, function() {
  app.User = User = mongoose.model('User');
  db = mongoose.connect(app.set('db-uri'));
})

// Routes
function loadUser(req, res, next) {
  if (req.session.user_id) {
    User.findById(req.session.user_id, function(err, user) {
      if (user) {
        req.currentUser = user;
        next();
      } else {
        res.redirect('/login');
      }
    });
  } else {
    res.redirect('/login');
  }
}

// Login
app.get('/login', function(req, res) {
	res.send('Zaloguj sie');
  // res.render('sessions/new.jade', {
    // locals: { user: new User() }
  // });
});

app.get('/', loadUser, function(req, res) {
	res.send('dotałeś się :)');
});

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
