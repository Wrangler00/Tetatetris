var express = require('express');
var router = express.Router();

// Get Homepage
router.get('/', ensureAuthenticated, function(req, res){
	console.log("Inside router.get of ensureAuthenticated in routes of index.js");
	res.render('index');
});

function ensureAuthenticated(req, res, next){
	console.log("Inside ensureAuthenticated function in routes of index.js");
	
	if(req.isAuthenticated()){
		console.log("Inside if part of ensureAuthenticated in routes of index.js");
	
		return next();
	}else{
		console.log("Inside else part of ensureAuthenticated in routes of index.js");
		res.redirect('/users/login');
	}
}

module.exports = router;