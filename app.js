
/**
 * Module dependencies.
 */
var express = require('express@2.5.8'),
    connect = require('connect@2.3.6'),
    jade = require('jade@0.26.1'),
    app = module.exports = express.createServer(),
    mongoose = require('mongoose@2.7.0'),
    mongoStore = require('connect-mongodb@1.1.4'),
    stylus = require('stylus@0.28.1'),
    connectTimeout = require('connect-timeout@0.0.1'),
//    util = require('util'),
//    path = require('path'),
    models = require('./models'),
    db,
    User;

app.configure('development', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.use(express.errorHandler({
		dumpExceptions: true, 
		showStack: true
	}));
});

app.configure('production', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.use(express.errorHandler());
});

// Models
models.defineModels(mongoose, function() {
	app.User = User = mongoose.model('User');
	db = mongoose.connect(app.set('db-uri'));
});

// Configuration
app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
//	app.use(express.favicon());
	app.use(express.bodyParser());
	app.use(express.cookieParser());
//	app.use(connectTimeout({ time: 10000 }));
	app.use(express.session({store: new mongoStore({db : db}), secret: 'topsecret'}));
//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))
	app.use(express.methodOverride());
//	app.use(stylus.middleware({ src: __dirname + '/public' }));
//	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
});


// Routes
function loadUser(req, res, next) {
//	if (req.session.user_id) {
//		User.findById(req.session.user_id, function(err, user) {
//			if (user) {
//				req.currentUser = user;
				next();
//			} else {
//				res.redirect('/login');
//			}
//		});
//	} else {
//		res.redirect('/login');
//	}
}

//app.get('/', loadUser, function(req, res) {
//	res.send('dotałeś się :)');
////	console.log('dostales sie');
//});



app.get('/', function(req, res) {
	res.send('dotałeś się :)');
});



//
//// Error handling
//function NotFound(msg) {
//  this.name = 'NotFound';
//  Error.call(this, msg);
//  Error.captureStackTrace(this, arguments.callee);
//}
//
//util.inherits(NotFound, Error);
//
//app.get('/404', function(req, res) {
//  throw new NotFound;
//});
//
//app.get('/500', function(req, res) {
//  throw new Error('An expected error');
//});
//
//app.error(function(err, req, res, next) {
//  if (err instanceof NotFound) {
//    res.render('404.jade', { status: 404 });
//  } else {
//    next(err);
//  }
//});
//
//if (app.settings.env == 'production') {
//  app.error(function(err, req, res) {
//    res.render('500.jade', {
//      status: 500,
//      locals: {
//        error: err
//      }
//    });
//  });
//}


// Login
app.get('/login', function(req, res) {
	res.send('Zaloguj sie');
});

// Login
app.get('/test', function(req, res) {
//	res.render('index');
	res.send('test');
});

app.listen(3000, function(){
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
