
/**
 * Module dependencies.
 */
var express = require('express'),
    jade = require('jade'),
    app = module.exports = express.createServer(),
    mongoose = require('mongoose'),
    Schema = mongoose.Schema,
    mongoStore = require('session-mongoose'),
    GridFS = require('GridFS').GridFS,
	ObjectID = mongoose.Types.ObjectId,
	GridStore = mongoose.mongo.GridStore,
    stylus = require('stylus'),
    connectTimeout = require('connect-timeout'),
    util = require('util'),
    path = require('path'),
    models = require('./models'),
	fileUpload = require('fileupload'),
	fs = require('fs'),
	fileuploadMiddleware,
    db,
	fileRepo,
    User,
    Criminal;

app.configure('development', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.locals({
		title: 'System iris',
		dir_host: 'http://localhost:3000',
		dir_public_images: 'http://localhost:3000/images'
	});
	app.use(express.errorHandler({
		dumpExceptions: true, 
		showStack: true
	}));
});

app.configure('production', function(){
	app.set('db-uri', 'mongodb://localhost/test');
	app.locals({
		title: 'System iris',
		dir_host: 'http://localhost:3000',
		dir_public_images: __dirname + '/public/images'
	});
	app.use(express.errorHandler());
});

// Models
models.defineModels(mongoose, function() {
	app.User = User = mongoose.model('User');
	app.Criminal = Criminal = mongoose.model('Criminal');
	db = mongoose.connect(app.set('db-uri'));
	
	fileRepo = new GridFS('test');
});

// Configuration
app.configure(function(){
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
//	app.use(express.favicon());
//	app.use(express.bodyParser());
	app.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname +'/tmp' }));
	app.use(express.cookieParser());
	app.use(connectTimeout({ time: 10000 }));


	app.use(express.session( {
			cookie: {maxAge: 1200000}, 
			store:  new mongoStore({url: app.set('db-uri'), interval: 1200000}), 
			secret: "idefix" 
		}));


//	app.use(express.session({store: new mongoStore({db : db}), secret: 'topsecret'}));
//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))



	app.use(express.methodOverride());
	app.use(stylus.middleware({ src: __dirname + '/public' }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
	
	fileuploadPublicMiddleware = fileUpload.createFileUpload(__dirname +'/public/tmp').middleware;
	fileuploadBackendMiddleware = fileUpload.createFileUpload(__dirname +'/tmp').middleware;
//	var fileuploadMiddleware = fileUpload.createFileUpload({
//		adapter: fileuploadGridfs({ database: 'test' })
//	}).middleware;
});


// Routes
function loadUser(req, res, next) {
	if (req.session.user_id) {
		User.findById(req.session.user_id, function(err, user) {
			if (user) {
				req.currentUser = user;
				res.local('currentUser', user);
				res.local('public_images', req.ip);
				next();
			} else {
				res.redirect('/login');
			}
		});
	} else {
		res.redirect('/login');
	}
}

app.get('/', loadUser, function(req, res) {
	res.render('index.jade', {
		locals: {
			user: req.currentUser
		}
	});
});

app.get('/identify', loadUser, function(req, res) {
	res.render('identify/index.jade', {
		locals: {
			user: req.currentUser
		}
	});
});

app.post('/identify', loadUser, fileuploadPublicMiddleware, function(req, res) {
//app.post('/identify', loadUser, function(req, res) {
	console.log(util.inspect(req.files, false, null));
	console.log(util.inspect(req.body, false, null));
	if (req.body.image && req.body.image[0]) {
		var image = req.body.image[0];
		image.publicPath = '/tmp/' + image.path + image.basename;
		res.render('identify/details.jade', {
			locals: {
				user: req.currentUser,
				image: image
			}
		});
	}
	else {
		res.render('identify/index.jade', {
			locals: {
				user: req.currentUser
			}
		});
	}
});

app.get('/criminals', loadUser, function(req, res) {
	Criminal.find({}, function(err, criminals) {
		res.render('criminal/index.jade', {
			locals: {
				user: req.currentUser,
				criminals: criminals
			}
		});
	});
});

app.get('/criminals/add', loadUser, function(req, res) {
	res.render('criminal/add.jade', {
		locals: {
			user: req.currentUser,
			criminal: new Criminal()
		}
	});
});

app.post('/criminals/add', loadUser, function(req, res) {
	var criminal = new Criminal(req.body.criminal);
	
	var errorFunction = function(err, criminal) {
		if (err) console.log(util.inspect(err, false, null));
		res.render('criminal/add.jade', {
			locals: {
				user: req.currentUser,
				criminal: criminal || new Criminal()
			}
		});
	}
	var successFunction = function() {
		res.redirect('/criminals');
	}
	
	var uploadFile= function(img, ownerId, typeData, callback) {
		fs.readFile(img.path, function(err, data){
			if (err) {
				callback(err);
			}
			else {
				var imageBuffer = new Buffer(data, 'binary');
				fileRepo.put(imageBuffer, undefined, 'w', { 'content_type' : img.type, 'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err){
					callback();
				});
			}
		});
	}
	
	criminal.save(function(err) {
		if (err) {
			errorFunction(err, criminal);
		}
		else {
			if (req.files) {
				if (req.files.img_general && req.files.img_iris) {
					uploadFile(req.files.img_general, criminal._id, 'general',function(err) {
						uploadFile(req.files.img_iris, criminal._id, 'iris', function(err) {
							successFunction();
						});
					});
				}
				else {
					successFunction();
				}
			}
			else {
				successFunction();
			}
		}
	});
});

app.get('/criminals/edit/:id', loadUser, function(req, res) {
	Criminal.findOne({_id: req.params.id}, function(err, criminal) {
		if (err) {
			res.redirect('/criminals');
		}
		else {
			res.render('criminal/edit.jade', {
				locals: {
					user: req.currentUser,
					criminal: criminal
				}
			});
		}
	});
});

app.post('/criminals/edit/:id', loadUser, function(req, res) {
	var criminal = new Criminal(req.body.criminal);
	
	var errorFunction = function(err, criminal) {
		if (err) console.log(util.inspect(err, false, null));
		res.render('criminal/edit.jade', {
			locals: {
				user: req.currentUser,
				criminal: criminal || new Criminal()
			}
		});
	}
	var successFunction = function() {
		res.redirect('/criminals');
	}
	
	var uploadFile= function(img, ownerId, typeData, callback) {
		fs.readFile(img.path, function(err, data){
			if (err) {
				callback(err);
			}
			else {
				var imageBuffer = new Buffer(data, 'binary');
				fileRepo.put(imageBuffer, undefined, 'w', { 'content_type' : img.type, 'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err){
					callback();
				});
			}
		});
	}
	
	Criminal.findByIdAndUpdate(req.params.id, req.body.criminal, function(err, criminal) {
		if (err) {
			errorFunction(err, criminal);
		}
		else {
			if (req.files) {
				if (req.files.img_general && req.files.img_iris) {
//					uploadFile(req.files.img_general, criminal._id, 'general',function(err) {
//						uploadFile(req.files.img_iris, criminal._id, 'iris', function(err) {
							successFunction();
//						});
//					});
				}
				else {
					successFunction();
				}
			}
			else {
				successFunction();
			}
		}
	});
});

app.get('/criminals/details/:id', loadUser, function(req, res) {
	Criminal.findOne({_id: req.params.id}, function(err, criminal) {
		if (err) {
			res.redirect('/criminals');
		}
		else {
			res.render('criminal/details.jade', {
				locals: {
					user: req.currentUser,
					criminal: criminal
				}
			});
		}
	});
});

/**
 * Statyczne pliki kryminalisy
 */
app.get('/static/criminal/:id', loadUser, function(req, res) {
	
	var notFound = function(err) {
		if (err) console.log(util.inspect(err, false, null));
		res.header('Content-Type', 'image/jpeg');
		fs.createReadStream(__dirname +'/public/images/no_pictures.jpg').pipe(res);
	}
	
	Criminal.findOne({_id: req.params.id}, function(err, criminal) {
		if (err) {
			notFound(err);
		}
		else {
			var Files = mongoose.model('files', new mongoose.Schema({}), 'fs.files');
			Files.find({'metadata.owner_id' : criminal._id}, function(err, data) {
				if (err) {
					notFound(err);
				}
				else {
					if (!data[0]) {
						notFound();
					}
					else {
						console.log(util.inspect(data[0]._id, false, null));
						var gs = new GridStore(db.connection.db, data[0]._id, null,'r');
						gs.open(function(err, store) {
							if (err) {
								notFound(err);
							}
							else {
								console.log(util.inspect('otworzono store', false, null));
								console.log(util.inspect(store.metadata, false, null));
								console.log(util.inspect(store.contentType, false, null));
								console.log(util.inspect(store.length - store.position, false, null));

								res.header('Content-Type', store.contentType);
								store.stream(true).pipe(res);
							}
						});
					}
				}
			})
		}
	});
});

// Error handling
function NotFound(msg) {
  this.name = 'NotFound';
  Error.call(this, msg);
  Error.captureStackTrace(this, arguments.callee);
}

util.inherits(NotFound, Error);

app.get('/404', function(req, res) {
  throw new NotFound;
});

app.get('/500', function(req, res) {
  throw new Error('An expected error');
});

app.error(function(err, req, res, next) {
  if (err instanceof NotFound) {
    res.render('404.jade', { status: 404 });
  } else {
    next(err);
  }
});

if (app.settings.env == 'production') {
  app.error(function(err, req, res) {
    res.render('500.jade', {
      status: 500,
      locals: {
        error: err
      }
    });
  });
}


// Login
app.get('/login', function(req, res) {
	res.render('user/login.jade', {
		layout: 'simple',
		locals: {
			title: 'Logowanie do systemu IRIS',
			user: new User()
		}
	});
});

app.post('/login', function(req, res) {
//	res.send('logowanie: ' + req.body.user.login +' - '+ req.body.user.password);
	User.findOne({ login: req.body.user.login }, function(err, user) {
		if (user && user.authenticate(req.body.user.password)) {
			req.session.user_id = user.id;
			res.redirect('/');
		} else {
//			req.flash('error', 'Incorrect credentials');
			res.render('user/login.jade', {
				layout: 'simple',
				locals: {
					title: 'Logowanie do systemu IRIS',
					user: user || new User()
				}
			});
		}
	});
	
});

// wylogowanie
app.get('/logout', loadUser, function(req, res) {
	if (req.session) {
		req.session.destroy(function() {});
	}
	res.redirect('/login');
});

// dodawanie usera
app.get('/addUser', function(req, res) {
	res.render('user/login.jade', {
		locals: {
			title: 'Logowanie do systemu IRIS',
			user: new User()
		}
	});
});

app.post('/addUser', function(req, res) {
  var user = new User(req.body.user);

  function userSaveFailed(err) {
	  res.send(err);
//    req.flash('error', 'Account creation failed');
//    res.render('users/new.jade', {
//      locals: { user: user }
//    });
  }

  user.save(function(err) {
    if (err) return userSaveFailed(err);

//    req.flash('info', 'Your account has been created');

//    switch (req.params.format) {
//      case 'json':
        res.send(user.toObject());
//      break;
//
//      default:
//        req.session.user_id = user.id;
//        res.redirect('/documents');
//    }
  });
});

app.listen(3000, function(){
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});