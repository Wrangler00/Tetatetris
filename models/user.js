var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

// User Schema

var UserSchema = mongoose.Schema({local:{
		username: {
			type: String,
			index:true
		},
		password: {
			type: String
		},
		email: {
			type: String
		},
		name: {
			type: String
		}
	},
	guest:{
		cookie:String,
		name:String,
		playing:Boolean,
	},
	token: {
			type:String
		},
	loggedIn:{
				type:Boolean
			}
});

var User = module.exports = mongoose.model('User', UserSchema);

module.exports.createUser = function(newUser,callback){
	bcrypt.genSalt(10, function(err, salt) {
	    bcrypt.hash(newUser.local.password, salt, function(err, hash) {
	        newUser.local.password = hash;
	        newUser.save(callback);
	    });
	});
}

module.exports.getUserByUsername = function(username,callback){
	var query = {'local.username': username};
	User.findOne(query, callback);
}

module.exports.getUserBydbid = function(username, callback){
	var query = {'_id': username};
	User.findOne(query, callback);
}

module.exports.getUserBycookie = function(cookie, callback){
	var query = {'guest.cookie': cookie};
	User.findOne(query,callback);
}

module.exports.getUserByEmail = function(useremail, callback){
	var query = {'local.email': useremail};
	User.findOne(query, callback);
}

module.exports.getUserById = function(id, callback){
	User.findById(id, callback);
}

module.exports.getUserByName = function(callback){
  User.find({}).sort('-name').exec(callback);
}

module.exports.comparePassword = function(candidatePassword, hash, callback){
	bcrypt.compare(candidatePassword, hash, function(err, isMatch) {
    	if(err) throw err;
    	callback(null, isMatch);
	});
}