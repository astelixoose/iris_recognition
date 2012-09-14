var crypto = require('crypto'),
User, Criminal;

function defineModels(mongoose, fn) {
	var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

	function validatePresenceOf(value) {
		return value && value.length;
	}
  
	/**
    * Model: User
    */
	User = new Schema({
		'login': {
			type: String, 
			validate: [validatePresenceOf, 'To pole jest wymagane'], 
			index: {
				unique: true
			}
		},
		'hashed_password': String,
		'salt': String
	});

	User.virtual('id')
	.get(function() {
		return this._id.toHexString();
	});

	User.virtual('password')
	.set(function(password) {
		this._password = password;
		this.salt = this.makeSalt();
		this.hashed_password = this.encryptPassword(password);
	})
	.get(function() {
		return this._password;
	});

	User.method('authenticate', function(plainText) {
		return this.encryptPassword(plainText) === this.hashed_password;
	});
  
	User.method('makeSalt', function() {
		return Math.round((new Date().valueOf() * Math.random())) + '';
	});

	User.method('encryptPassword', function(password) {
		return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
	});

	User.pre('save', function(next) {
		if (!validatePresenceOf(this.password)) {
			next(new Error('Invalid password'));
		} else {
			next();
		}
	});

	mongoose.model('User', User, 'user');
  
	/**
    * Model: Criminal
    */
	Criminal = new Schema({
		'firstname': {
			type: String, 
			validate: [validatePresenceOf, 'To pole jest wymagane'],
			trim: true
		},
		'lastname': {
			type: String, 
			validate: [validatePresenceOf, 'To pole jest wymagane'],
			trim: true
		},
		'date_of_birth': {
			type: String
		},
		'height': {
			type: Number
		},
		'eye_color': {
			type: String,
			trim: true
		},
		'last_address': { 
			type: Number,
			min: 18,
			max: 65,
			trim: true
		},
		'characteristics': {
			type: String,
			trim: true
		},
		'parents_name': {
			type: String,
			trim: true
		},
		'prison_sentence': {
			type: String,
			trim: true
		},
		'content_penalty': {
			type: String,
			trim: true
		},
		'others': {
			type: String,
			trim: true
		}
	});

	Criminal.virtual('id')
	.get(function() {
		return this._id.toHexString();
	});

	mongoose.model('Criminal', Criminal, 'criminal');



	fn();
}

exports.defineModels = defineModels; 
