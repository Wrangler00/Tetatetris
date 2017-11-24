var util = require('util');
var express = require('express');
var router = express.Router();
var nodemailer = require('nodemailer');
var cookieParser = require('cookie-parser');

// Init App
var app = express();
var http = require('http').Server(app);
var https = require('https');
var User = require('../models/user');

app.use(cookieParser());
var User = require('../models/user');
var Trophy = require('../models/trophy');
var configAuth = require('./auth.js');
var transporter = nodemailer.createTransport('smtps://teteateteris@gmail.com:123password123@smtp.gmail.com');
var session_id,Pass_email,player_type,url_parameter,trophytable_id,userIdChanging,userDetailsChanging;
var registering_user;
var mailOptions,subject,text,html;

router.get ('/',function(req,res){
	res.render('layout');
});

router.get('/index',function(req,res){
	console.log("---------inside index get");
	res.render('index');
});

function send_mail(email,subject,text,html){
	console.log("Inside send_mail function");
	mailOptions = {
		from: '"SNA Power - Tech. Division 👥" <danish.saleem@iitrpr.ac.in>', // sender address 
		to: email, // list of receivers 
		subject: subject, // Subject line 
		text: text, // plaintext body 
		html: html  // html body 
	};
}

router.post('/login',function(req, res){	
  console.log("---guest route hit success");
  var email = req.body.email;
  var password = req.body.password;
   
  var data1={};
  var data2 ={};
  var error = false;
  if(email == '' || email == null){
	data1["email"]={
						email:"email is empty"
					};
	error =true;
  }else{
		data1["email"]={
						email:''
					};
  }
  if(password == '' || password == null){
	data1["password"]={
						password:"password is empty"
					};
	error = true;
  }else{
	data1["password"]={
						password:''
					};
  }
  if(error){
	data2 = {
				response:false,
				details:'',
				data:data1
			}
	res.end(JSON.stringify(data2));
  }
  else{
  User.getUserByEmail(email, function(err,user){
		console.log(email);
//		console.log(user.loggedIn);
		if(err) throw err;
	    if(!user || user == null){
			var data = {
							response:false,
							details:"No such user!",
							data:data1
						};
			res.end(JSON.stringify(data));
		}/*else if(user.loggedIn != null || user.loggedIn == true || user.loggedIn != undefined){
			var data =  {
							response:false,
							details:"One User is already using this id!!",
							data:data1
					    }
			res.end(JSON.stringify(data));
		}*/
		else{
			//console.log(user);
	//		user.loggedIn = true;
			
			User.comparePassword(password,user.local.password, function(err, isMatch){
				if(err) throw err;
				console.log("Inside User.comparePassword--------------");
				if(isMatch){
					console.log("Inside if part of User.comparePassword-----------------");
					var token = guid();					
					user.local.token = token;
					var data = {
									response:true,
									db_id:user._id,
									token:token
							   };
					res.end(JSON.stringify(data));
				} else {
					console.log("Inside else part of User.comparePassword-----------------------");
					var data = {
									response:false,
									details:"Wrong password",
									data:data1
							   };
					res.end(JSON.stringify(data));
				}
			});
		}
	});
}
});

router.post('/guest',function(req, res){	
  console.log("----------guest route hit success");
  var username = req.body.user_name;
  var password = req.body.password;
  console.log("--------guest values-----");
  console.log(username);
  
  if(username == '' || username == null){
	var data = {
					response:false,
					details:"username is empty"
			   };
	res.end(JSON.stringify(data));
  }
  //console.log(password);
  //User.getUserBycookie(password, function(err, user){
   	//if(err) throw err;
	
   	//if cookie present (checked in terms of password)
	//if(user){
						/*var token = guid();
						user.guest.name = username;
						user.token = token;
						user.save();
						
						Trophy.getUserBydbid(user._id,function(err,user_temp){
							if(err) throw err;
							if(user_temp){
								user_temp.name = user.guest.name;
								user_temp.trophies = user.guest.trophies;
								user_temp.token = token;
								user_temp.save();
								console.log("inside guest userid:  ");
								var data = {
										response:true,
										db_id:newUser._id,
										token:token
									};
								res.end(JSON.stringify(data));
							}
							else{
								console.log("some problem with updating guest user by db id!");
								var data = {
										response:false
									};
								
								res.end(JSON.stringify(data));
							}
						});
	    	}*/
	//if cookie not present
   	// else{				
						var token = guid();					
						console.log("token value in guest:  "+token);
						var newUser = new User();
						newUser.guest.cookie = newUser._id;
						newUser.token = token;
						trophytable_id = newUser._id;
	    				newUser.guest.name = username;
	    				newUser.loggedIn = true;
						newUser.save(function(err){
	    					if(err)	throw err;
						});
						var newTrophy = new Trophy();
						newTrophy.trophy_id = trophytable_id;
						newTrophy.trophies =800;
						newTrophy.rank = "Bronze";
						newTrophy.name =username;
						newTrophy.Level = 1;
						newTrophy.token = token;
						 
						Trophy.createUser(newTrophy, function(err, user){
							if(err) throw err;
							console.log("new user created in DB");
							var data = {
											response:true,
											db_id:newUser._id,
											token:token
										}
							res.end(JSON.stringify(data));
						});						
	  // }
  //});
});

// Register User
router.post('/register',function(req, res){	
	console.log("Inside router.post of register!!!!!");
	
	var name = req.body.name;
	var email = req.body.email;
	var username = req.body.username;
	var password = req.body.password;
	var password2 = req.body.confirmpass;
	
	console.log(name);
	console.log(email);
	console.log(username);
	console.log(password);
	console.log(password2);
	
	// Validation
	var data={};
	var errors = false;
	
	if(name =='' || name ==null){
		data["name"]={
						name:"name is empty"
					};
		errors = true;
	}else{
		data["name"]={
						name:''
					};
	}
	
	if(username=='' || username==null){
		data["username"]={
						username:"username is empty"
					}; 
		errors = true;
	}else{
		data["username"]={
						username:''
					}; 
	}
	
	if(email=='' || email==null){
		data["email"]={
						email:"email is empty"
					};
		errors = true;
	}else{
		data["email"]={
						email:''
					};
	}
	
	if(password=='' || password==null){
		data["password"]={
						password:"password is empty"
					};
		errors = true;
	}else{
		data["password"]={
						password:''
					};
	}
	
	if(password2=='' || password2==null){
		data["password2"]={
						password2:"confirm password is empty"
					};
		errors = true;
	}else{
		data["password2"]={
						password2:''
					};
	}
	
	if(password != password2){
		data["passmatch"]={
						passmatch:"password and confirmPass should be same"
					};
		errors = true;
	}else{
		data["passmatch"]={
							passmatch:''
						  };
	}
	if(errors){
		var data2 = {
						response:false,
						details:data
					};
		res.end(JSON.stringify(data2));					
	}else{
			console.log("Else part of router.post of register*******");
			User.getUserByEmail(email, function(err,user){	
				if(err) {
						throw err;
						var data={
									response:false,
									details:err
								};
						res.end(JSON.stringify(data));
					}
				if(user){
					req.flash('error_msg', 'User Email already registered. Please Login');
					var data = {
									response:false,
									details:'User Email already registered. Please Login with different email!'
								}
					res.end(JSON.stringify(data));
				}
				else{
					var newUser = new User();
					newUser.local.name= name;
					newUser.local.email=email;
					newUser.local.username= username;
					trophytable_id = newUser._id;
					newUser.local.password= password;
					User.createUser(newUser, function(err, user){
						if(err) throw err;
					});

					var newTrophy = new Trophy();
					newTrophy.trophy_id = trophytable_id;
					newTrophy.trophies = 800;
					newTrophy.rank = "Bronze";
					newTrophy.name =username;
					newTrophy.Level = 1;
					
					Trophy.createUser(newTrophy, function(err, user){
						if(err) {
							throw err;
							var data = {
									response:false,
									details:err
							};
							res.end(JSON.stringify(data));
						}
					});
					subject= 'Tetetetris Game-Registration Successful'; // Subject line 
					text= 'This email has been linked to an account in tetetetris game🐴'; // plaintext body 
					html='<b>This email has been linked to a account in tetetetris game🐴</b>' ;// html body 
					send_mail(email,subject,text,html);
					transporter.sendMail(mailOptions, function(error, info){
						if(error){
							var data = {
									response:false,
									details:error
								};
							res.end(JSON.stringify(data));
						}
						//console.log('Message sent: ' + info);
					});
					req.flash('success_msg', 'You are registered and can now login');
					var data = {
									response:true,
									details:'You are registered and can now login'
								};
					res.end(JSON.stringify(data));
				}
			});
		}
});

router.post('/resetpassword', function(req, res){
	console.log("----------------resetpassword link is hit by ajax");
	var email = req.body.email;
	if(email=='' || email==null){
		var data = {
						response:false,
						details:"email is empty"
					}
		res.end(JSON.stringify(data));
	}
	else{
		User.getUserByEmail(email, function(err, user){
			if(err) throw err;
			if(user){
				var token1 = Math.floor(1000 + Math.random() * 9000);
				//console.log(token1);
				user.local.token = token1;
				user.save();
				
				subject= 'Tetetetris Game-Password Reset OTP'; // Subject line 
				text= 'Your OTP is  '+token1+'🐴'; // plaintext body 
				html='<b>'+text+'</b>' ;// html body 
				send_mail(email,subject,text,html);
				Pass_email=email;
				transporter.sendMail(mailOptions, function(error, info){
					if(error){
						console.log(error);
						var data ={
									response:false,
									details:error
								  }
						res.end(JSON.stringify(data));
					}
					console.log('Message sent: ' + info);
				});
				req.flash('success_msg', 'OTP has been send');
				var data = {
								response:true,
								details:"OTP has been send"
							}
				res.end(JSON.stringify(data));
			}
			else{
				req.flash('error_msg', 'No account linked with this email. Try another Email');
				var data = {
								response:false,
								details:"No account linked with this email"
							}
				res.end(JSON.stringify(data));
			}
		});
	}
});

router.post('/NewPass', function(req, res){
	var password = req.body.pass;
	var password2 = req.body.confirmPass;
	var otp_value = req.body.OTP;
	
	var data1 = {};
	var errors = false;
	if(password=='' || password==null){
		data1["password"] = {
								password:"password is empty"
							}
		errors = true;
	}else{
		data1["password"] = {
								password:''
							}
	}
	if(password2=='' || password2==null){
		data1["password2"] = {
								password2:"password is empty"
							}
		errors = true;
	}else{
		data1["password2"] = {
								password2:''
							}
	}
	if(otp_value=='' || otp_value==null){
		data1["OTP"] = {
								OTP:"OTP is empty"
						};
		errors = true;
	}else{
		data1["OTP"] = {
								OTP:''
						}
	}
	if(password != password2){
		data1["passMatch"]={
								passMatch:"Passwords dosent match"
						   };
		errors = true;
	}else{
		data1["passMatch"]={
								passMatch:''
						   }
	}
	if(errors){
		var data2 = {
						response:false,
						error:data1,
						details:''
					}
		res.end(JSON.stringify(data2));
	}
	else{
		email= req.session.mail;
		//console.log("mera email"+email);
		User.getUserByEmail(email,function(err, user){
			if(err) throw err;
			if(!user){
				req.flash('error_msg', 'No account linked with this email. Try another Email');
				var data = {
								response:false,
								details:"No account linked with this email. Try another Email",
								error:data2
							}
				res.end(JSON.stringify(data));
			}
			if (otp_value == user.token){
				user.local.password = password;
				user.token = null;
				User.createUser(user, function(err, user){
					if(err) throw err;
				});
				req.flash('success_msg', 'Password has been changed. Login now');
				var data = {
								response:true
							}
				res.end(JSON.stringify(data));
			}
			else{
					req.flash('error_msg', 'OTP incorrect');
					var data = {
									response:false,
									details:"OTP incorrect",
									error:data2
								}
					res.end(JSON.stringify(data));		
					//res.redirect('/users/NewPass');
				}
		});
	}
});

router.post('/logout', function(req, res){
	console.log("logout hit");
	req.logout();
	var db_id = req.body.db_id;
	User.getUserBydbid(db_id,function(err,user){
		if(err) console.log("logout error: "+err);
		else
			user.loggedIn = false;
	});
	
	req.cookies = {};
	//session destroy
	req.session.destroy(function (err) {
        if(err){
			console.log(err);
			var data = {
							response:false,
							error:err
						};
			res.end(JSON.stringify(data));	
		}
		else{
			var data = {
							response:true
						};
			res.end(JSON.stringify(data));
		}
    });
});

router.post('/authentication',function(req, res){
	var db_id = req.body.db_id;
	
	if(db_id!=null && db_id!=''){
		User.getUserBycookie(db_id, function(err, user){
			if(err) throw err;
			if(user){
				var tt = user.token;
				/*if(user.loggedIn != null || user.loggedIn == true){
					var data = {
									response:false,
									details:"Only One user allowed at a time"
								};
					res.end(JSON.stringify(data));
				}
				else*/
				if(toString(tt) == toString(req.body.token)){
					console.log("-----------token matched");
					token = guid();
					user.token = token;
					var data={
								response:true,
								token:user.token
							}
					res.end(JSON.stringify(data));
				}
				else{
					console.log("-------token not matched")
					var data={
								response:false,
								details:"token not matched"
							 }
					res.end(JSON.stringify(data));
				}
			}
		});
	}
	else{
			console.log("------db_id not found");
			var data={
						response:false
					 }				
			res.end(JSON.stringify(data));
	}
});

module.exports = router;

//to check if object is empty
function isEmpty(obj) {
    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length == 0)  return true;

    // If it isn't an object at this point
    // it is empty, but it can't be anything *but* empty
    // Is it empty?  Depends on your application.
    if (typeof obj !== "object") return true;

    // Otherwise, does it have any properties of its own?
    // Note that this doesn't handle
    // toString and valueOf enumeration bugs in IE < 9
    for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) return false;
    }
    return true;
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}