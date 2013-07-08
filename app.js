
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
//	irisRec = require('./irisrec'),
	fs = require('fs'),
	gm = require('gm'),
	mongoSettings,
	fileuploadMiddleware,
    db,
    gfRepository,
	fileRepo,
    User,
    Criminal,
	Files;

var generate_mongo_url = function(obj){
    obj.hostname = (obj.hostname || 'localhost');
    obj.port = (obj.port || 27017);
    obj.db = (obj.db || 'test');

    if(obj.username && obj.password){
        return "mongodb://" + obj.username + ":" + obj.password + "@" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }else{
        return "mongodb://" + obj.hostname + ":" + obj.port + "/" + obj.db;
    }
}

app.configure('development', function(){
	mongoSettings = {
        "hostname":"localhost",
        "port":27017,
        "username":"",
        "password":"",
        "name":"",
        "db":"test"
    }
	app.set('app-host', 'localhost');
	app.set('app-port', '3000');
	app.set('db-uri', generate_mongo_url(mongoSettings));
	
	app.locals({
		title: 'System iris',
		dir_host: 'http://'+ app.set('app-host')+ ':'+ app.set('app-port'),
		dir_public_images: 'http://'+ app.set('app-host') +':'+ app.set('app-port') +'/images'
	});
	app.use(express.errorHandler({
		dumpExceptions: true, 
		showStack: true
	}));
});

app.configure('production', function(){
    var env = JSON.parse(process.env.VCAP_SERVICES);
    mongoSettings = env['mongodb-1.8'][0]['credentials'];
	app.set('app-host', 'iris.aws.af.cm');
	app.set('app-port', process.env.VCAP_APP_PORT || '3000');
	console.log(util.inspect(process.env, false, null));
	
	app.set('db-uri', generate_mongo_url(mongoSettings));
	
	app.locals({
		title: 'System iris',
		dir_host: 'http://'+ app.set('app-host'),
		dir_public_images: 'http://'+ app.set('app-host') +'/images'
	});
	app.use(express.errorHandler());
});

// Models
models.defineModels(mongoose, function() {
	app.User = User = mongoose.model('User');
	app.Criminal = Criminal = mongoose.model('Criminal');
	db = mongoose.connect(app.set('db-uri'));
	Files = mongoose.model('files', new mongoose.Schema({}), 'fs.files');
	
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
//	app.use(express.logger({ format: '\x1b[1m:method\x1b[0m \x1b[33m:url\x1b[0m :response-time ms' }))

app.use(express.methodOverride());
	app.use(stylus.middleware({ src: __dirname + '/public' }));
	app.use(app.router);
	app.use(express.static(__dirname + '/public'));
	
	fileuploadPublicMiddleware = fileUpload.createFileUpload(__dirname +'/public/tmp').middleware;
	fileuploadBackendMiddleware = fileUpload.createFileUpload(__dirname +'/tmp').middleware;
});


// Helpers

/**
 * GridFileRepository
 * 
 * Magazyn plikow oparty na GridFS w bazie mongodb
 */
function GridFileRepository() {
	
	/**
	 * Dodaje plik
	 * 
	 * @param {Object} img Plik znajdujacy sie na dysku
	 * @param {ObjectID} ownerId id wlasciciela pliku
	 * @param {String} typeData typ przechowywanych danych
	 * @param {fn} callback funkcja wywolywana po zakonczeniu operacji
	 */
	this.addFile = function(img, ownerId, typeData, callback) {
		var preCallback = function(err) {
			// usun plik z dysku
			fs.unlink(img.path, function (err) {
				if (err) return callback(err);
				callback();
			});
		}
		
		if (img.size <= 0) return preCallback(new Error('File is empty'));
		fs.readFile(img.path, function(err, data){ // odczytaj plik z dysku
			if (err) return preCallback(err);
			var imageBuffer = new Buffer(data, 'binary'); // stworz buffer z tego pliku
			// wgraj plik do magazynu
			fileRepo.put(imageBuffer, undefined, 'w', { 'content_type' : img.type, 'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err){
				if (err) return preCallback(err);
				preCallback();
			});
		});
	}
	
	/**
	 * Aktualizuje plik
	 * 
	 * @param {Object} img Plik znajdujacy sie na dysku
	 * @param {ObjectID} ownerId id wlasciciela pliku
	 * @param {String} typeData typ przechowywanych danych
	 * @param {fn} callback funkcja wywolywana po zakonczeniu operacji
	 */
	this.updateOrCreateFile = function(img, ownerId, typeData, callback) {
		console.log(util.inspect(img, false, null));
		var preCallback = function(err) {
			// usun plik z dysku
			fs.unlink(img.path, function (err) {
				if (err) return callback(err);
				callback();
			});
		}
		
		if (img.size <= 0) return preCallback(new Error('File is empty'));
		fs.readFile(img.path, function(err, fileOnDisc){ // odczytaj plik z dysku
			if (err) return preCallback(err);
			console.log(util.inspect({'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, false, null));
			Files.find({'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err, dataInFS) { //pobiera dane dla pliku z gridfs
				var oldId = (!err && dataInFS[0]) ? dataInFS[0]._id : null; // zapamietaj id starego pliku jesli taki byl
				
				// dodaj plik do bazy
				var imageBuffer = new Buffer(fileOnDisc, 'binary');
				fileRepo.put(imageBuffer, undefined, 'w', { 'content_type' : img.type, 'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err){
					if (err) return preCallback(err); // jesli nie powiodlo sie dodanie pliku zostaw stary
					if (oldId) { // jesli byl wczesniejszy plik
						// usun stary plik z bazy
						var gs = new GridStore(db.connection.db, oldId, null,'w');
						gs.unlink(function(err) {
							if (err) return preCallback(err);
							preCallback();
						});
					}
					else {
						preCallback();
					}
				});

			});
		});
	}
	
	/**
	 * Zwraca obiekt Stream danego pliku
	 * 
	 * @param {ObjectID} ownerId id wlasciciela pliku
	 * @param {String} typeData typ przechowywanych danych
	 * @param {fn} callback funkcja wywolywana po zakonczeniu operacji
	 */
	this.streamFile = function(ownerId, typeData, callback) {
		Files.find({'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err, data) {
			if (err) return callback(err);
			if (!data[0]) return callback(new Error('File is not found'));
			
			var gs = new GridStore(db.connection.db, data[0]._id, null,'r');
			gs.open(function(err, store) {
				if (err) return callback(err);
				callback(null, store.stream(true));
			});
		});
	}
	
	/**
	 * Zwraca obiekt Stream danego pliku
	 * 
	 * @param {ObjectID} ownerId id wlasciciela pliku
	 * @param {String} typeData typ przechowywanych danych
	 * @param {fn} callback funkcja wywolywana po zakonczeniu operacji
	 */
	this.existFile = function(ownerId, typeData, callback) {
		Files.find({'metadata' : { 'owner_id' : ownerId, 'type_data' : typeData }}, function(err, data) {
			if (err) return callback(err);
			if (!data[0]) return callback(new Error('File is not found'));
			callback(null, true);
		});
	}
}
gfRepository = new GridFileRepository();


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

//app.get('/identify', loadUser, function(req, res) {
app.get('/identify', function(req, res) {
	
	var dir = __dirname + '/tmp';
	var irisName = 'iris.jpg';
//	irisRec.identify(irisName, dir);
	
	console.log(util.inspect('irisRecognition', false, null));
	
	gm(dir + '/iris.jpg')
	.gaussian(5, 1.4)
//	.edge(2)
//	.monochrome(2)
//	  .blur(10)
//	  .edge(1)
//	  .write(dir + '/iris_edge.jpg', function(err){
//		if (err) return console.dir(arguments)
//		console.log(this.outname + ' created :: ' + arguments[3])
//	  }
//	) 
    .stream(function (err, stdout, stderr) {
	if (err) return console.dir(arguments)
      stdout.pipe(res);
    });
		
	
//	gm(dir + irisName)
//	.resize('200', '200')
//	.write(dir + irisName, function (err) {
//		if (err) console.log(util.inspect(err, false, null));
//	});
//	
	
	
//	res.send('Identyfikacja');
	
//	res.render('identify/index.jade', {
//		locals: {
//			user: req.currentUser
//		}
//	});
});

app.post('/identify', loadUser, fileuploadPublicMiddleware, function(req, res) {
	console.log(util.inspect(req.files, false, null));
	console.log(util.inspect(req.body, false, null));
	if (req.body.image && req.body.image[0]) {
		var image = req.body.image[0];
		image.publicPath = '/tmp/' + image.path + image.basename;
		var imageBackendPath = __dirname + '/public' + image.publicPath;
		
		
		
		console.log(util.inspect(imageBackendPath, false, null));
		
		
		
		
//		res.render('identify/details.jade', {
//			locals: {
//				user: req.currentUser,
//				image: image
//			}
//		});
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
	
	criminal.save(function(err) {
		if (err) return errorFunction(err, criminal);
		if (!req.files) return successFunction();
		if (!req.files.img_general || !req.files.img_iris) return successFunction();
		
		gfRepository.addFile(req.files.img_general, criminal._id, 'general',function(err) {
			gfRepository.addFile(req.files.img_iris, criminal._id, 'iris', function(err) {
				successFunction();
			});
		});
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
	
	Criminal.findByIdAndUpdate(req.params.id, req.body.criminal, function(err, criminal) {
		if (err) return errorFunction(err, criminal);
		if (!req.files) return successFunction();
		console.log(util.inspect(req.files, false, null));
		if (!req.files.img_general || !req.files.img_iris) return successFunction();
		
		gfRepository.updateOrCreateFile(req.files.img_general, criminal._id, 'general',function(err) {
			gfRepository.updateOrCreateFile(req.files.img_iris, criminal._id, 'iris', function(err) {
				if (err) console.log(util.inspect(err, false, null));
				successFunction();
			});
		});
	});
});

app.get('/criminals/details/:id', loadUser, function(req, res) {
	Criminal.findOne({_id: req.params.id}, function(err, criminal) {
		if (err) {
			res.redirect('/criminals');
		}
		else {
			gfRepository.existFile(criminal._id, 'iris', function(err, exist) {
				res.render('criminal/details.jade', {
					locals: {
						user: req.currentUser,
						criminal: criminal,
						exist_iris: exist ? true : false
					}
				});
			});
		}
	});
});

/**
 * Statyczne pliki kryminalisy
 */
app.get('/static/criminal/:id', loadUser, function(req, res) {
	console.log(util.inspect(req.query, false, null));
	
	var typeData = req.query.type ? req.query.type : 'general';
	
	var notFound = function(err) {
		if (err) console.log(util.inspect(err, false, null));
		res.header('Content-Type', 'image/jpeg');
		fs.createReadStream(__dirname +'/public/images/no_pictures.jpg').pipe(res);
	}
	
	Criminal.findOne({_id: req.params.id}, function(err, criminal) {
		if (err) return notFound(err);
		
		gfRepository.streamFile(criminal._id, typeData, function(err, stream){
			if (err) return notFound(err);
			res.header('Content-Type', stream.gstore.contentType);
			stream.pipe(res);
		});
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
app.get('/adduser', function(req, res) {
	res.render('user/login.jade', {
		layout: 'simple',
		locals: {
			title: 'Logowanie do systemu IRIS',
			user: new User()
		}
	});
});


app.post('/adduser', function(req, res) {
  var user = new User(req.body.user);

  function userSaveFailed(err) {
	  if (err) console.log(util.inspect(err, false, null));
	  res.redirect('/adduser');
  }

  user.save(function(err) {
    if (err) return userSaveFailed(err);
	res.send(user.toObject());
  });
});

app.listen(process.env.VCAP_APP_PORT || 3000, function(){
	console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
	console.log("Version node is "+ process.version);
});