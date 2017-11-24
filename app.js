var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var expressValidator = require('express-validator');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var Elo = require('arpad');

//elo rating
var elo = new Elo();
var mongo = require('mongodb');
var mongoose = require('mongoose');

mongoose.connect('mongodb://abhishek:123456@ds117316.mlab.com:17316/sweety',{useMongoClient: true});
var db = mongoose.connection;

var users = require('./routes/users');
var Trophy = require('./models/trophy');
var User = require('./models/user');

// Init App
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.engine('handlebars', exphbs({defaultLayout:'layout'}));
app.set('view engine', 'handlebars');

// BodyParser Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

// Set Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// Express Session
app.use(session({
    secret: 'secret',
    saveUninitialized: true,
    resave: true,
}));

// Passport init
app.use(passport.initialize());
app.use(passport.session());

// Express Validator
app.use(expressValidator({errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));

// Connect Flash
app.use(flash());

app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

app.use('/',users);
app.use('/users', users);
app.use(express.static(__dirname + '/mypublic'));

http.listen(3000,function(){
  console.log('listening on *:80');
});

io.on('connection',function(socket){  
	socket.emit("Connected",true);
	console.log("A User Connected");

	socket.on('clientUser_id',function(data){
	   var obj = data;
	   var db_id = obj.db_id;
	   var token = obj.token;
	   socket.dbID = db_id;
				
	   Trophy.getUserBydbid(socket.dbID, function(err, user){
			if(err) throw err;
			if(user){
						socket.trophy_no = user.trophies;
						socket.level = user.Level;
						socket.nameUser = user.name;				  
						socket.emit('setUserDetails',{username:socket.nameUser,trophies:socket.trophy_no});
					}
			else    console.log("Could not find user in trophy DB");
	   });

	   allUsers.activeUsers[socket.id] = socket;
	   socket.existingUser = false;
	  
	   //check if any game exists of this user 
	   socket.emit('checkUserExists',socket.dbID);
	});
 
	//this is basically to check if the user is involved in any current game
	socket.on('userExists',function(theUser){
		socket.dbID = theUser;
		var theKey = getKeyOfExistingUser(theUser);
		if(theKey == 404) console.log("No Game Found!");
		else{
		  if(getIsMultiplayer(theKey)){
			loadCurrentStatusOfGame(socket,theKey);
			socket.emit('YouCanPlayMultiplayer',true);
		  }
		  else	console.log("No Game Found!");
		}
	});

	socket.on('gridMakingCompleted',function(){
		var mySocketID = socket.id;
		proceedToGame(socket);
	});

	socket.on('iWillPlayGame',function(stat){
		socket.emit('makeGridFirst',true);
	});

	socket.on('Iwanttospectate',function(){
		socket.emit('sending data of clients', finding_opponent()); 
	});

	socket.on('sendMeTheGameOfThisID',function(data){
		var isRoom = data;
		var specRoom = allGames.activeGames[isRoom].spectatingRoom;
		socket.spectatingRoom = specRoom;
		joinTheRoom(socket,specRoom);
		allGames.activeGames[isRoom].totSpectators++;
	});

	socket.on('wantToPlayMultiplayer',function(){
		create_game(socket.id,false);
		players[socket.id].mySocket = socket;    
		var trop = allUsers.activeUsers[socket.id].trophy_no;
		allUsers.waitingForBattleUsers[socket.id]=trop;
		allUsers.NoOfmultiplayerUsersInQueue++;
		if(opponentAssigningProcessVal==null)
			opponentAssigningProcess();
	});

	//when user cancels the spectate mode
	socket.on('cancelSpectatePlease',function(){
		//leaving the spectating room
		socket.leave(socket.spectatingRoom);
		socket.emit('leaveSpectateRoomCompleted',true);
	});
    
	socket.on('cancelTheGame',function(){
		if(allUsers.waitingForBattleUsers[socket]){	
			delete allUsers.waitingForBattleUsers[socket.id];
			allUsers.NoOfmultiplayerUsersInQueue--;
		}
	});
    
	socket.on('Clients key status',function(data){
		var myID = socket.id;
		keys_stat = data;
		checkkeystatus(myID);
	});

	socket.on('restartButtonIsPressed',function(){
		players[socket.id]={};
		resetPlayer(socket.id);
	});
	
	/*socket.on('sendKeyStatus',function(data){
		var myID = socket.id;
		keys_stat = data;
		checkkeystatus(myID);
	});*/
	
	//for hall of fame----------strt here
	socket.on("hallOfFameButtonPressed",function(){
		halloffame = {};
		Trophy.getUserByTrophy(function(err, user){
		if(err) throw err;
		if(user) socket.emit('halloffamedata',user);
		else	console.log("could not find HallOfFame data");
	   });
	}); 
	
	socket.on('playWithAI',function(){
		console.log("play with AI triggered");
		
		var ran = Math.floor(Math.random()*(names.length));
		var name = names[ran];
		
		makeActiveAIs(socket.id+"AI",socket.id+"socket",name,allUsers.activeUsers[socket.id].trophy_no,allUsers.activeUsers[socket.id].level);
		
		create_game(socket.id+"AI",true);
		
		//****************************************************
		players[socket.id].opponentID = socket.id+"AI";
		players[socket.id+"AI"].opponentID = socket.id; 
		
		totalRooms++;
		
		var mySoc = allUsers.activeUsers[socket.id];
		var roomName = "Room"+totalRooms;
		var opponentsSocket = socket.id+"socket";

		//1st
		players[socket.id].myRoom = roomName;
		players[socket.id].myRoomNo = totalRooms;
		
		//2nd
		players[socket.id+"AI"].myRoom = roomName;
		players[socket.id+"AI"].myRoomNo = totalRooms;

		makeActiveGamesDictionary(roomName,totalRooms,socket.id,socket.id+"AI",true);

		players[socket.id].isFirstPlayer = true;      

		// joinTheRoom(mySoc,roomName);
		// joinTheRoom(opponentsSocket,roomName);
		//**********************************************
		
		var troph = allUsers.waitingForBattleUsers[socket.id];
		
		players[socket.id].isPlayingWithAI = true;
		players[socket.id+"AI"].isAI = true;
		
		allUsers.activeUsers[socket.id].emit('YouCanPlayMultiplayer',{myTrophy:troph,oppoTrophy:troph,oppName:name});
		allUsers.NoOfmultiplayerUsersInQueue -= 1;
		delete allUsers.waitingForBattleUsers[socket];
	});
	
	socket.on('touchMovement',function(data){
		var sPt = data.startPoint,
		ePt = data.endPoint,
		hd = data.horizontalDistTravelled,
		pHd = Math.abs(data.horizontalDistTravelled);

		var sPty = data.startPointY,
		ePty = data.endPointY,
		vd = data.verticalDistTravelled,
		pVd = Math.abs(data.verticalDistTravelled);

		if(pHd <=1 && pVd <=1){
			if(players[socket.id].swipedDown == true)
				dropButtonReleased(socket.id);
			else
				rotateButton(socket.id);
		}

		if(vd>0 && pVd>30){
			if(players[socket.id].swipedDown == false)
				dropButtonPressed(socket.id);
			players[socket.id].swipedDown = true;
		}
	});
	
	socket.on('DragEvent',function(data){
		if(data.horDisTravelled < 0)
			leftButton(socket.id);
		else
			rightButton(socket.id);
	});
	
	socket.on('enableAutoPlayer',function(){
		if(players[socket.id].isAI == false) 
			players[socket.id].isAI = true;
		else{
				dropButtonReleased(socket.id);
				players[socket.id].isAI = false;
			}
	});

	socket.on('disconnect',function(temp){
		console.log("a user disconnected");
	});
});

var halloffame = {};
//speed up calls to has own property
var hasOwnProperty = Object.prototype.hasOwnProperty;

const names = ["混沌","مصطفى","Алексей","Raman","Jordan","Jules","Raghav","Antana","Winner","Loser","Player111","killergamer","Joe","Lafamina","BeastBoy","blocky"];
const pieces =['i','j','l','o','s','t','z'];
const randomColors =["red","orange","yellow","blue","purple","green","cyan"];
const defaultBackgroundColor ="transparent";
const gridWidth=15;
const gridHeight=27;
const previewGridWidth=4;
const previewGridHeight=4;    

var blockSpeed = 500;
var currentReplays ={};
var replayDictionary = {};
var players ={};

var AllTimeReplayData ={};
var replayCountData = {};

var isGameCurrentlyPlayed=0;
var blockProperties = new Array();
var totalRooms = 0;
var allGames={};
var opponentAssigningVal = true,opponentAssigningProcessVal=null;

var allUsers={
    activeUsers:{},
    currentlyPlayingUsers:{},
    spectatingUsers:{},
    waitingForBattleUsers:{},
    NoOfmultiplayerUsersInQueue:0,
    recentlyDisconnectedUsers:{},
    leftTheGameInBetweenUsers:{}
};
  
var allGames={
    activeGames:{},
    pastGames:{},
    noOfGamesPlayed :0,
    noOfActiveGames:0
};  
 
function opponentAssigningProcess(){
	var singlePlayerWaitCount = 0;
	opponentAssigningProcessVal = setInterval(function(){
		if(opponentAssigningVal){
			singlePlayerWaitCount++;
			if(allUsers.NoOfmultiplayerUsersInQueue >= 2){
				singlePlayerWaitCount = 0;
				opponentAssigningVal = assignOpponentAlgo();
			}
			else if(singlePlayerWaitCount == 120){
					singlePlayerWaitCount = 0;
					clearInterval(opponentAssigningProcessVal);
					opponentAssigningProcessVal=null;
				 }
		}
	},500);
}

function assignOpponentAlgo(){
	opponentAssigningVal = false;
	var couple = 0;
	var soc1,soc2,trop1,trop2;
	for(key in allUsers.waitingForBattleUsers){
		++couple;
		if(couple == 1){
			soc1 = key;
			trop1 = allUsers.waitingForBattleUsers[key];
		}else{
			couple=0;
			soc2 = key;
			trop2 = allUsers.waitingForBattleUsers[key];
			roomFormation(soc1,soc2);
			allUsers.activeUsers[soc1].emit('YouCanPlayMultiplayer',{myTrophy:trop1,oppoTrophy:trop2,oppName:players[soc2].nameOfUser});
			allUsers.activeUsers[soc2].emit('YouCanPlayMultiplayer',{myTrophy:trop2,oppoTrophy:trop1,oppName:players[soc1].nameOfUser});
			allUsers.NoOfmultiplayerUsersInQueue -= 2;
			delete allUsers.waitingForBattleUsers[soc1];
			delete allUsers.waitingForBattleUsers[soc2];
		}
	}
	return true;
}

function makeActiveGamesDictionary(RName,RNo,ID1,ID2,permits){
  var roomName = RName,fstPlayer = ID1,sndPlayer = ID2,roomNumber = RNo;  
  var specRoom = roomName+"spectate";
  
  if(permits == false){
  allGames.activeGames[roomName] ={
    firstPlayer:fstPlayer,
  	secondPlayer:sndPlayer,
	myRoomNo:roomNumber,
  	totalPlayers:0,
  	gameDifficulty:blockSpeed,
  	gameLevel:1,
  	timeOfStart:0,
  	gameTimer:0,
	theTime:null,
  	replayMilisecRoomTimerVar:null,
  	milisecRoomClock:0,
  	spectatingRoom:specRoom,
  	totSpectators:0,
  	specTimer:0,
	criticalTime:false,
	finalTime:200,
    moveBoxStageCount:0,
	moveBoxCount:0,
	firstWinTrophy:elo.newRatingIfWon(parseInt(allUsers.activeUsers[fstPlayer].trophy_no),
					parseInt(allUsers.activeUsers[sndPlayer].trophy_no))-allUsers.activeUsers[fstPlayer].trophy_no,
	
	SecondWinTrophy:elo.newRatingIfWon(parseInt(allUsers.activeUsers[sndPlayer].trophy_no),
					parseInt(allUsers.activeUsers[fstPlayer].trophy_no))-allUsers.activeUsers[sndPlayer].trophy_no
  };
  }else{
	allGames.activeGames[roomName] ={
    firstPlayer:fstPlayer,
  	secondPlayer:sndPlayer,
	myRoomNo:roomNumber,
  	totalPlayers:0,
  	gameDifficulty:blockSpeed,
  	gameLevel:1,
  	timeOfStart:0,
  	gameTimer:0,
	theTime:null,
  	replayMilisecRoomTimerVar:null,
  	milisecRoomClock:0,
  	spectatingRoom:specRoom,
  	totSpectators:0,
  	specTimer:0,
	criticalTime:false,
	finalTime:200,
    moveBoxStageCount:0,
	moveBoxCount:0,
	firstWinTrophy:elo.newRatingIfWon(parseInt(allUsers.activeUsers[fstPlayer].trophy_no),
					parseInt(activeAIs.trophy_no))-allUsers.activeUsers[fstPlayer].trophy_no,
	
	SecondWinTrophy:elo.newRatingIfWon(parseInt(activeAIs.trophy_no),
					parseInt(allUsers.activeUsers[fstPlayer].trophy_no))-activeAIs.trophy_no
  };
  }
}

function getIsMultiplayer(ky){
  var key =ky;
  return players[key].isMultiplayer;
}

function loadCurrentStatusOfGame(soc,theKey){
  var theSoc = soc;
  var isKey = theKey;
  console.log("++++You left the game in middle++++");
  theSoc.id = isKey;
  allUsers.activeUsers[theSoc.id] = theSoc;
  theSoc.existingUser = true;
}

//key id is present if user already existed
function getKeyOfExistingUser(theUser){
  var userNm = theUser;
  var foundout = 404;
  Object.keys(players).forEach(function (key) {
    if(userNm.localeCompare(players[key].username) == 0){
        foundout =key;
    }
  });
  return foundout;
}

function proceedToGame(soc){
  var sockett = soc;
  if(sockett.existingUser == false){
    players[sockett.id].isMultiplayer = true;
   	makingOfGame(sockett.id);
    
	if(players[sockett.id].isPlayingWithAI == true)
		makingOfGame(sockett.id+"AI");
	
    var rName = players[sockett.id].myRoom;
    allGames.activeGames[rName].totalPlayers++;
      
    //if both players ready then start the game
    if(checkIfplayersReady(sockett.id) == true) gameStarter(sockett.id);
    else console.log("Both players not ready!");  
  }
  else{
    players[sockett.id].mVar = setInterval( function() {
		if (Object.keys(allUsers.activeUsers).indexOf(sockett.id)>-1) 
			sendTetrisDataToClient(sockett.id); }, 50 );
  }
}

function gameStarter(k){
	  console.log("All players are ready");
	  var IID = k;
	  var oppo = players[k].opponentID;
	  var rName = players[IID].myRoom;
	  
	  var play1 = allGames.activeGames[rName].firstPlayer;
	  var play2 = allGames.activeGames[rName].secondPlayer;
		
	  allGames.activeGames[rName].milisecRoomClockVar = setInterval(function(){
	  if (Object.keys(allUsers.activeUsers).indexOf(IID)>-1)
			runRoomClock(rName,play1,play2); },50);
}

function runRoomClock(rName,p1,p2){
	if(Object.keys(allGames.activeGames[rName]).length != 0){
		var theRoom = rName;
		var theTime = allGames.activeGames[theRoom].milisecRoomClock;
		var thek1 = p1;
		var thek2 = p2;
			
		allGames.activeGames[theRoom].moveBoxCount++;
		
		allGames.activeGames[theRoom].milisecRoomClock += 50;
		var diff = allGames.activeGames[theRoom].gameDifficulty;
		
		//for movement of tetris
		if(theTime%diff == 0){
			moveBox(thek1);
			moveBox(thek2);
		}
		 
		if(theTime%1000 == 0){
			allGames.activeGames[theRoom].gameTimer++;
			setTheTimer(theRoom);
			
			//for increasing difficulty after every 20 seconds
			if(theTime!=0 && allGames.activeGames[theRoom].gameTimer%20 == 0){
				increaseDifficulty(theRoom);
			}
		}
		
		//for emitting to both players
		if(allUsers.activeUsers[thek1])	sendTetrisDataToClient(thek1);
		
		if(allUsers.activeUsers[thek2] && players[thek2].isAI == false)	sendTetrisDataToClient(thek2);
		
		//for sending to all spectators
		var totMembers = allGames.activeGames[theRoom].totSpectators;
		if(totMembers >0)	broadcastGameToSpectators(theRoom);
	}
}

//updates the time for current Game
function setTheTimer(theRoom){
	var isRoom = theRoom;
	var fsoc = allGames.activeGames[isRoom].firstPlayer; 
	
	//for reverse stop watch
	var theMinutes = 2-parseInt(allGames.activeGames[isRoom].gameTimer/60);
	if(theMinutes<0) theMinutes=0;
	var theSeconds = 60-allGames.activeGames[isRoom].gameTimer%60;
	if(theSeconds<0) theSeconds=0;
	
	if(theMinutes == 0 && theSeconds <= 30){
		allGames.activeGames[isRoom].criticalTime = true;
	}
	
	if(theMinutes == 0 && theSeconds <= 10){
		allGames.activeGames[isRoom].finalTime = theSeconds;
	}
	
	//timeout
	if(theMinutes <= 0 && theSeconds <= 1){
		gameOver(fsoc,true);
	}
	
	if(theSeconds <10)
		allGames.activeGames[isRoom].theTime = 	theMinutes+":0"+theSeconds;
	else
		allGames.activeGames[isRoom].theTime = 	theMinutes+":"+theSeconds;
}

//for live game
function increaseDifficulty(theRoom){
	var isRoom = theRoom;
	if(allGames.activeGames[isRoom].gameDifficulty >50){
		allGames.activeGames[isRoom].gameDifficulty -= 50;
		switch(allGames.activeGames[isRoom].gameDifficulty){
			case 450:	allGames.activeGames[isRoom].gameLevel = 1;
						break;
			case 350:	allGames.activeGames[isRoom].gameLevel = 2;
						break;
			case 250:	allGames.activeGames[isRoom].gameLevel = 3;
						break;
			case 150:	allGames.activeGames[isRoom].gameLevel = 4;
						break;
			case 50:	allGames.activeGames[isRoom].gameLevel = 5;
						break;
		}
	}
}

//checks if both players are ready for battle
function checkIfplayersReady(k){
  var IID = k;
  var rName = players[IID].myRoom;
  if(allGames.activeGames[rName].totalPlayers == 2 || players[IID].isPlayingWithAI == true)
    return true;    
  return false;
}

//emits the game of given room to all spectators
function broadcastGameToSpectators(theRoom){
  var isRoom = theRoom;
  var spectateRoom = allGames.activeGames[isRoom].spectatingRoom;
  var totMembers = allGames.activeGames[isRoom].totSpectators;
  if(totMembers>0){
	
		var p1 = allGames.activeGames[isRoom].firstPlayer;
		var p2 = allGames.activeGames[isRoom].secondPlayer;
		
		io.in(spectateRoom).emit('updateTheTetrisDetails',{tetrisBackgroundProperty:players[p1].backgroundPropertyOfAllBlocks,
		tetrisPreviewProperty:players[p1].backgroundPropertyOfNextBlocks,
		currentLevel:allGames.activeGames[isRoom].gameLevel,
		timer:allGames.activeGames[isRoom].theTime,
		theTrophy:players[p1].trophy_no,
		oppTrophy:players[p2].trophy_no,
		theUser:players[p1].nameOfUser,
		oppUser:players[p2].nameOfUser,
		myLevel:players[p1].level,
		winningTrophy:allGames.activeGames[isRoom].firstWinTrophy,
		OpponentsTetrisBackgroundProperty:players[p2].backgroundPropertyOfAllBlocks,
		theCriticalTime:allGames.activeGames[isRoom].criticalTime,
		theFinalTime:allGames.activeGames[isRoom].finalTime});
  }
}

function joinTheRoom(k,roomName){
  var theID = k;
  var theRoom = roomName;
  theID.join(theRoom);
}

function leaveTheRoom(k){
  var theID = k;
  var theSocket = allUsers.activeUsers[theID];
  var theRoom = players[theID].myRoom;
  theSocket.leave(theRoom);    
}

function sendTetrisDataToClient(k){ 
  if(Object.keys(players[k]).length != 0){
	// get the opponent ID
	var opID = players[k].opponentID;
	var theRoom = players[k].myRoom; 
	
	allUsers.activeUsers[k].emit('updateTheTetrisDetails',{tetrisBackgroundProperty:players[k].backgroundPropertyOfAllBlocks,
		tetrisPreviewProperty:players[k].backgroundPropertyOfNextBlocks,
		currentLevel:allGames.activeGames[theRoom].gameLevel,
		timer:allGames.activeGames[theRoom].theTime,
		theTrophy:players[k].trophy_no,
		oppTrophy:players[opID].trophy_no,
		theUser:players[k].nameOfUser,
		oppUser:players[opID].nameOfUser,
		myLevel:players[k].level,
		//myLevel:8,
		oppLevel:players[opID].level,
		//oppLevel:8,
		winningTrophy:elo.newRatingIfWon(parseInt(players[k].trophy_no),parseInt(players[opID].trophy_no))-players[k].trophy_no,
		OpponentsTetrisBackgroundProperty:players[opID].backgroundPropertyOfAllBlocks,
		rowCompletion:players[k].rowCompletionFlag,
		rowAddition:players[k].rowAdditionFlag,
		theCriticalTime:allGames.activeGames[theRoom].criticalTime,
		rowsAdded:players[k].rowsAdded,
		theFinalTime:allGames.activeGames[theRoom].finalTime
	});
	
	if(players[k].rowsAddedTimeCountFlag){
		players[k].rowsAddedTimeCount++;
		if(players[k].rowsAddedTimeCount == 12){
			players[k].rowsAddedTimeCount=0;
			players[k].rowsAdded = 0;
			players[k].rowsAddedTimeCountFlag = false;
		}
	}	
	players[k].rowCompletionFlag = false;
	players[k].rowAdditionFlag = false;
  }
}

function roomFormation(socketId1,socketId2){
	var sID1 = socketId1;
	var sID2 = socketId2;
	
	players[sID1].isMultiplayer = true;
	players[sID2].isMultiplayer = true;
	
	players[sID1].opponentID = sID2;
	players[sID2].opponentID = sID1; 
	
	totalRooms++;
	
	var mySoc = allUsers.activeUsers[sID1];
	var roomName = "Room"+totalRooms;
	var opponentsSocket = allUsers.activeUsers[sID2];

	//1st
	players[sID1].myRoom = roomName;
	players[sID2].myRoomNo = totalRooms;
	
	//2nd
	players[sID2].myRoom = roomName;
	players[sID2].myRoomNo = totalRooms;

	makeActiveGamesDictionary(roomName,totalRooms,sID1,sID2,false);

	players[sID1].isFirstPlayer = true;      

	joinTheRoom(mySoc,roomName);
	joinTheRoom(opponentsSocket,roomName);    
}

//finding currently playing users for spectation purposes
//had to modify this function
function finding_opponent(){
	var items = Object.keys(allGames.activeGames).map(function(key) {
		return [allGames.activeGames[key].firstPlayer, 
		allGames.activeGames[key].secondPlayer,
		players[allGames.activeGames[key].firstPlayer].nameOfUser,
		players[allGames.activeGames[key].secondPlayer].nameOfUser,
		key,
		players[allGames.activeGames[key].firstPlayer].trophy_no,
		players[allGames.activeGames[key].secondPlayer].trophy_no
    ]//};//.sort();
  });
  return items;//.sort();
}


function checkkeystatus(k){
  if (keys_stat['rotateButton']==true) {
	  players[k].rotatePressedPreviously = true;
  }
  if (keys_stat['rotateButton']==false && players[k].rotatePressedPreviously == true) {
	  rotateButton(k);
	  players[k].rotatePressedPreviously = false;
  }
  if (keys_stat['leftButton']==true){
	  leftButton(k);
  }
  if (keys_stat['rightButton']==true) { 
	  rightButton(k);
  }
  if(!isEmpty(players[k])){
	  if(players[k].previousDropClick != keys_stat['dropButton']){
		if (keys_stat['dropButton'] ==true) {
			dropButtonPressed(k);
			players[k].swipedDown = true;
		}
		if (keys_stat['dropButton'] ==false){
			dropButtonReleased(k);
		}
		players[k].previousDropClick = keys_stat['dropButton'];
	  }
  }
}

function makeActiveAIs(k,kid,name,trophy,level){
	activeAIs ={
			dbID:kid,
			nameUser:name,
			trophy_no:trophy,
			level:level
	};
}

function create_game(k,permit){	
  if(permit == false)
  {
	players[k]={  
    //multiplayerInfo:{
      mySocket:null,
      opponentID:null,
      myRoom:null,
      myRoomNo:null,
      isFirstPlayer:false,
    //},
	rightMostX:null,
    rightMostY:null,
    leftMostX:null,
    leftMostY:null,
    bottomMostX:null,
    bottomMostY:null,
    mVar:null,
    cacheLeftMostX:null,
    cacheLeftMostY:null,
    cacheRightMostX:null,
    cacheRightMostY:null,
    cacheBottomMostX:null,
    cacheBottomMostY:null,
    cacheShapeType:null,
    nextPiece:null,
    nextColor:null,
    shapeType:null,
    shapeStage:0,
    shapePos:[[0,0],[0,1],[0,2],[0,3]],
    cachePos : [[0,0],[0,0],[0,0],[0,0]],
    nextShapePos  : [[0,0],[0,0],[0,0],[0,0]],
    Score  :0,
    anyColor :"blue",
    occupiedPropertiesOfAllBlocks :[],
    backgroundPropertyOfAllBlocks :[],
    backgroundPropertyOfNextBlocks:[],
    cacheShapeStage:null,
    timeSinceStart: 0,
    currentSpeed:null,
    username:allUsers.activeUsers[k].dbID,
	nameOfUser:allUsers.activeUsers[k].nameUser,
    isMultiplayer:false,
    timeElapsed:0,
    timeVar:null,
    currentlyDrop:false,
    countOfDataSend:0,
    previousDropClick:false,
    replayMode:false,
    shapesCount:0,
    trophy_no:allUsers.activeUsers[k].trophy_no,
	level:allUsers.activeUsers[k].level,
	moveBoxCount:0,
	previousMoveBoxCount:0,
	previousControlsArray:[],
	rowCompletionFlag:false,
	rowAdditionFlag:false,
	swipedDown:false,
	replayControlStatus:true,
	rowsAdded:0,
	rowsAddedTimeCount:0,
	rowsAddedTimeCountFlag:false,
	completedLines:0,
	rotatePressedPreviously:false,
	isPlayingWithAI:false,
	isAI:false,
		
	//for AI
	occupiedArray:[],
	occupiedArrayFixed:[],
	occupiedArrayBest:[],
    nextShapePos_temp:[[0,0],[0,1],[0,2],[0,3]],
	lastBestScore:99999999,
	besth0:99999999,
	besth1:99999999,
	besth2:99999999,
	besth3:99999999,
	besth4:99999999,
	besth5:99999999,
    nextBottomMostX:null,
    nextBottomMostY:null,
    nextLeftMostX:null,
    nextLeftMostY:null,
    nextRightMostX:null,
    nextRightMostY:null,
    nextShapeStage:null,
    nextShapeType:null,
	scores:[],
	bestX:null,
	bestY:null
   };}
   else{
	players[k]={  
		  mySocket:null,
		  opponentID:null,
		  myRoom:null,
		  myRoomNo:null,
		  isFirstPlayer:false,
		rightMostX:null,
		rightMostY:null,
		leftMostX:null,
		leftMostY:null,
		bottomMostX:null,
		bottomMostY:null,
		mVar:null,
		cacheLeftMostX:null,
		cacheLeftMostY:null,
		cacheRightMostX:null,
		cacheRightMostY:null,
		cacheBottomMostX:null,
		cacheBottomMostY:null,
		cacheShapeType:null,
		nextPiece:null,
		nextColor:null,
		shapeType:null,
		shapeStage:0,
		shapePos:[[0,0],[0,1],[0,2],[0,3]],
		cachePos : [[0,0],[0,0],[0,0],[0,0]],
		nextShapePos  : [[0,0],[0,0],[0,0],[0,0]],
		Score  :0,
		anyColor :"blue",
		occupiedPropertiesOfAllBlocks :[],
		backgroundPropertyOfAllBlocks :[],
		backgroundPropertyOfNextBlocks:[],
		cacheShapeStage:null,
		timeSinceStart: 0,
		currentSpeed:null,
		username:activeAIs.dbID,
		nameOfUser:activeAIs.nameUser,
		isMultiplayer:false,
		timeElapsed:0,
		timeVar:null,
		currentlyDrop:false,
		countOfDataSend:0,
		previousDropClick:false,
		replayMode:false,
		shapesCount:0,
		trophy_no:activeAIs.trophy_no,
		level:activeAIs.level,
		moveBoxCount:0,
		previousMoveBoxCount:0,
		previousControlsArray:[],
		rowCompletionFlag:false,
		rowAdditionFlag:false,
		swipedDown:false,
		replayControlStatus:true,
		rowsAdded:0,
		rowsAddedTimeCount:0,
		rowsAddedTimeCountFlag:false,
		completedLines:0,
		isPlayingWithAI:false,
		isAI:false,
			
		//for AI
		occupiedArray:[],
		occupiedArrayFixed:[],
		occupiedArrayBest:[],
		nextShapePos_temp:[[0,0],[0,1],[0,2],[0,3]],
		lastBestScore:99999999,
		besth0:99999999,
		besth1:99999999,
		besth2:99999999,
		besth3:99999999,
		besth4:99999999,
		besth5:99999999,
		nextBottomMostX:null,
		nextBottomMostY:null,
		nextLeftMostX:null,
		nextLeftMostY:null,
		nextRightMostX:null,
		nextRightMostY:null,
		nextShapeStage:null,
		nextShapeType:null,
		scores:[],
		bestX:null,
		bestY:null
	}
   }
}

  function setOccupyPropertyOfBlocks(k){
    for(var i=0 ;i<gridHeight;i++){
      var data = [];
      for(var j=0;j<gridWidth;j++){
        data.push(0);
      }
      players[k].occupiedPropertiesOfAllBlocks.push(data);
    }
	
	for(var i=0 ;i<gridHeight;i++){
      var data = [];
      for(var j=0;j<gridWidth;j++){
        data.push(0);
      }
      players[k].occupiedArray.push(data);
    }
	
	for(var i=0 ;i<gridHeight;i++){
      var data = [];
      for(var j=0;j<gridWidth;j++){
        data.push(0);
      }
      players[k].occupiedArrayFixed.push(data);
    }
	
	for(var i=0 ;i<gridHeight;i++){
      var data = [];
      for(var j=0;j<gridWidth;j++){
        data.push(0);
      }
      players[k].occupiedArrayBest.push(data);
    }
	
	//initializing scores array
	for(var i=0;i<4;i++){
		var data = [];
		for(var j=0;j<gridWidth;j++){
			data.push(0);
		}
		players[k].scores.push(data);
	}
  }
  
  function setBackgroundPropertyOfBlocks(k){
    for(var i=0 ;i<gridHeight;i++){
      var data2 = [];
      for(var j=0;j<gridWidth;j++){
        data2.push(defaultBackgroundColor);
      }
      players[k].backgroundPropertyOfAllBlocks.push(data2);
    }
  }
  
  function setBackgroundPropertyOfNextBlocks(k){
    for(var i=0 ;i<previewGridHeight ;i++){
      var data2 = [];
      for(var j=0;j<previewGridWidth;j++){
        data2.push(defaultBackgroundColor);
      }
      players[k].backgroundPropertyOfNextBlocks.push(data2);
    }
  }
  
  function resetPlayer(k){


    /*for(var i=0;i<gridHeight;i++){
      for(var j=0;j<gridWidth;j++){
        players[k].occupiedPropertiesOfAllBlocks[i][j] = 0;
        players[k].backgroundPropertyOfAllBlocks[i][j] = defaultBackgroundColor;
      }
    }
	
    for(var i=0;i<previewGridHeight;i++){
      for(var j=0;j<previewGridWidth;j++){
        players[k].backgroundPropertyOfNextBlocks[i][j] = defaultBackgroundColor;
      }
    }
	
    players[k].Score  = 0;*/
    players[k].currentSpeed = blockSpeed;
    players[k].timeSinceStart = 0;
    clearTheInterval(players[k].mVar);
  }
  
  function updateOccupyPropertyOfBlocks(x,y,val,k){
    players[k].occupiedPropertiesOfAllBlocks[x][y]= val;
  }
  
  function updateBackgroundPropertyOfBlocks(x1,y1,val_temp,k){
    players[k].backgroundPropertyOfAllBlocks[x1][y1] = val_temp;
  }
  
  function updateBackgroundPropertyOfNextBlocks(x2,y2,val2,k){
    players[k].backgroundPropertyOfNextBlocks[x2][y2] = val2;
  }
  
  //erases currentraseShape()
  function eraseShape(k){
    updateBackgroundPropertyOfBlocks(players[k].shapePos[0][0],players[k].shapePos[0][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[1][0],players[k].shapePos[1][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[2][0],players[k].shapePos[2][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[3][0],players[k].shapePos[3][1],defaultBackgroundColor,k);
  }
  
  //colors current shape
  function colorTheShape(k){
    //players[k].anyColor is random color generated by function players[k].randomColorGenerator
    updateBackgroundPropertyOfBlocks(players[k].shapePos[0][0],players[k].shapePos[0][1],players[k].anyColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[1][0],players[k].shapePos[1][1],players[k].anyColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[2][0],players[k].shapePos[2][1],players[k].anyColor,k);
    updateBackgroundPropertyOfBlocks(players[k].shapePos[3][0],players[k].shapePos[3][1],players[k].anyColor,k);
  }
  
  //erase next shape
  function eraseNextShape(k){
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [0][0],players[k].nextShapePos [0][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [1][0],players[k].nextShapePos [1][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [2][0],players[k].nextShapePos [2][1],defaultBackgroundColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [3][0],players[k].nextShapePos [3][1],defaultBackgroundColor,k);
  }
  
  //colors next shape
  function colorNextShape(k){
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [0][0],players[k].nextShapePos [0][1],players[k].nextColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [1][0],players[k].nextShapePos [1][1],players[k].nextColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [2][0],players[k].nextShapePos [2][1],players[k].nextColor,k);
    updateBackgroundPropertyOfNextBlocks(players[k].nextShapePos [3][0],players[k].nextShapePos [3][1],players[k].nextColor,k);
  }
  
  function moveNextShapeToInitialPos(k){  
    switch(players[k].nextPiece){
      case 'i':
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 1;
            players[k].nextShapePos [2][0]= 1;
            players[k].nextShapePos [3][0]= 1;
            
            players[k].nextShapePos [0][1]= 0;
            players[k].nextShapePos [1][1]= 1;
            players[k].nextShapePos [2][1]= 2;
            players[k].nextShapePos [3][1]= 3;
              
            break;
              
      case 'j':
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 2;
            players[k].nextShapePos [2][0]= 3;
            players[k].nextShapePos [3][0]= 3;
            
            players[k].nextShapePos [0][1]= 2;
            players[k].nextShapePos [1][1]= 2;
            players[k].nextShapePos [2][1]= 2;
            players[k].nextShapePos [3][1]= 1;
              
            break;
            
      case 'l': 
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 2;
            players[k].nextShapePos [2][0]= 3;
            players[k].nextShapePos [3][0]= 3;
            
            players[k].nextShapePos [0][1]= 1;
            players[k].nextShapePos [1][1]= 1;
            players[k].nextShapePos [2][1]= 1;
            players[k].nextShapePos [3][1]= 2;
              
            break;
            
      case 'o': 
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 1;
            players[k].nextShapePos [2][0]= 2;
            players[k].nextShapePos [3][0]= 2;
            
            players[k].nextShapePos [0][1]= 1;
            players[k].nextShapePos [1][1]= 2;
            players[k].nextShapePos [2][1]= 1;
            players[k].nextShapePos [3][1]= 2;
              
            break;
      
      case 's':
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 1;
            players[k].nextShapePos [2][0]= 2;
            players[k].nextShapePos [3][0]= 2;
            
            players[k].nextShapePos [0][1]= 2;
            players[k].nextShapePos [1][1]= 3;
            players[k].nextShapePos [2][1]= 1;
            players[k].nextShapePos [3][1]= 2;
              
            break;
      
      case 't':   
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 1;
            players[k].nextShapePos [2][0]= 1;
            players[k].nextShapePos [3][0]= 2;
            
            players[k].nextShapePos [0][1]= 0;
            players[k].nextShapePos [1][1]= 1;
            players[k].nextShapePos [2][1]= 2;
            players[k].nextShapePos [3][1]= 1;
              
            break;
      
      case 'z':
            players[k].nextShapePos [0][0]= 1;
            players[k].nextShapePos [1][0]= 1;
            players[k].nextShapePos [2][0]= 2;
            players[k].nextShapePos [3][0]= 2;
            
            players[k].nextShapePos [0][1]= 1;
            players[k].nextShapePos [1][1]= 2;
            players[k].nextShapePos [2][1]= 2;
            players[k].nextShapePos [3][1]= 3;
              
            break;
    }
  }
  
  function randomBlockGenerator(k){
      var any = Math.floor(Math.random()*(randomColors.length));
      players[k].nextColor = randomColors[any];
	  players[k].nextPiece = pieces[any];
	  players[k].shapesCount++;
  }
  
  //checks whether a block is occupied or not
  function isOccupied(x,y,k){
    if(x<0 || x>=gridHeight || y<0 || y>=gridWidth)
      return true;
    var occupiedStatus = players[k].occupiedPropertiesOfAllBlocks[x][y];
    if(occupiedStatus == 0)
      return false;
    else
      return true;
  }
  
  //sets the property of all blocks of current shape
  //where it has resided to occupy
  function makeBlockOccupied(k){
    updateOccupyPropertyOfBlocks(players[k].shapePos[0][0],players[k].shapePos[0][1],1,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[1][0],players[k].shapePos[1][1],1,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[2][0],players[k].shapePos[2][1],1,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[3][0],players[k].shapePos[3][1],1,k);
  }
  
  //sets the property of all blocks of current shape
  //where it has resided to Un-occupy
  function makeBlockUnoccupied(k){
    updateOccupyPropertyOfBlocks(players[k].shapePos[0][0],players[k].shapePos[0][1],0,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[1][0],players[k].shapePos[1][1],0,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[2][0],players[k].shapePos[2][1],0,k);
    updateOccupyPropertyOfBlocks(players[k].shapePos[3][0],players[k].shapePos[3][1],0,k);
  }
  
  //initializes the positions of shape that is going to 
  //enter tetris
  function moveShapeToInitialPos(k){  
    switch(players[k].shapeType){
      case 'i':
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 0;
            players[k].shapePos[2][0]= 0;
            players[k].shapePos[3][0]= 0;
            
            players[k].shapePos[0][1]= 5;
            players[k].shapePos[1][1]= 6;
            players[k].shapePos[2][1]= 7;
            players[k].shapePos[3][1]= 8;
              
            updateLeftRightBottomVariables(k);
            break;
              
      case 'j':
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 1;
            players[k].shapePos[2][0]= 2;
            players[k].shapePos[3][0]= 2;
            
            players[k].shapePos[0][1]= 5;
            players[k].shapePos[1][1]= 5;
            players[k].shapePos[2][1]= 5;
            players[k].shapePos[3][1]= 4;
              
            updateLeftRightBottomVariables(k);
            break;
            
      case 'l': 
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 1;
            players[k].shapePos[2][0]= 2;
            players[k].shapePos[3][0]= 2;
            
            players[k].shapePos[0][1]= 4;
            players[k].shapePos[1][1]= 4;
            players[k].shapePos[2][1]= 4;
            players[k].shapePos[3][1]= 5;
              
            updateLeftRightBottomVariables(k);
            break;
            
      case 'o': 
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 0;
            players[k].shapePos[2][0]= 1;
            players[k].shapePos[3][0]= 1;
            
            players[k].shapePos[0][1]= 4;
            players[k].shapePos[1][1]= 5;
            players[k].shapePos[2][1]= 5;
            players[k].shapePos[3][1]= 4;
              
            updateLeftRightBottomVariables(k);
            break;
      
      case 's':
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 0;
            players[k].shapePos[2][0]= 1;
            players[k].shapePos[3][0]= 1;
            
            players[k].shapePos[0][1]= 4;
            players[k].shapePos[1][1]= 5;
            players[k].shapePos[2][1]= 3;
            players[k].shapePos[3][1]= 4;
              
            updateLeftRightBottomVariables(k);
            break;
      
      case 't':   
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 0;
            players[k].shapePos[2][0]= 0;
            players[k].shapePos[3][0]= 1;
            
            players[k].shapePos[0][1]= 4;
            players[k].shapePos[1][1]= 5;
            players[k].shapePos[2][1]= 6;
            players[k].shapePos[3][1]= 5;
              
            updateLeftRightBottomVariables(k);
            break;
      
      case 'z':
            players[k].shapeStage = 0;
            players[k].shapePos[0][0]= 0;
            players[k].shapePos[1][0]= 0;
            players[k].shapePos[2][0]= 1;
            players[k].shapePos[3][0]= 1;
            
            players[k].shapePos[0][1]= 4;
            players[k].shapePos[1][1]= 5;
            players[k].shapePos[2][1]= 5;
            players[k].shapePos[3][1]= 6;
              
            updateLeftRightBottomVariables(k);
            break;
    }
  }
  
  //gets the leftmost ,rightmost and bottommost blocks
  //of current shape
  function updateLeftRightBottomVariables(k){
    switch(players[k].shapeType){
      case 'i':   
            players[k].rightMostX = players[k].shapePos[3][0];
            players[k].rightMostY = players[k].shapePos[3][1];
            
            players[k].leftMostX = players[k].shapePos[0][0];
            players[k].leftMostY = players[k].shapePos[0][1];
                    
            players[k].bottomMostX = players[k].shapePos[3][0];
            players[k].bottomMostY = players[k].shapePos[3][1];
            break;
            
      case 'j': 
            if(players[k].shapeStage == 0){
              players[k].rightMostX = players[k].shapePos[2][0];
              players[k].rightMostY = players[k].shapePos[2][1];
              
              players[k].leftMostX = players[k].shapePos[3][0];
              players[k].leftMostY = players[k].shapePos[3][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1){
                players[k].rightMostX = players[k].shapePos[3][0];
                players[k].rightMostY = players[k].shapePos[3][1];
              
                players[k].leftMostX = players[k].shapePos[0][0];
                players[k].leftMostY = players[k].shapePos[0][1];
                        
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2){
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
                
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                          
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3){
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                  
                    players[k].leftMostX = players[k].shapePos[0][0];
                    players[k].leftMostY = players[k].shapePos[0][1];
                            
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
      
      case 'l': 
			if(players[k].shapeStage == 0){
              players[k].rightMostX = players[k].shapePos[3][0];
              players[k].rightMostY = players[k].shapePos[3][1];
            
              players[k].leftMostX = players[k].shapePos[2][0];
              players[k].leftMostY = players[k].shapePos[2][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1){
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[0][0];
                players[k].leftMostY = players[k].shapePos[0][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2){
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
              
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                        
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3){
                    players[k].rightMostX = players[k].shapePos[0][0];
                    players[k].rightMostY = players[k].shapePos[0][1];
                
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
      
      case 'o':
            players[k].rightMostX = players[k].shapePos[2][0];
            players[k].rightMostY = players[k].shapePos[2][1];
          
            players[k].leftMostX = players[k].shapePos[3][0];
            players[k].leftMostY = players[k].shapePos[3][1];
                    
            players[k].bottomMostX = players[k].shapePos[3][0];
            players[k].bottomMostY = players[k].shapePos[3][1];
            break;
            
      case 's':
            if(players[k].shapeStage == 0){
              players[k].rightMostX = players[k].shapePos[1][0];
              players[k].rightMostY = players[k].shapePos[1][1];
          
              players[k].leftMostX = players[k].shapePos[2][0];
              players[k].leftMostY = players[k].shapePos[2][1];
                    
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1){
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[1][0];
                players[k].leftMostY = players[k].shapePos[1][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2){
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
              
                  players[k].leftMostX = players[k].shapePos[2][0];
                  players[k].leftMostY = players[k].shapePos[2][1];
                        
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3){
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
      
      case 't':
            if(players[k].shapeStage == 0){
              players[k].rightMostX = players[k].shapePos[2][0];
              players[k].rightMostY = players[k].shapePos[2][1];
            
              players[k].leftMostX = players[k].shapePos[0][0];
              players[k].leftMostY = players[k].shapePos[0][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1){
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
                
				players[k].leftMostX =  players[k].shapePos[0][0];
                players[k].leftMostY =  players[k].shapePos[0][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
            else if(players[k].shapeStage == 2){
                  players[k].rightMostX = players[k].shapePos[3][0];
                  players[k].rightMostY = players[k].shapePos[3][1];
              
                  players[k].leftMostX = players[k].shapePos[1][0];
                  players[k].leftMostY = players[k].shapePos[1][1];
                        
                  players[k].bottomMostX = players[k].shapePos[2][0];
                  players[k].bottomMostY = players[k].shapePos[2][1];
                }
                else if(players[k].shapeStage == 3){
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
            
      case 'z':
            if(players[k].shapeStage == 0){
              players[k].rightMostX = players[k].shapePos[3][0];
              players[k].rightMostY = players[k].shapePos[3][1];
            
              players[k].leftMostX = players[k].shapePos[0][0];
              players[k].leftMostY = players[k].shapePos[0][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1){
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[1][0];
                players[k].leftMostY = players[k].shapePos[1][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2){
                  players[k].rightMostX = players[k].shapePos[3][0];
                  players[k].rightMostY = players[k].shapePos[3][1];
              
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                        
                  players[k].bottomMostX = players[k].shapePos[2][0];
                  players[k].bottomMostY = players[k].shapePos[2][1];
                }
                else if(players[k].shapeStage == 3){
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
						
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
    }
  }
  
  //sets the positions of current shape to its
  //next rotation stage
  function moveShapeToNextRotationStage(k){
    switch(players[k].shapeType){
      case 'i':
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0]+1;
              players[k].shapePos[0][1] = players[k].shapePos[0][1]-1;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0];
              players[k].shapePos[1][1] = players[k].shapePos[1][1];
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
              players[k].shapePos[2][1] = players[k].shapePos[2][1]+1;
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0]-2;
              players[k].shapePos[3][1] = players[k].shapePos[3][1]+2;
            }
            
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0]-1;
                players[k].shapePos[0][1] = players[k].shapePos[0][1]+2 ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0];
                players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
                players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0]+2;
                players[k].shapePos[3][1] = players[k].shapePos[3][1]-1;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0]+2;
                  players[k].shapePos[0][1] = players[k].shapePos[0][1]-2;
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0]+1;
                  players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0];
                  players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
                  players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0]-2;
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]+1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
                    players[k].shapePos[1][1] = players[k].shapePos[1][1];
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0];
                    players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1]-2;
                  }
            updateLeftRightBottomVariables(k);
            break;
            
      case 'j':
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0]-1;
              players[k].shapePos[0][1] = players[k].shapePos[0][1]+2;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0];
              players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
              players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0];
              players[k].shapePos[3][1] = players[k].shapePos[3][1]-1;
            }
            
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0]+1;
                players[k].shapePos[0][1] = players[k].shapePos[0][1]-1 ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0]+1;
                players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0];
                players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0];
                players[k].shapePos[3][1] = players[k].shapePos[3][1]+2;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0];
                  players[k].shapePos[0][1] = players[k].shapePos[0][1];
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
                  players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0];
                  players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                  players[k].shapePos[3][1] = players[k].shapePos[3][1]-2;
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0];
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]-1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0];
                    players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
                    players[k].shapePos[2][1] = players[k].shapePos[2][1]+1;
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
                  }
            updateLeftRightBottomVariables(k);
            break;
      
      case 'l': 
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0]-1;
              players[k].shapePos[0][1] = players[k].shapePos[0][1]-1 ;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
              players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0];
              players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0];
              players[k].shapePos[3][1] = players[k].shapePos[3][1];
            }
            
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0]+1;
                players[k].shapePos[0][1] = players[k].shapePos[0][1] ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0];
                players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
                players[k].shapePos[2][1] = players[k].shapePos[2][1]+2;
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0];
                players[k].shapePos[3][1] = players[k].shapePos[3][1]-1;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0];
                  players[k].shapePos[0][1] = players[k].shapePos[0][1];
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0];
                  players[k].shapePos[1][1] = players[k].shapePos[1][1];
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
                  players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                  players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0];
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]+1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0]+1;
                    players[k].shapePos[1][1] = players[k].shapePos[1][1]-2;
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0];
                    players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1];
                  }
            updateLeftRightBottomVariables(k);
            
            break;
      
      case 'o': 
            break;
            
      case 's': 
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0];
              players[k].shapePos[0][1] = players[k].shapePos[0][1] ;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
              players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0];
              players[k].shapePos[2][1] = players[k].shapePos[2][1]-2;
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
              players[k].shapePos[3][1] = players[k].shapePos[3][1]-1;
            }
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0]-1;
                players[k].shapePos[0][1] = players[k].shapePos[0][1] ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0];
                players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
                players[k].shapePos[2][1] = players[k].shapePos[2][1]+2;
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0];
                players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0]+1;
                  players[k].shapePos[0][1] = players[k].shapePos[0][1]+1;
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0];
                  players[k].shapePos[1][1] = players[k].shapePos[1][1]+2;
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
                  players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0];
                  players[k].shapePos[3][1] = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0];
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]-1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0]+1;
                    players[k].shapePos[1][1] = players[k].shapePos[1][1]-2;
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0];
                    players[k].shapePos[2][1] = players[k].shapePos[2][1]+1;
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1];
                  }
                  
            updateLeftRightBottomVariables(k);
            break;
            
      case 't': 
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0];
              players[k].shapePos[0][1] = players[k].shapePos[0][1]-1 ;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
              players[k].shapePos[1][1] = players[k].shapePos[1][1];
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
              players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
              players[k].shapePos[3][1] = players[k].shapePos[3][1];
            }   
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0];
                players[k].shapePos[0][1] = players[k].shapePos[0][1]+1 ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
                players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0];
                players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0];
                players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0];
                  players[k].shapePos[0][1] = players[k].shapePos[0][1]+1;
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0]+2;
                  players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
                  players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0];
                  players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0];
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]-1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0];
                    players[k].shapePos[1][1] = players[k].shapePos[1][1];
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0];
                    players[k].shapePos[2][1] = players[k].shapePos[2][1];
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1]-2;
                  }
                  
            updateLeftRightBottomVariables(k);
            break;
            
      case 'z': 
            if(players[k].shapeStage == 0){
              //1st block pos
              players[k].shapePos[0][0] = players[k].shapePos[0][0];
              players[k].shapePos[0][1] = players[k].shapePos[0][1]-2 ;
                
              //2nd block pos
              players[k].shapePos[1][0] = players[k].shapePos[1][0]-1;
              players[k].shapePos[1][1] = players[k].shapePos[1][1];
                
              //3rd block pos
              players[k].shapePos[2][0] = players[k].shapePos[2][0];
              players[k].shapePos[2][1] = players[k].shapePos[2][1]-1;
                
              //4th block pos
              players[k].shapePos[3][0] = players[k].shapePos[3][0]-1;
              players[k].shapePos[3][1] = players[k].shapePos[3][1]+1;
            }
            
            else if(players[k].shapeStage == 1){
                //1st block pos
                players[k].shapePos[0][0] = players[k].shapePos[0][0]-1;
                players[k].shapePos[0][1] = players[k].shapePos[0][1]+2 ;
                
                //2nd block pos
                players[k].shapePos[1][0] = players[k].shapePos[1][0];
                players[k].shapePos[1][1] = players[k].shapePos[1][1];
                
                //3rd block pos
                players[k].shapePos[2][0] = players[k].shapePos[2][0]-1;
                players[k].shapePos[2][1] = players[k].shapePos[2][1]+1;
                
                //4th block pos
                players[k].shapePos[3][0] = players[k].shapePos[3][0];
                players[k].shapePos[3][1] = players[k].shapePos[3][1]-1;
              }
              else if(players[k].shapeStage == 2){ 
                  //1st block pos
                  players[k].shapePos[0][0] = players[k].shapePos[0][0]+1;
                  players[k].shapePos[0][1] = players[k].shapePos[0][1]-1;
                
                  //2nd block pos
                  players[k].shapePos[1][0] = players[k].shapePos[1][0];
                  players[k].shapePos[1][1] = players[k].shapePos[1][1]+1;
                
                  //3rd block pos
                  players[k].shapePos[2][0] = players[k].shapePos[2][0]+1;
                  players[k].shapePos[2][1] = players[k].shapePos[2][1];
                
                  //4th block pos
                  players[k].shapePos[3][0] = players[k].shapePos[3][0];
                  players[k].shapePos[3][1] = players[k].shapePos[3][1]+2;
                }
                else if(players[k].shapeStage == 3){
                    //1st block pos
                    players[k].shapePos[0][0] = players[k].shapePos[0][0];
                    players[k].shapePos[0][1] = players[k].shapePos[0][1]+1;
                  
                    //2nd block pos
                    players[k].shapePos[1][0] = players[k].shapePos[1][0]+1;
                    players[k].shapePos[1][1] = players[k].shapePos[1][1]-1;
                  
                    //3rd block pos
                    players[k].shapePos[2][0] = players[k].shapePos[2][0];
                    players[k].shapePos[2][1] = players[k].shapePos[2][1];
                  
                    //4th block pos
                    players[k].shapePos[3][0] = players[k].shapePos[3][0]+1;
                    players[k].shapePos[3][1] = players[k].shapePos[3][1]-2;
                  }
            updateLeftRightBottomVariables(k);
            break;
    }
  }
  
  function checkRowCompletion(k){
    var simultaneousRowsCompleted = 0;
    var oppo = players[k].opponentID;
    var rowsCompleted ={};
	var rName = players[k].myRoom;
	
	for(var i=0;i<=players[k].bottomMostX;i++){
	  for(var j=0;j<gridWidth;j++){
		if(isOccupied(i,j,k) == false)	break;
	  }
	  if(j == gridWidth){
		simultaneousRowsCompleted++;
		eraseRow(i,k);
		dropTetris(i,k); 
	  }
	}

	for(var key in rowsCompleted){
		eraseRow(key,k);
		dropTetris(key,k);
	}

	if(simultaneousRowsCompleted!=0){
		players[k].rowCompletionFlag =true;
		players[oppo].rowAdditionFlag =true;
		players[oppo].rowsAddedTimeCountFlag =true;
	}

	for(var i=0;i<simultaneousRowsCompleted;i++){
		var emptyRows = 0;
		var tempData = [];
		var tempOccupyData = [];
		for(var j=0;j<gridWidth;j++){
			if(players[k].backgroundPropertyOfAllBlocks[gridHeight-1][j] == defaultBackgroundColor)
				emptyRows++;
			tempData.push(players[k].backgroundPropertyOfAllBlocks[gridHeight-1][j]);
			tempOccupyData.push(players[k].occupiedPropertiesOfAllBlocks[gridHeight-1][j]);
		}
		if(emptyRows == gridWidth){
			break;
		}
		addCompletedRowToOpponents(tempData,tempOccupyData,k);
		eraseRow(gridHeight-1,k);
		dropTetris(gridHeight-1,k); 
	}
	players[k].completedLines += simultaneousRowsCompleted;
	players[oppo].rowsAdded = simultaneousRowsCompleted;
}
  
  //erases the completed row
  function eraseRow(x,k){
    for(var z=0;z<gridWidth;z++){
      updateOccupyPropertyOfBlocks(x,z,0,k);
      updateBackgroundPropertyOfBlocks(x,z,defaultBackgroundColor,k);
    }
  }
  
  //drops the rest of tetris just above the completed row 
  function dropTetris(z,k){
    for(var y=0;y<gridWidth;y++){
      for(var l=z-1;l>=0;l--){
        var temp = l+1;
        updateOccupyPropertyOfBlocks(temp,y,players[k].occupiedPropertiesOfAllBlocks[l][y],k);
        updateBackgroundPropertyOfBlocks(temp,y,players[k].backgroundPropertyOfAllBlocks[l][y],k);
      }
    }
  }
  
  function addCompletedRowToOpponents(tempData,tempOccupyData,k){
    var oppo = players[k].opponentID;
    for(var i=1; i<gridHeight ;i++){
      for(var j=0;j<gridWidth ;j++){
        players[oppo].occupiedPropertiesOfAllBlocks[i-1][j] = players[oppo].occupiedPropertiesOfAllBlocks[i][j];
        players[oppo].backgroundPropertyOfAllBlocks[i-1][j] = players[oppo].backgroundPropertyOfAllBlocks[i][j];  
      }
    }
	placePieceToAppropriatePosition(oppo);
    var tt = gridHeight-1;
    
    for(var i=0;i<gridWidth ;i++){
      players[oppo].occupiedPropertiesOfAllBlocks[tt][i] = tempOccupyData[i];
      players[oppo].backgroundPropertyOfAllBlocks[tt][i] = tempData[i];
    }
  }
  
  function placePieceToAppropriatePosition(oppo){
		var k =oppo;
		if(players[k].shapePos[0][0]-1 < 0 || players[k].shapePos[1][0]-1 < 0 
		|| players[k].shapePos[2][0]-1 < 0 || players[k].shapePos[3][0]-1 < 0){ 
			console.log("Piece cant be moved up");
			players[k].shapePos[0][0]++;
			players[k].shapePos[1][0]++;
			players[k].shapePos[2][0]++;
			players[k].shapePos[3][0]++;
			if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][players[k].shapePos[0][1]] ==1
			|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][players[k].shapePos[1][1]] ==1
			|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][players[k].shapePos[2][1]] ==1
			|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][players[k].shapePos[3][1]] ==1){
				console.log("Piece cant be placed same place also......so gameover");
				gameOver(k,false);
			}
			else{
				console.log("Shifting the piece to same place");
				if(players[k].shapePos[0][0]-1>=0){
					players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]-1][players[k].shapePos[0][1]-1] =0;
					players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[0][0]-1][players[k].shapePos[0][1]-1] =defaultBackgroundColor;
				}
				
				if(players[k].shapePos[1][0]-1>=0){
					players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]-1][players[k].shapePos[1][1]-1] =0;
					players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[1][0]-1][players[k].shapePos[1][1]-1] =defaultBackgroundColor;
				}
				
				if(players[k].shapePos[2][0]-1>=0){
					players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]-1][players[k].shapePos[2][1]-1] =0;
					players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[2][0]-1][players[k].shapePos[2][1]-1] =defaultBackgroundColor;
				}
				
				if(players[k].shapePos[3][0]-1>=0){
					players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]-1][players[k].shapePos[3][1]-1] =0;
					players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[3][0]-1][players[k].shapePos[3][1]-1] =defaultBackgroundColor;
				}
				
				players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][players[k].shapePos[0][1]] =1;
			    players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][players[k].shapePos[1][1]] =1;
				players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][players[k].shapePos[2][1]] =1;
				players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][players[k].shapePos[3][1]] =1;
				
				players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[0][0]][players[k].shapePos[0][1]] =players[k].anyColor;
				players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[1][0]][players[k].shapePos[1][1]] =players[k].anyColor;
				players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[2][0]][players[k].shapePos[2][1]] =players[k].anyColor;
				players[k].backgroundPropertyOfAllBlocks[players[k].shapePos[3][0]][players[k].shapePos[3][1]] =players[k].anyColor;
			}	
		}
		else{
			console.log("move shape up");
			moveShapeUp(k);
		}
	}
  
  function moveShapeUp(k){
    players[k].shapePos[0][0]--;
    players[k].shapePos[1][0]--;
    players[k].shapePos[2][0]--;
    players[k].shapePos[3][0]--;
    
    updateLeftRightBottomVariables(k);
  }
  
  //drops down the shape
  function moveShapeDown(k){
    players[k].shapePos[0][0]++;
    players[k].shapePos[1][0]++;
    players[k].shapePos[2][0]++;
    players[k].shapePos[3][0]++;
    
    updateLeftRightBottomVariables(k);
  }
  
  //moves the shape right
  function moveTheShapeToRight(k){
    players[k].shapePos[0][1]++;
    players[k].shapePos[1][1]++;
    players[k].shapePos[2][1]++;
    players[k].shapePos[3][1]++;
    
    updateLeftRightBottomVariables(k);
  }
  
  //moves the shape left
  function moveTheShapeToLeft(k){
    players[k].shapePos[0][1]--;
    players[k].shapePos[1][1]--;
    players[k].shapePos[2][1]--;
    players[k].shapePos[3][1]--;
    
    updateLeftRightBottomVariables(k);
  }

  function checkOccupiedBlock(k){
    switch(players[k].shapeType){
      case 'i':
            if(players[k].shapeStage == 0 || players[k].shapeStage == 2){
              var x1=players[k].shapePos[0][0]+1;
              var x2=players[k].shapePos[1][0]+1;
              var x3=players[k].shapePos[2][0]+1;
              var x4=players[k].shapePos[3][0]+1;
            
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[1][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)

              return true;
              else
                return false;
            }else if(players[k].shapeStage == 1 || players[k].shapeStage == 3){
              var x1=players[k].bottomMostX+1;
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[3][1]]== 1)
                return true;
              else
                return false;
            }
            break;
      
      case 'j':
            if(players[k].shapeStage == 0){
              var x1=players[k].shapePos[2][0]+1;
              var x2=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }else if(players[k].shapeStage == 1){
                var x1= players[k].shapePos[1][0]+1;
                var x2= players[k].shapePos[2][0]+1;
                var x3= players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                  return true;
                else
                  return false;
              }else if(players[k].shapeStage == 2){
                  var x1= players[k].shapePos[3][0]+1;
                  var x2= players[k].shapePos[1][0]+1
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[3][1]]==1
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[1][1]]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].shapeStage == 3){
                    var x1= players[k].shapePos[0][0]+1;
                    var x2= players[k].shapePos[1][0]+1;
                    var x3= players[k].shapePos[3][0]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[1][1]]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].shapeStage == 0){
              var x1=players[k].shapePos[2][0]+1;
              var x2=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }else if(players[k].shapeStage == 1){
                var x1= players[k].shapePos[1][0]+1;
                var x2= players[k].shapePos[2][0]+1;
                var x3= players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                  return true;
                else
                  return false;
              }else if(players[k].shapeStage == 2){
                  var x1= players[k].shapePos[0][0]+1;
                  var x2= players[k].shapePos[3][0]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                    return true;
                  else
                    return false;
                }else if(players[k].shapeStage == 3){
                  var x1= players[k].shapePos[1][0]+1;
                  var x2= players[k].shapePos[2][0]+1;
                  var x3= players[k].shapePos[3][0]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                    return true;
                  else
                    return false;
                }
            break;
      
      case 'o': 
            if(players[k].shapeStage == 0 || players[k].shapeStage == 1 || players[k].shapeStage == 2 || players[k].shapeStage == 3)
            {
              var x1=players[k].shapePos[2][0]+1;
              var x2=players[k].shapePos[3][0]+1;
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            break;
      
      case 's':   
            if(players[k].shapeStage == 0)
            {
              var x1=players[k].shapePos[1][0]+1;
              var x2=players[k].shapePos[2][0]+1;
              var x3=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1
              || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
                var x1 = players[k].shapePos[1][0]+1;
                var x2 = players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var x1 = players[k].shapePos[1][0]+1;
                  var x2 = players[k].shapePos[2][0]+1;
                  var x3 = players[k].shapePos[3][0]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
                    var x1 = players[k].shapePos[1][0]+1;
                    var x2 = players[k].shapePos[3][0]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].shapeStage == 0)
            {
              var x1=players[k].shapePos[0][0]+1;
              var x2=players[k].shapePos[2][0]+1;
              var x3=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1
              || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
                var x1 = players[k].shapePos[0][0]+1;
                var x2 = players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var x1 = players[k].shapePos[1][0]+1;
                  var x2 = players[k].shapePos[2][0]+1;
                  var x3 = players[k].shapePos[3][0]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
                    var x1 = players[k].shapePos[2][0]+1;
                    var x2 = players[k].shapePos[3][0]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].shapeStage == 0){
              var x1=players[k].shapePos[0][0]+1;
              var x2=players[k].shapePos[2][0]+1;
              var x3=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1
              || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var x1 = players[k].shapePos[2][0]+1;
                var x2 = players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var x1 = players[k].shapePos[0][0]+1;
                  var x2 = players[k].shapePos[2][0]+1;
                  var x3 = players[k].shapePos[3][0]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
                    var x1 = players[k].shapePos[2][0]+1;
                    var x2 = players[k].shapePos[3][0]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
    }
  }
  
  //controls the shape automatic dropping movement
  function moveBox(k){
	var id = k;
	//gameover condition
	if((players[id].bottomMostX == 1 || players[id].bottomMostX == 0) && checkOccupiedBlock(id) == true){
	    gameOver(id,false);
	  
    }else if(players[id].bottomMostX == gridHeight-1 || (checkOccupiedBlock(id)) ==  true){
			if(players[k].swipedDown == true)	dropButtonReleased(k);
			if(players[k].isAI == true) {
				if(players[k].level>=4)
					dropButtonReleased(k);
			}
			selectNextPiece(id);
			eraseNextShape(id);
			
			randomBlockGenerator(id);
			checkRowCompletion(id);
			
			moveShapeToInitialPos(id);
			moveNextShapeToInitialPos(id);
			colorNextShape(id);
			
			//calling AI
			if(players[k].isAI == true){
				callAI(id);
				if(players[k].bestX != null && players[k].bestY != null) makeAImoves(id);
			}
		}else if(checkOccupiedBlock(id) ==  false){
				  makeBlockUnoccupied(id);
				  eraseShape(id);
				  moveShapeDown(id);
				  makeBlockOccupied(id);
				  colorTheShape(id);
			}
	return true;
  }
  
  //------------------------AI---------------------------
  function callAI(k){  
	var id=k;
	players[id].nextShapeType = players[id].shapeType;
	players[k].lastBestScore = 99999999;
	for(var i=0;i<gridHeight;i++){
		for(var j=0;j<gridWidth;j++){
			players[id].occupiedArrayFixed[i][j] = players[id].occupiedPropertiesOfAllBlocks[i][j];
		}
	} 
	
	for(var i=0;i<4;i++){		
		for(var j=0;j<gridWidth;j++){
			//occupied property
			for(var m=0;m<gridHeight;m++)
				for(var l=0;l<gridWidth;l++)
					players[id].occupiedArray[m][l] = players[id].occupiedArrayFixed[m][l];
			
			moveShapeToInitialPos_AI(id);
			
			if(i!=0){	
				//do rotation for every increment of i
				var temp=4;
				while(temp--){
					if(!checkOccupiedBlock_AI(id))
						moveShapeDown_AI(id);
					else break;
				}
				
				for(var pq=1;pq<=i;pq++){
					players[id].nextShapeStage = pq;
					moveShapeToNextRotationStage_AI(id);
				}
			}
			
			var left,right;
			updateLeftRightBottomVariables_AI(id);
			left = players[id].nextLeftMostY-j-1;
				
			if(left<0){
				right = Math.abs(left);
				while(right-- && players[id].nextRightMostY < gridWidth)	rightButton_AI(id);
			}else{
					left +=1;
					while(left-- && players[id].nextLeftMostY >= 0) leftButton_AI(id);
				 }	
			
			for(;;){
				if(players[id].nextBottomMostX == gridHeight-1 || checkOccupiedBlock_AI(id) == true)	break;
				else{
						makeBlockUnoccupied_AI(id);
						moveShapeDown_AI(id);
						makeBlockOccupied_AI(id);
					}
			}
			players[id].scores[i][j] = calculateScore_AI(id);
		}
	}
	selectBestScore_AI(id);
  }
  
  function makeAImoves(id){
	var k = id;
	var left,right;
	var rotateStage = players[k].bestX;
	var movement = players[k].bestY;
	updateLeftRightBottomVariables(k);
	
	if(rotateStage!=0){	
		var temp=4;
		while(temp--){
			if(!checkOccupiedBlock(k)){
				makeBlockUnoccupied(id);
    			eraseShape(id);
			    moveShapeDown(id);
			    makeBlockOccupied(id);
			    colorTheShape(id);
			}else{
				gameOver(k);
				break;
			}
		}
		
		//var flagrotate = false;
		var rotateTimeout,i=1;
		rotateTimeout = setInterval(function(){
				if(i<=rotateStage){
					players[k].shapeStage = i;
					makeBlockUnoccupied(k);
					eraseShape(k);
					moveShapeToNextRotationStage(k);
					makeBlockOccupied(k);
					colorTheShape(k);
					i++;
				}else{
						clearInterval(rotateTimeout);
						if(movement<players[k].leftMostY){
							var leftTimeout;
							leftTimeout = setInterval(function(){
									if(players[k].leftMostY == movement){
										clearInterval(leftTimeout);
									}else{
											leftButton(k);
										 }
							},100);
						}else if(movement==players[k].leftMostY){
							rightButton(k);
						}else{
								var rightTimeout;
								rightTimeout = setInterval(function(){
										if(players[k].leftMostY == movement){
											rightButton(k);
											clearInterval(rightTimeout);
										}else{
												rightButton(k);
											 }
								},100);		
								rightButton(k);
							}
					}
				},100);
	}
	if(rotateStage == 0){
		if(movement<players[k].leftMostY){
			var leftTimeout;
			var flagLeft = false;
			leftTimeout = setInterval(function(){
					if(players[k].leftMostY == movement){
						flagLeft = true;
						clearInterval(leftTimeout);
					}else{
							leftButton(k);
						 }
			},100);
		}else if(movement==players[k].leftMostY){
				rightButton(k);
			}
			else{
				var flagRight = false;
				var rightTimeout;
				rightTimeout = setInterval(function(){
						if(players[k].leftMostY == movement){
							rightButton(k);
							flagRight = true;
							clearInterval(rightTimeout);
						}else{
								rightButton(k);
							 }
				},100);			
				rightButton(k);
			}
	}
	var lev = players[k].level;
	if(lev>=4)	dropButtonPressed(k);
  }
  
  function calculateScore_AI(id){
	var k = id;
	
	var holes=0,lastAltitude=0,roughness = 0,bestSlope=0;
	var bestAltitude = -1,score=0,lastHeight=0;
	var h0=0,h1=0,h2=0,h3=0,h4=0,h5=0,h6=0;
	
	//h0 = holes
	for(var i=0;i<gridWidth;i++){
		var flag=false;
		for(var j=0;j<gridHeight;j++){
			if(players[k].occupiedArray[j][i] == 1){
				flag = true;
			}
			if(flag == true && players[k].occupiedArray[j][i] == 0){
				holes++;
			}
		}
	}
	h0=holes;
	
	//h1 = the altitude of the higher full cell in the playfield
	for(var i=0;i<gridWidth;i++){
		var count = 0;
		var flag = false;
		for(var j=0;j<gridHeight;j++){
			if(players[k].occupiedArray[j][i] == 1){
				count++;
				flag = true;
			}
			if(flag && players[k].occupiedArray[j][i] == 0){
				break;
			}
		}
		if(flag && j==gridHeight){
			if(count > bestAltitude)
				bestAltitude = count;
		}	
	}
	h1 = bestAltitude;
	
	//h2 = the number of full cells in the playfield
	for(var i=0;i<gridHeight;i++){
		for(var j=0;j<gridWidth;j++){
			if(players[k].occupiedArray[i][j] == 1)	h2++;
		}
	}
	
	//h3 = the value of the higher slope in the playfield
	for(var i=0;i<gridWidth;i++){
		for(var j=0;j<gridHeight;j++){
			if(players[k].occupiedArray[j][i] == 1){
				var tmp = gridHeight-j;
				var slope = Math.abs(tmp-lastAltitude);
				roughness += slope;
				lastAltitude = tmp;
				if(slope > bestSlope)
					bestSlope = slope;
				break;
			}
		}
		if(j == gridHeight){
			var slope = Math.abs(lastAltitude);
			if(slope > bestSlope)
				bestSlope = slope;
			roughness += slope;
			lastAltitude = 0;
		}
	}
	
	h3 = bestSlope;
	h4 = roughness;
	
	//h5 = the number of full cells in the playfield weighted by their altitude
	for(var i=0;i<gridHeight;i++){
		var fullcells = 0;
		for(var j=0;j<gridWidth;j++){
			if(players[k].occupiedArray[i][j] == 1){
				fullcells++;
			}
		}
		h5 += (fullcells/(i+1));
	}
	
	//h6 = completed rows
	for(var i=0;i<gridHeight;i++){
		for(var j=0;j<gridWidth;j++){
			if(players[k].occupiedArray[i][j] == 0)
				break;
		}
		if(j==gridWidth)
			h6++;
	}
	
	//h7 = aggregate height
	//h8 = bumpiness
	/*for(var i=0;i<gridWidth;i++){
		for(var j=0;j<gridHeight;j++){
			if(players[k].occupiedArray[j][i] == 1){
				var tt = gridHeight-j+1;
				h7 += tt;
				h8 += Math.abs(lastHeight-tt);
				lastHeight = tt;
			}
			break;
		}
	}*/
	
	//score formula
	switch(players[k].level){
		case 1:	score = (20*h0)+h1+h2+h3+h4+h5-(100*h6);
				break;
		case 2:	score = (20*h0)+h1+h2+h3+h4+h5-(100*h6);
				break;
		case 3:	score = (20*h0)+h1+h2+h3+h4+h5-(100*h6);
				break;
		case 4: score = (20*h0)+h1+h3-(100*h6);
				break;
		case 5: score =  h1+h2+h3-(100*h6);
				break;
		case 6:	score =  h1+h2+h3+h4-(100*h6);
				break;
		case 7:	score = (20*h0)+h1+h2+h3-(100*h6);
				break;
		case 8:	score = (20*h0)+h1+h2+h3+h4-(100*h6);
				break;
		case 9:	score = (20*h0)+h1+h2+h3+h4+h5-(100*h6);
				break;
		default:console.log("No such level!");
				break;	
	}
	
	//score = (20*h0)+h1+h2+h3+h4+h5-(100*h6);
	
	/*if(score<players[k].lastBestScore){
		players[k].lastBestScore = score;
		for(var i=0;i<gridHeight;i++){
			for(var j=0;j<gridWidth;j++){
				players[k].occupiedArrayBest[i][j] = players[k].occupiedArray[i][j];
			}
		}
		players[k].besth0 = h0;
		players[k].besth1 = h1;
		players[k].besth2 = h2;
		players[k].besth3 = h3;
		players[k].besth4 = h4;
		players[k].besth5 = h5;
	}*/
	
	/*console.log("***************************************"+k);
	//console.log(players[k].occupiedArray);
	console.log("nextShapetype: "+players[k].nextShapeType);
	console.log("nextShapeStage: "+players[k].nextShapeStage);
	console.log("scores = "+score);
	console.log("h0 = "+h0);
	console.log("h1 = "+h1);
	console.log("h2 = "+h2);
	console.log("h3 = "+h3);
	console.log("h4 = "+h4);
	console.log("h5 = "+h5);*/
	
	return score;
  }
  
  function selectBestScore_AI(id){
	var k = id;
	var best = players[k].scores[0][0];
	players[k].bestX = 0;
	players[k].bestY = 0;                                                         
	
	//console.log("______________scores__________________"+k);
	//console.log(players[k].scores);
	/*console.log("____________________All time best scores____________________: ");
	console.log(players[k].occupiedArrayBest);
	console.log(players[k].lastBestScore);
	console.log(players[k].besth0);
	console.log(players[k].besth1);
	console.log(players[k].besth2);
	console.log(players[k].besth3);
	console.log(players[k].besth4);
	console.log(players[k].besth5);
	console.log(players[k].leftMostY);*/
	
	for(var i=0;i<4;i++){
		for(var j=0;j<gridWidth;j++){
			if((Math.round(parseFloat(players[k].scores[i][j])*100)/100)<(Math.round(parseFloat(best)*100)/100)){
				best = players[k].scores[i][j];
				players[k].bestX = i;
				players[k].bestY = j;
			}
		}
	}
	console.log("bestScore = "+best);
  }
  
  function moveShapeDown_AI(id){
	var k = id;
    players[k].nextShapePos_temp[0][0]++;
    players[k].nextShapePos_temp[1][0]++;
    players[k].nextShapePos_temp[2][0]++;
    players[k].nextShapePos_temp[3][0]++;
    
    updateLeftRightBottomVariables_AI(k);
  }
  
  function moveTheShapeToRight_AI(id){
	var k =id;
    players[k].nextShapePos_temp[0][1]++;
    players[k].nextShapePos_temp[1][1]++;
    players[k].nextShapePos_temp[2][1]++;
    players[k].nextShapePos_temp[3][1]++;
    
    updateLeftRightBottomVariables_AI(k);
  }
  
  function moveTheShapeToLeft_AI(id){
	var k=id;
    players[k].nextShapePos_temp[0][1]--;
    players[k].nextShapePos_temp[1][1]--;
    players[k].nextShapePos_temp[2][1]--;
    players[k].nextShapePos_temp[3][1]--;
    
    updateLeftRightBottomVariables_AI(k);
  }
  
  function makeBlockOccupied_AI(id){
	var k=id;
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[0][0],players[k].nextShapePos_temp[0][1],1,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[1][0],players[k].nextShapePos_temp[1][1],1,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[2][0],players[k].nextShapePos_temp[2][1],1,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[3][0],players[k].nextShapePos_temp[3][1],1,k);
  }
  
  function makeBlockUnoccupied_AI(id){
	var k=id;
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[0][0],players[k].nextShapePos_temp[0][1],0,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[1][0],players[k].nextShapePos_temp[1][1],0,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[2][0],players[k].nextShapePos_temp[2][1],0,k);
    updateOccupyPropertyOfBlocks_AI(players[k].nextShapePos_temp[3][0],players[k].nextShapePos_temp[3][1],0,k);
  }
  
  function updateOccupyPropertyOfBlocks_AI(x,y,val,id){
	var k=id;
    players[k].occupiedArray[x][y] = val;
  }
  
  function rightButton_AI(id){
	var k=id;
    if(players[k].nextRightMostY == gridWidth-1 || checkRightMovement_AI(k) == true){
      return false;
    }else{
			makeBlockUnoccupied_AI(k);
			moveTheShapeToRight_AI(k);
			makeBlockOccupied_AI(k);
			return true;
         }
  }
  
  function leftButton_AI(id){
	var k=id;
    if(players[k].nextLeftMostY == 0 || checkLeftMovement_AI(k) ==  true){
      return false;
    }else{
			makeBlockUnoccupied_AI(k);
			moveTheShapeToLeft_AI(k);
			makeBlockOccupied_AI(k);
			return true;
         }
  }
  
  function checkRightMovement_AI(id){
	var k=id;
    switch(players[k].nextShapeType){
      case 'i':
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 2){
              var y1=players[k].nextShapePos_temp[3][1]+1;
              if(players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y1]== 1)
                return true;
              else
                return false;
			}else if(players[k].nextShapeStage == 1 || players[k].nextShapeStage == 3){
                var y1=players[k].nextShapePos_temp[0][1]+1;
                var y2=players[k].nextShapePos_temp[1][1]+1;
                var y3=players[k].nextShapePos_temp[2][1]+1;
                var y4=players[k].nextShapePos_temp[3][1]+1;
            
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y3]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y4]==1)
                  return true;
                else
                  return false;
              }
            break;
      
      case 'j':
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]+1;
              var y2=players[k].nextShapePos_temp[1][1]+1;
              var y3=players[k].nextShapePos_temp[2][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
              || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y3]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1= players[k].nextShapePos_temp[0][1]+1;
                var y2= players[k].nextShapePos_temp[3][1]+1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                  return true;
                else
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1= players[k].nextShapePos_temp[1][1]+1;
                  var y2= players[k].nextShapePos_temp[2][1]+1;
                  var y3= players[k].nextShapePos_temp[3][1]+1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1= players[k].nextShapePos_temp[2][1]+1;
                    var y2= players[k].nextShapePos_temp[3][1]+1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]+1;
              var y2=players[k].nextShapePos_temp[1][1]+1;
              var y3=players[k].nextShapePos_temp[3][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1= players[k].nextShapePos_temp[2][1]+1;
                var y2= players[k].nextShapePos_temp[3][1]+1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1 )
                  return true;
                else
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1= players[k].nextShapePos_temp[1][1]+1;
                  var y2= players[k].nextShapePos_temp[2][1]+1;
                  var y3= players[k].nextShapePos_temp[3][1]+1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                    return true;
                  else
                    return false;
                }else if(players[k].nextShapeStage == 3){
                  var y1= players[k].nextShapePos_temp[0][1]+1;
                  var y2= players[k].nextShapePos_temp[3][1]+1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1 )
                    return true;
                  else
                    return false;
                }
            break;
      
      case 'o': 
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 1 || players[k].nextShapeStage == 2 || players[k].nextShapeStage == 3){
              var y1=players[k].nextShapePos_temp[1][1]+1;
              var y2=players[k].nextShapePos_temp[2][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1)
                return true;
              else
                return false;
            }
            break;
      
      case 's':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[1][1]+1;
              var y2=players[k].nextShapePos_temp[3][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                return true;
              else
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1 = players[k].nextShapePos_temp[0][1]+1;
                var y2 = players[k].nextShapePos_temp[2][1]+1;
                var y3 = players[k].nextShapePos_temp[3][1]+1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1 = players[k].nextShapePos_temp[1][1]+1;
                  var y2 = players[k].nextShapePos_temp[3][1]+1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1 = players[k].nextShapePos_temp[0][1]+1;
                    var y2 = players[k].nextShapePos_temp[2][1]+1;
                    var y3 = players[k].nextShapePos_temp[3][1]+1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[2][1]+1;
              var y2=players[k].nextShapePos_temp[3][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1 = players[k].nextShapePos_temp[1][1]+1;
                var y2 = players[k].nextShapePos_temp[2][1]+1;
                var y3 = players[k].nextShapePos_temp[3][1]+1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1 = players[k].nextShapePos_temp[0][1]+1;
                  var y2 = players[k].nextShapePos_temp[3][1]+1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1 = players[k].nextShapePos_temp[0][1]+1;
                    var y2 = players[k].nextShapePos_temp[2][1]+1;
                    var y3 = players[k].nextShapePos_temp[3][1]+1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[1][1]+1;
              var y2=players[k].nextShapePos_temp[3][1]+1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1)
				 {
					var y1 = players[k].nextShapePos_temp[0][1]+1;
					var y2 = players[k].nextShapePos_temp[2][1]+1;
					var y3 = players[k].nextShapePos_temp[3][1]+1;
					
					if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
					|| players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
					|| players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
					  return true;
					else 
					  return false;
				 }else if(players[k].nextShapeStage == 2){
						  var y1 = players[k].nextShapePos_temp[1][1]+1;
						  var y2 = players[k].nextShapePos_temp[3][1]+1;
						  
						  if(players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y1]==1 
						  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
							return true;
						  else 
							return false;
						}else if(players[k].nextShapeStage == 3)
								{
									var y1 = players[k].nextShapePos_temp[0][1]+1;
									var y2 = players[k].nextShapePos_temp[2][1]+1;
									var y3 = players[k].nextShapePos_temp[3][1]+1;
									
									if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
									|| players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
									|| players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
									  return true;
									else 
									  return false;
								}
            break;
    }
  }
  
  function checkLeftMovement_AI(id){
	var k=id;
    switch(players[k].nextShapeType){
      case 'i':
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 2){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]== 1)
                return true;
              else
                return false;
            }else if(players[k].nextShapeStage == 1 || players[k].nextShapeStage == 3){
                var y1=players[k].nextShapePos_temp[0][1]-1;
                var y2=players[k].nextShapePos_temp[1][1]-1;
                var y3=players[k].nextShapePos_temp[2][1]-1;
                var y4=players[k].nextShapePos_temp[3][1]-1;
            
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y3]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y4]==1)
                  return true;
                else
                  return false;
              }
            break;
      
      case 'j':
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[1][1]-1;
              var y3=players[k].nextShapePos_temp[3][1]-1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1= players[k].nextShapePos_temp[0][1]-1;
                var y2= players[k].nextShapePos_temp[1][1]-1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1)
                  return true;
                else
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1= players[k].nextShapePos_temp[0][1]-1;
                  var y2= players[k].nextShapePos_temp[2][1]-1;
                  var y3= players[k].nextShapePos_temp[3][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1= players[k].nextShapePos_temp[0][1]-1;
                    var y2= players[k].nextShapePos_temp[3][1]-1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[1][1]-1;
              var y3=players[k].nextShapePos_temp[2][1]-1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y3]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1= players[k].nextShapePos_temp[0][1]-1;
                var y2= players[k].nextShapePos_temp[3][1]-1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1 )
                  return true;
                else
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1= players[k].nextShapePos_temp[0][1]-1;
                  var y2= players[k].nextShapePos_temp[2][1]-1;
                  var y3= players[k].nextShapePos_temp[3][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1
                  || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                    return true;
                  else
                    return false;
                }else if(players[k].nextShapeStage == 3){
                  var y1= players[k].nextShapePos_temp[0][1]-1;
                  var y2= players[k].nextShapePos_temp[1][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1 )
                    return true;
                  else
                    return false;
                }
            break;
			
      case 'o': 
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 1 || players[k].nextShapeStage == 2 || players[k].nextShapeStage == 3){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[3][1]-1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            break;
      
      case 's':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[2][1]-1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1 = players[k].nextShapePos_temp[0][1]-1;
                var y2 = players[k].nextShapePos_temp[1][1]-1;
                var y3 = players[k].nextShapePos_temp[3][1]-1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1 = players[k].nextShapePos_temp[0][1]-1;
                  var y2 = players[k].nextShapePos_temp[2][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1 )
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1 = players[k].nextShapePos_temp[0][1]-1;
                    var y2 = players[k].nextShapePos_temp[1][1]-1;
                    var y3 = players[k].nextShapePos_temp[3][1]-1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[3][1]-1;
                
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y2]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1 = players[k].nextShapePos_temp[0][1]-1;
                var y2 = players[k].nextShapePos_temp[1][1]-1;
                var y3 = players[k].nextShapePos_temp[3][1]-1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1 = players[k].nextShapePos_temp[0][1]-1;
                  var y2 = players[k].nextShapePos_temp[1][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1 = players[k].nextShapePos_temp[0][1]-1;
                    var y2 = players[k].nextShapePos_temp[1][1]-1;
                    var y3 = players[k].nextShapePos_temp[3][1]-1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].nextShapeStage == 0){
              var y1=players[k].nextShapePos_temp[0][1]-1;
              var y2=players[k].nextShapePos_temp[2][1]-1;
              if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
              || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1)
                return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var y1 = players[k].nextShapePos_temp[0][1]-1;
                var y2 = players[k].nextShapePos_temp[1][1]-1;
                var y3 = players[k].nextShapePos_temp[3][1]-1;
                
                if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var y1 = players[k].nextShapePos_temp[0][1]-1;
                  var y2 = players[k].nextShapePos_temp[2][1]-1;
                  
                  if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                  || players[k].occupiedArray[players[k].nextShapePos_temp[2][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }else if(players[k].nextShapeStage == 3){
                    var y1 = players[k].nextShapePos_temp[0][1]-1;
                    var y2 = players[k].nextShapePos_temp[1][1]-1;
                    var y3 = players[k].nextShapePos_temp[3][1]-1;
                    
                    if(players[k].occupiedArray[players[k].nextShapePos_temp[0][0]][y1]==1 
                    || players[k].occupiedArray[players[k].nextShapePos_temp[1][0]][y2]==1
                    || players[k].occupiedArray[players[k].nextShapePos_temp[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
    }
  }
  
  function moveShapeToInitialPos_AI(id){
	var k=id;
	switch(players[k].nextShapeType){
      case 'i':
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 0;
            players[k].nextShapePos_temp[2][0]= 0;
            players[k].nextShapePos_temp[3][0]= 0;
            
            players[k].nextShapePos_temp[0][1]= 5;
            players[k].nextShapePos_temp[1][1]= 6;
            players[k].nextShapePos_temp[2][1]= 7;
            players[k].nextShapePos_temp[3][1]= 8;
              
            updateLeftRightBottomVariables_AI(k);
            break;
              
      case 'j':
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 1;
            players[k].nextShapePos_temp[2][0]= 2;
            players[k].nextShapePos_temp[3][0]= 2;
            
            players[k].nextShapePos_temp[0][1]= 5;
            players[k].nextShapePos_temp[1][1]= 5;
            players[k].nextShapePos_temp[2][1]= 5;
            players[k].nextShapePos_temp[3][1]= 4;
              
            updateLeftRightBottomVariables_AI(k);
            break;
            
      case 'l': 
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 1;
            players[k].nextShapePos_temp[2][0]= 2;
            players[k].nextShapePos_temp[3][0]= 2;
            
            players[k].nextShapePos_temp[0][1]= 4;
            players[k].nextShapePos_temp[1][1]= 4;
            players[k].nextShapePos_temp[2][1]= 4;
            players[k].nextShapePos_temp[3][1]= 5;
              
            updateLeftRightBottomVariables_AI(k);
            break;
            
      case 'o': 
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 0;
            players[k].nextShapePos_temp[2][0]= 1;
            players[k].nextShapePos_temp[3][0]= 1;
            
            players[k].nextShapePos_temp[0][1]= 4;
            players[k].nextShapePos_temp[1][1]= 5;
            players[k].nextShapePos_temp[2][1]= 5;
            players[k].nextShapePos_temp[3][1]= 4;
              
            updateLeftRightBottomVariables_AI(k);
            break;
			
      case 's':
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 0;
            players[k].nextShapePos_temp[2][0]= 1;
            players[k].nextShapePos_temp[3][0]= 1;
            
            players[k].nextShapePos_temp[0][1]= 4;
            players[k].nextShapePos_temp[1][1]= 5;
            players[k].nextShapePos_temp[2][1]= 3;
            players[k].nextShapePos_temp[3][1]= 4;
              
            updateLeftRightBottomVariables_AI(k);
            break;
      
      case 't':   
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 0;
            players[k].nextShapePos_temp[2][0]= 0;
            players[k].nextShapePos_temp[3][0]= 1;
            
            players[k].nextShapePos_temp[0][1]= 4;
            players[k].nextShapePos_temp[1][1]= 5;
            players[k].nextShapePos_temp[2][1]= 6;
            players[k].nextShapePos_temp[3][1]= 5;
              
            updateLeftRightBottomVariables_AI(k);
            break;
      
      case 'z':
            players[k].nextShapeStage = 0;
            players[k].nextShapePos_temp[0][0]= 0;
            players[k].nextShapePos_temp[1][0]= 0;
            players[k].nextShapePos_temp[2][0]= 1;
            players[k].nextShapePos_temp[3][0]= 1;
            
            players[k].nextShapePos_temp[0][1]= 4;
            players[k].nextShapePos_temp[1][1]= 5;
            players[k].nextShapePos_temp[2][1]= 5;
            players[k].nextShapePos_temp[3][1]= 6;
              
            updateLeftRightBottomVariables_AI(k);
            break;
    }
  }
  
  function moveShapeToNextRotationStage_AI(id){
	var k=id;
	
	switch(players[k].nextShapeType){
      case 'i':
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+1;
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+1;
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-2;
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+2;
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-1;
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+2 ;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+2;
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-1;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+2;
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-2;
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+1;
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
                }else if(players[k].nextShapeStage == 3){
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-2;
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-2;
                  }
            break;
            
      case 'j':
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-1;
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+2;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-1;
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+1;
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1 ;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+1;
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+2;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1];
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-2;
                }else if(players[k].nextShapeStage == 3){
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+1;
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
                  }
            break;
      
      case 'l': 
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-1;
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1 ;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1];
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+1;
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1] ;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+2;
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-1;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1];
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
                }else if(players[k].nextShapeStage == 3){
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+1;
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-2;
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1];
                  }
            break;
      
      case 'o': 
            break;
            
      case 's': 
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1] ;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-2;
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-1;
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-1;
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1] ;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+2;
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+1;
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1;
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+2;
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1];
                }else if(players[k].nextShapeStage == 3){
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+1;
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-2;
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+1;
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1];
                  }
            break;
            
      case 't': 
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1 ;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1];
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1 ;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1;
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+2;
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
                }else if(players[k].nextShapeStage == 3){
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-2;
                  }
            break;
            
      case 'z': 
            if(players[k].nextShapeStage == 0){
              //1st block pos
              players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
              players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-2 ;
                
              //2nd block pos
              players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]-1;
              players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                
              //3rd block pos
              players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
              players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]-1;
                
              //4th block pos
              players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]-1;
              players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+1;
            }else if(players[k].nextShapeStage == 1){
                //1st block pos
                players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]-1;
                players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+2;
                
                //2nd block pos
                players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1];
                
                //3rd block pos
                players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]-1;
                players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1]+1;
                
                //4th block pos
                players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-1;
              }else if(players[k].nextShapeStage == 2){ 
                  //1st block pos
                  players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0]+1;
                  players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]-1;
                
                  //2nd block pos
                  players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0];
                  players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]+1;
                
                  //3rd block pos
                  players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0]+1;
                  players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                
                  //4th block pos
                  players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0];
                  players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]+2;
                }else if(players[k].nextShapeStage == 3){                                                               
                    //1st block pos
                    players[k].nextShapePos_temp[0][0] = players[k].nextShapePos_temp[0][0];
                    players[k].nextShapePos_temp[0][1] = players[k].nextShapePos_temp[0][1]+1;
                  
                    //2nd block pos
                    players[k].nextShapePos_temp[1][0] = players[k].nextShapePos_temp[1][0]+1;
                    players[k].nextShapePos_temp[1][1] = players[k].nextShapePos_temp[1][1]-1;
                  
                    //3rd block pos
                    players[k].nextShapePos_temp[2][0] = players[k].nextShapePos_temp[2][0];
                    players[k].nextShapePos_temp[2][1] = players[k].nextShapePos_temp[2][1];
                  
                    //4th block pos
                    players[k].nextShapePos_temp[3][0] = players[k].nextShapePos_temp[3][0]+1;
                    players[k].nextShapePos_temp[3][1] = players[k].nextShapePos_temp[3][1]-2;
                  }
            break;
    }
	updateLeftRightBottomVariables_AI(k);
  }
  
  function checkOccupiedBlock_AI(id){
	var k=id;
    switch(players[k].nextShapeType){
      case 'i':
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 2){
              var x1=players[k].nextShapePos_temp[0][0]+1;
              var x2=players[k].nextShapePos_temp[1][0]+1;
              var x3=players[k].nextShapePos_temp[2][0]+1;
              var x4=players[k].nextShapePos_temp[3][0]+1;
            
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[1][1]]==1 
              || players[k].occupiedArray[x3][players[k].nextShapePos_temp[2][1]]==1 
              || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
				
				return true;
              else
                return false;
            }else if(players[k].nextShapeStage == 1 || players[k].nextShapeStage == 3){
              var x1=players[k].nextBottomMostX+1;
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[3][1]]== 1)
                
				return true;
              else
                return false;
            }
            break;
      
      case 'j':
            if(players[k].nextShapeStage == 0){
              var x1=players[k].nextShapePos_temp[2][0]+1;
              var x2=players[k].nextShapePos_temp[3][0]+1;
                
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                
				return true;
              else 
                return false;
            }else if(players[k].nextShapeStage == 1){
                var x1= players[k].nextShapePos_temp[1][0]+1;
                var x2= players[k].nextShapePos_temp[2][0]+1;
                var x3= players[k].nextShapePos_temp[3][0]+1;
                
                if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                  
				  return true;
                else
                  return false;
              }else if(players[k].nextShapeStage == 2){
                  var x1= players[k].nextShapePos_temp[3][0]+1;
                  var x2= players[k].nextShapePos_temp[1][0]+1
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[3][1]]==1
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[1][1]]==1)
                  
					return true;
                  else 
                    return false;
                }
                else if(players[k].nextShapeStage == 3){
                    var x1= players[k].nextShapePos_temp[0][0]+1;
                    var x2= players[k].nextShapePos_temp[1][0]+1;
                    var x3= players[k].nextShapePos_temp[3][0]+1;
                    
                    if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
                    || players[k].occupiedArray[x2][players[k].nextShapePos_temp[1][1]]==1 
                    || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].nextShapeStage == 0)
            {
              var x1=players[k].nextShapePos_temp[2][0]+1;
              var x2=players[k].nextShapePos_temp[3][0]+1;
                
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].nextShapeStage == 1){
                var x1= players[k].nextShapePos_temp[1][0]+1;
                var x2= players[k].nextShapePos_temp[2][0]+1;
                var x3= players[k].nextShapePos_temp[3][0]+1;
                
                if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].nextShapeStage == 2)
                {
                  var x1= players[k].nextShapePos_temp[0][0]+1;
                  var x2= players[k].nextShapePos_temp[3][0]+1;
                  
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                    return true;
                  else
                    return false;
                }
                else if(players[k].nextShapeStage == 3)
                {
                  var x1= players[k].nextShapePos_temp[1][0]+1;
                  var x2= players[k].nextShapePos_temp[2][0]+1;
                  var x3= players[k].nextShapePos_temp[3][0]+1;
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                    return true;
                  else
                    return false;
                }
            break;
      
      case 'o': 
            if(players[k].nextShapeStage == 0 || players[k].nextShapeStage == 1 || players[k].nextShapeStage == 2 || players[k].nextShapeStage == 3)
            {
              var x1=players[k].nextShapePos_temp[2][0]+1;
              var x2=players[k].nextShapePos_temp[3][0]+1;
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                return true;
              else 
                return false;
            }
            break;
      
      case 's':   
            if(players[k].nextShapeStage == 0)
            {
              var x1=players[k].nextShapePos_temp[1][0]+1;
              var x2=players[k].nextShapePos_temp[2][0]+1;
              var x3=players[k].nextShapePos_temp[3][0]+1;
                
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1
              || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].nextShapeStage == 1)
              {
                var x1 = players[k].nextShapePos_temp[1][0]+1;
                var x2 = players[k].nextShapePos_temp[3][0]+1;
                
                if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].nextShapeStage == 2)
                {
                  var x1 = players[k].nextShapePos_temp[1][0]+1;
                  var x2 = players[k].nextShapePos_temp[2][0]+1;
                  var x3 = players[k].nextShapePos_temp[3][0]+1;
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                  || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].nextShapeStage == 3)
                  {
                    var x1 = players[k].nextShapePos_temp[1][0]+1;
                    var x2 = players[k].nextShapePos_temp[3][0]+1;
                    
                    if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                    || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].nextShapeStage == 0)
            {
              var x1=players[k].nextShapePos_temp[0][0]+1;
              var x2=players[k].nextShapePos_temp[2][0]+1;
              var x3=players[k].nextShapePos_temp[3][0]+1;
                
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1
              || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].nextShapeStage == 1)
              {
                var x1 = players[k].nextShapePos_temp[0][0]+1;
                var x2 = players[k].nextShapePos_temp[3][0]+1;
                
                if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
                || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].nextShapeStage == 2)
                {
                  var x1 = players[k].nextShapePos_temp[1][0]+1;
                  var x2 = players[k].nextShapePos_temp[2][0]+1;
                  var x3 = players[k].nextShapePos_temp[3][0]+1;
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[1][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                  || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].nextShapeStage == 3)
                  {
                    var x1 = players[k].nextShapePos_temp[2][0]+1;
                    var x2 = players[k].nextShapePos_temp[3][0]+1;
                    
                    if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
                    || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].nextShapeStage == 0){
              var x1=players[k].nextShapePos_temp[0][0]+1;
              var x2=players[k].nextShapePos_temp[2][0]+1;
              var x3=players[k].nextShapePos_temp[3][0]+1;
                
              if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
              || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1
              || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].nextShapeStage == 1){
                var x1 = players[k].nextShapePos_temp[2][0]+1;
                var x2 = players[k].nextShapePos_temp[3][0]+1;
                
                if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
                || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].nextShapeStage == 2)
                {
                  var x1 = players[k].nextShapePos_temp[0][0]+1;
                  var x2 = players[k].nextShapePos_temp[2][0]+1;
                  var x3 = players[k].nextShapePos_temp[3][0]+1;
                  
                  if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[0][1]]==1 
                  || players[k].occupiedArray[x2][players[k].nextShapePos_temp[2][1]]==1 
                  || players[k].occupiedArray[x3][players[k].nextShapePos_temp[3][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].nextShapeStage == 3)
                  {
                    var x1 = players[k].nextShapePos_temp[2][0]+1;
                    var x2 = players[k].nextShapePos_temp[3][0]+1;
                    
                    if(players[k].occupiedArray[x1][players[k].nextShapePos_temp[2][1]]==1 
                    || players[k].occupiedArray[x2][players[k].nextShapePos_temp[3][1]]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
    }
  }
  
  function updateLeftRightBottomVariables_AI(id){
	var k=id;
    switch(players[k].nextShapeType){
      case 'i':   
            players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
            players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
            
            players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
            players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                    
            players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
            players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            break;
            
      case 'j': 
            if(players[k].nextShapeStage == 0){
              players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
              players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
              
              players[k].nextLeftMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextLeftMostY = players[k].nextShapePos_temp[3][1];
                      
              players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            }
            else if(players[k].nextShapeStage == 1){
                players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
              
                players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                        
                players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
              }
              else if(players[k].nextShapeStage == 2){
                  players[k].nextRightMostX = players[k].nextShapePos_temp[1][0];
                  players[k].nextRightMostY = players[k].nextShapePos_temp[1][1];
                
                  players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                  players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                          
                  players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                  players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                }
                else if(players[k].nextShapeStage == 3){
                    players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                    players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
                  
                    players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                    players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                            
                    players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                    players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                  }
            break;
      
      case 'l': 
			if(players[k].nextShapeStage == 0){
              players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
            
              players[k].nextLeftMostX = players[k].nextShapePos_temp[2][0];
              players[k].nextLeftMostY = players[k].nextShapePos_temp[2][1];
                      
              players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            }
            else if(players[k].nextShapeStage == 1){
                players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
            
                players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                      
                players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
              }
              else if(players[k].nextShapeStage == 2){
                  players[k].nextRightMostX = players[k].nextShapePos_temp[1][0];
                  players[k].nextRightMostY = players[k].nextShapePos_temp[1][1];
              
                  players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                  players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                        
                  players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                  players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                }
                else if(players[k].nextShapeStage == 3){
                    players[k].nextRightMostX = players[k].nextShapePos_temp[0][0];
                    players[k].nextRightMostY = players[k].nextShapePos_temp[0][1];
                
                    players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                    players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                          
                    players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                    players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                  }
            break;
      
      case 'o':
            players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
            players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
          
            players[k].nextLeftMostX = players[k].nextShapePos_temp[3][0];
            players[k].nextLeftMostY = players[k].nextShapePos_temp[3][1];
                    
            players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
            players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            break;
            
      case 's':
            if(players[k].nextShapeStage == 0){
              players[k].nextRightMostX = players[k].nextShapePos_temp[1][0];
              players[k].nextRightMostY = players[k].nextShapePos_temp[1][1];
          
              players[k].nextLeftMostX = players[k].nextShapePos_temp[2][0];
              players[k].nextLeftMostY = players[k].nextShapePos_temp[2][1];
                    
              players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            }
            else if(players[k].nextShapeStage == 1){
                players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
            
                players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                      
                players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
              }
              else if(players[k].nextShapeStage == 2){
                  players[k].nextRightMostX = players[k].nextShapePos_temp[1][0];
                  players[k].nextRightMostY = players[k].nextShapePos_temp[1][1];
              
                  players[k].nextLeftMostX = players[k].nextShapePos_temp[2][0];
                  players[k].nextLeftMostY = players[k].nextShapePos_temp[2][1];
                        
                  players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                  players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                }
                else if(players[k].nextShapeStage == 3){
                    players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                    players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
                
                    players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                    players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                          
                    players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                    players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                  }
            break;
      
      case 't':
            if(players[k].nextShapeStage == 0){
              players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
              players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
            
              players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
              players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                      
              players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            }
            else if(players[k].nextShapeStage == 1){
                players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
                
				players[k].nextLeftMostX =  players[k].nextShapePos_temp[0][0];
                players[k].nextLeftMostY =  players[k].nextShapePos_temp[0][1];
                      
                players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
              }
            else if(players[k].nextShapeStage == 2){
                  players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
                  players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
              
                  players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                  players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                        
                  players[k].nextBottomMostX = players[k].nextShapePos_temp[2][0];
                  players[k].nextBottomMostY = players[k].nextShapePos_temp[2][1];
                }
                else if(players[k].nextShapeStage == 3){
                    players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                    players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
                
                    players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                    players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                          
                    players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                    players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                  }
            break;
            
      case 'z':
            if(players[k].nextShapeStage == 0){
              players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
            
              players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
              players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                      
              players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
              players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
            }
            else if(players[k].nextShapeStage == 1){
                players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
            
                players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                      
                players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
              }
              else if(players[k].nextShapeStage == 2){
                  players[k].nextRightMostX = players[k].nextShapePos_temp[3][0];
                  players[k].nextRightMostY = players[k].nextShapePos_temp[3][1];
              
                  players[k].nextLeftMostX = players[k].nextShapePos_temp[0][0];
                  players[k].nextLeftMostY = players[k].nextShapePos_temp[0][1];
                        
                  players[k].nextBottomMostX = players[k].nextShapePos_temp[2][0];
                  players[k].nextBottomMostY = players[k].nextShapePos_temp[2][1];
                }
                else if(players[k].nextShapeStage == 3){
                    players[k].nextRightMostX = players[k].nextShapePos_temp[2][0];
                    players[k].nextRightMostY = players[k].nextShapePos_temp[2][1];
						
                    players[k].nextLeftMostX = players[k].nextShapePos_temp[1][0];
                    players[k].nextLeftMostY = players[k].nextShapePos_temp[1][1];
                          
                    players[k].nextBottomMostX = players[k].nextShapePos_temp[3][0];
                    players[k].nextBottomMostY = players[k].nextShapePos_temp[3][1];
                  }
            break;
    }
  }
  
  //----------------------AI Close--------------------------------------------
  
  //controls the shape right movement
  function checkRightMovement(k){
    switch(players[k].shapeType){
      case 'i':
            if(players[k].shapeStage == 0 || players[k].shapeStage == 2)
            {
              var y1=players[k].shapePos[3][1]+1;
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y1]== 1)
                return true;
              else
                return false;
            }
            else if(players[k].shapeStage == 1 || players[k].shapeStage == 3)
              {
                var y1=players[k].shapePos[0][1]+1;
                var y2=players[k].shapePos[1][1]+1;
                var y3=players[k].shapePos[2][1]+1;
                var y4=players[k].shapePos[3][1]+1;
            
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y3]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y4]==1)
                  return true;
                else
                  return false;
              }
            break;
      
      case 'j':
            if(players[k].shapeStage == 0)
            {
              var y1=players[k].shapePos[0][1]+1;
              var y2=players[k].shapePos[1][1]+1;
              var y3=players[k].shapePos[2][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y3]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
                var y1= players[k].shapePos[0][1]+1;
                var y2= players[k].shapePos[3][1]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var y1= players[k].shapePos[1][1]+1;
                  var y2= players[k].shapePos[2][1]+1;
                  var y3= players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1= players[k].shapePos[2][1]+1;
                    var y2= players[k].shapePos[3][1]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]+1;
              var y2=players[k].shapePos[1][1]+1;
              var y3=players[k].shapePos[3][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1= players[k].shapePos[2][1]+1;
                var y2= players[k].shapePos[3][1]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1= players[k].shapePos[1][1]+1;
                  var y2= players[k].shapePos[2][1]+1;
                  var y3= players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                    return true;
                  else
                    return false;
                }
                else if(players[k].shapeStage == 3){
                  var y1= players[k].shapePos[0][1]+1;
                  var y2= players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
                    return true;
                  else
                    return false;
                }
            break;
      
      case 'o': 
            if(players[k].shapeStage == 0 || players[k].shapeStage == 1 || players[k].shapeStage == 2 || players[k].shapeStage == 3){
              var y1=players[k].shapePos[1][1]+1;
              var y2=players[k].shapePos[2][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                return true;
              else
                return false;
            }
            break;
      
      case 's':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[1][1]+1;
              var y2=players[k].shapePos[3][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1 = players[k].shapePos[0][1]+1;
                var y2 = players[k].shapePos[2][1]+1;
                var y3 = players[k].shapePos[3][1]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1 = players[k].shapePos[1][1]+1;
                  var y2 = players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1 = players[k].shapePos[0][1]+1;
                    var y2 = players[k].shapePos[2][1]+1;
                    var y3 = players[k].shapePos[3][1]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[2][1]+1;
              var y2=players[k].shapePos[3][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1 = players[k].shapePos[1][1]+1;
                var y2 = players[k].shapePos[2][1]+1;
                var y3 = players[k].shapePos[3][1]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1 = players[k].shapePos[0][1]+1;
                  var y2 = players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1 = players[k].shapePos[0][1]+1;
                    var y2 = players[k].shapePos[2][1]+1;
                    var y3 = players[k].shapePos[3][1]+1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[1][1]+1;
              var y2=players[k].shapePos[3][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
				 {
					var y1 = players[k].shapePos[0][1]+1;
					var y2 = players[k].shapePos[2][1]+1;
					var y3 = players[k].shapePos[3][1]+1;
					
					if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
					|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
					|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
					  return true;
					else 
					  return false;
				 }
				  else if(players[k].shapeStage == 2){
						  var y1 = players[k].shapePos[1][1]+1;
						  var y2 = players[k].shapePos[3][1]+1;
						  
						  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y1]==1 
						  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
							return true;
						  else 
							return false;
						}
						else if(players[k].shapeStage == 3)
								{
									var y1 = players[k].shapePos[0][1]+1;
									var y2 = players[k].shapePos[2][1]+1;
									var y3 = players[k].shapePos[3][1]+1;
									
									if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
									|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
									|| players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
									  return true;
									else 
									  return false;
								}
            break;
    }
  }
  
  function checkLeftMovement(k){   
    switch(players[k].shapeType){
      case 'i':
            if(players[k].shapeStage == 0 || players[k].shapeStage == 2){
              var y1=players[k].shapePos[0][1]-1;
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]== 1)
                return true;
              else
                return false;
            }
            else if(players[k].shapeStage == 1 || players[k].shapeStage == 3){
                var y1=players[k].shapePos[0][1]-1;
                var y2=players[k].shapePos[1][1]-1;
                var y3=players[k].shapePos[2][1]-1;
                var y4=players[k].shapePos[3][1]-1;
            
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y3]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y4]==1)
                  return true;
                else
                  return false;
              }
            break;
      
      case 'j':
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[1][1]-1;
              var y3=players[k].shapePos[3][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1= players[k].shapePos[0][1]-1;
                var y2= players[k].shapePos[1][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1= players[k].shapePos[0][1]-1;
                  var y2= players[k].shapePos[2][1]-1;
                  var y3= players[k].shapePos[3][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1= players[k].shapePos[0][1]-1;
                    var y2= players[k].shapePos[3][1]-1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                      return true;
                    else
                      return false;
                  }
            break;
      
      case 'l':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[1][1]-1;
              var y3=players[k].shapePos[2][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y3]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1= players[k].shapePos[0][1]-1;
                var y2= players[k].shapePos[3][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1= players[k].shapePos[0][1]-1;
                  var y2= players[k].shapePos[2][1]-1;
                  var y3= players[k].shapePos[3][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                    return true;
                  else
                    return false;
                }
                else if(players[k].shapeStage == 3){
                  var y1= players[k].shapePos[0][1]-1;
                  var y2= players[k].shapePos[1][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1 )
                    return true;
                  else
                    return false;
                }
            break;
      case 'o': 
            if(players[k].shapeStage == 0 || players[k].shapeStage == 1 || players[k].shapeStage == 2 || players[k].shapeStage == 3){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[3][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            break;
      
      case 's':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[2][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1 = players[k].shapePos[0][1]-1;
                var y2 = players[k].shapePos[1][1]-1;
                var y3 = players[k].shapePos[3][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[2][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1 )
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1 = players[k].shapePos[0][1]-1;
                    var y2 = players[k].shapePos[1][1]-1;
                    var y3 = players[k].shapePos[3][1]-1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
            
      case 't':   
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[3][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1 = players[k].shapePos[0][1]-1;
                var y2 = players[k].shapePos[1][1]-1;
                var y3 = players[k].shapePos[3][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[1][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1 = players[k].shapePos[0][1]-1;
                    var y2 = players[k].shapePos[1][1]-1;
                    var y3 = players[k].shapePos[3][1]-1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
      
      case 'z': 
            if(players[k].shapeStage == 0){
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[2][1]-1;
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1){
                var y1 = players[k].shapePos[0][1]-1;
                var y2 = players[k].shapePos[1][1]-1;
                var y3 = players[k].shapePos[3][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                  return true;
                else 
                  return false;
              }
              else if(players[k].shapeStage == 2){
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[2][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3){
                    var y1 = players[k].shapePos[0][1]-1;
                    var y2 = players[k].shapePos[1][1]-1;
                    var y3 = players[k].shapePos[3][1]-1;
                    
                    if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1
                    || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y3]==1)
                      return true;
                    else 
                      return false;
                  }
            break;
    }
  }
  
  function selectNextPiece(k){
	players[k].shapeType = players[k].nextPiece;
	players[k].anyColor = players[k].nextColor;
  }
  
  function rightButton(k){
    if(players[k].rightMostY == gridWidth-1){
      if(players[k].isAI == false)
		allUsers.activeUsers[k].emit('illegal move',true);//illegal move sound play //alert("No more room for moving right!");
    }
    else if(checkRightMovement(k) == true){
        if(players[k].isAI == false)
			allUsers.activeUsers[k].emit('illegal move',true);//illegal sound play //console.log("checkRightMovement() == true");
      }
      else{
        makeBlockUnoccupied(k);
        eraseShape(k);
        moveTheShapeToRight(k);
        colorTheShape(k);
        makeBlockOccupied(k);
      }
  }
  
  //controls the shape left movement
  function leftButton(k){
    if(players[k].leftMostY == 0){
      if(players[k].isAI == false)
		allUsers.activeUsers[k].emit('illegal move',true);//illegal move sound play //alert("No more room for moving left!");
    }
    else if(checkLeftMovement(k) ==  true){
        if(players[k].isAI == false)
			allUsers.activeUsers[k].emit('illegal move',true);//illegal move sound play
      }
      else{
			makeBlockUnoccupied(k);
			eraseShape(k);
			moveTheShapeToLeft(k);
			colorTheShape(k);
			makeBlockOccupied(k);
		  }
  }
  
  //function of drop button when players[k].pressed
  function dropButtonPressed(k){
    var id = k;
	players[id].dropTimerVar = setInterval( function() 
    {if (Object.keys(allUsers.activeUsers).indexOf(id)>-1) moveBox(id); }, 50);
  }
  
  //function of drop button when released
  function dropButtonReleased(k){
    var idd = k;
	players[k].swipedDown = false;
    clearInterval(players[idd].dropTimerVar);
  }
  
  function stopTheGameTimer(rmName){
    var rName = rmName;
    var timeVar = allGames.activeGames[rName].gameTimer;
    clearInterval(allGames.activeGames[rName].gameTimer);
  }
  
  //rotates the current shape to next rotation stage
  function rotateButton(k){
    storeCurrentPos(k);
    makeBlockUnoccupied(k);
    players[k].shapeStage = (players[k].shapeStage+1)%4;
        
    moveShapeToNextRotationStage(k);
        
    if(isRotationValid(k) == true){
      updateOccupyPropertyOfBlocks(players[k].cachePos[0][0],players[k].cachePos[0][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[1][0],players[k].cachePos[1][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[2][0],players[k].cachePos[2][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[3][0],players[k].cachePos[3][1],0,k);
      
	  //Update color property of new blocks
      updateBackgroundPropertyOfBlocks(players[k].cachePos[0][0],players[k].cachePos[0][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[1][0],players[k].cachePos[1][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[2][0],players[k].cachePos[2][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[3][0],players[k].cachePos[3][1],defaultBackgroundColor,k);
          
      colorTheShape(k);
      makeBlockOccupied(k);
    } 
    else{
	  //illegal move sound play
	  allUsers.activeUsers[k].emit('illegal move',true);
      rollBack(k);
      makeBlockOccupied(k);
    }
  }
  
  //if rotation is valid then apply rotation
  //check if rotation is valid
  function isRotationValid(k){
    if( isOccupied(players[k].shapePos[0][0],players[k].shapePos[0][1],k) == true ||
      isOccupied(players[k].shapePos[1][0],players[k].shapePos[1][1],k) == true ||
      isOccupied(players[k].shapePos[2][0],players[k].shapePos[2][1],k) == true ||
      isOccupied(players[k].shapePos[3][0],players[k].shapePos[3][1],k) == true ||
      players[k].leftMostY <0 ||
      players[k].rightMostY >=gridWidth ||
      players[k].bottomMostX >=gridHeight)
      return false;
    else
      return true;
  }
  
  function storeCurrentPos(k){
    players[k].cachePos[0][0] = players[k].shapePos[0][0];
    players[k].cachePos[0][1] = players[k].shapePos[0][1];
    
    players[k].cachePos[1][0] = players[k].shapePos[1][0];
    players[k].cachePos[1][1] = players[k].shapePos[1][1];
    
    players[k].cachePos[2][0] = players[k].shapePos[2][0];
    players[k].cachePos[2][1] = players[k].shapePos[2][1];
    
    players[k].cachePos[3][0] = players[k].shapePos[3][0];
    players[k].cachePos[3][1] = players[k].shapePos[3][1];
    
    players[k].cacheLeftMostX = players[k].leftMostX;
    players[k].cacheLeftMostY = players[k].leftMostY;
    
    players[k].cacheRightMostX = players[k].rightMostX;
    players[k].cacheRightMostY = players[k].rightMostY;
    
    players[k].cacheBottomMostX = players[k].bottomMostX;
    players[k].cacheBottomMostY = players[k].bottomMostY;
    
    players[k].cacheShapeStage = players[k].shapeStage;
  }
  
  function rollBack(k){
    players[k].shapePos[0][0] = players[k].cachePos[0][0];
    players[k].shapePos[0][1] = players[k].cachePos[0][1];
    
    players[k].shapePos[1][0] = players[k].cachePos[1][0];
    players[k].shapePos[1][1] = players[k].cachePos[1][1];
    
    players[k].shapePos[2][0] = players[k].cachePos[2][0];
    players[k].shapePos[2][1] = players[k].cachePos[2][1];
    
    players[k].shapePos[3][0] = players[k].cachePos[3][0];
    players[k].shapePos[3][1] = players[k].cachePos[3][1];
    
    players[k].leftMostX = players[k].cacheLeftMostX;
    players[k].leftMostY = players[k].cacheLeftMostY;
    
    players[k].rightMostX = players[k].cacheRightMostX;
    players[k].rightMostY = players[k].cacheRightMostY;
    
    players[k].bottomMostX = players[k].cacheBottomMostX;
    players[k].bottomMostY = players[k].cacheBottomMostY;
    
    players[k].shapeStage = players[k].cacheShapeStage;
  }

  function clearTheInterval(Inter){
    clearInterval(Inter);
  }
  
  function clearAllIntervals(theRoom,p1,p2){
    var isRoom = theRoom;
    var play1 = p1;
    var play2 = p2;
    clearInterval(players[play1].dropTimerVar);
    clearInterval(players[play2].dropTimerVar);
    clearInterval(allGames.activeGames[isRoom].milisecRoomClockVar);
	return 1;
  }
  
  //9 ranks crown being the highest
  function rank_decider(user,rating){
    var level_no=1;
    if(rating>=800 && rating<=900)
		level_no = 1;
		else if(rating>=901 && rating<=1000)
			level_no = 2;
			else if(rating>=1001 && rating<=1200)
				level_no = 3;
				else if(rating>=1201 && rating<=1500)
					level_no = 4;
					else if(rating>=1501 && rating<=1700)
						level_no = 5;
						else if(rating>=1701 && rating<=2000)
							level_no = 6;
							else if(rating>=2001 && rating<=2500)
								level_no = 7;
									else if(level_no>=2501 && level_no<=3000)
										level_no = 8;
											else level_no = 9;
	user.Level = level_no;
    switch(level_no){
        case 1:
                user.rank = "Bronze";
                break;
		case 2:
				user.rank = "Silver";
                break;
		case 3: 
                user.rank = "Gold"; 
                break;   
        case 4: 
                user.rank = "Platinum"; 
                break;     
        case 5: 
                user.rank = "Ruby"; 
                break;   
		case 6: 
                user.rank = "Sapphire"; 
                break;   
        case 7: 
                user.rank = "Emerald"; 
                break;   
		case 8: 
                user.rank = "Diamond"; 
                break;      
        default: 
                user.rank = "Crown"; 
                break;             
    }
  }
  
  //the game is over
  function gameOver(k,draw){
    var theID = k;
	var theRoom = players[theID].myRoom;
	var theOpponent = players[theID].opponentID;
	
	if(players[theID].isAI == true)	var theSocket = theOpponent+"socket";
	else	var theSocket = allUsers.activeUsers[theID];
	
	if(players[theID].isPlayingWithAI == true)	var theOpponentSocket = theID+"socket";
	else	var theOpponentSocket = allUsers.activeUsers[theOpponent];
	
	var winner_rating = elo.newRatingIfWon(parseInt(players[theOpponent].trophy_no),parseInt(players[theID].trophy_no));
	var winDiff = winner_rating-players[theOpponent].trophy_no;
	
	clearInterval(players[theID].mVar);
	clearInterval(players[theOpponent].mVar);
	
	theOpponentSocket.trophy_no = winner_rating;
	theSocket.trophy_no = players[theID].trophy_no - winDiff;
	
	if(draw == false){	
		players[theID].trophy_no -= winDiff ;
		if(players[theID].trophy_no < 800) players[theID].trophy_no =800;
		 
		players[theOpponent].trophy_no = winner_rating;
		
		if(winner_rating<800)	winner_rating = 800;
		if(players[theOpponent].isAI == false){
			Trophy.getUserBydbid(players[theOpponent].username, function(err, user){
				if(err) throw err;
				if(user){
						user.trophies = winner_rating;
						rank_decider(user,winner_rating);
						user.save();
					}
				else    console.log("could not update trophies");
			});
		}
		
		if(players[theID].isAI == false){
			Trophy.getUserBydbid(players[theID].username,function(err, user){
				if(err) throw err;
				if(user){
						  user.trophies = players[theID].trophy_no;
						  rank_decider(user,players[theID].trophy_no);				  
						  user.save();
						}
				else	console.log("could not update trophies");
			});
		}
		// my code ends
	}
	
	allGames.noOfGamesPlayed++;
	
	players[theID].isMultiplayer =false;
	players[theOpponent].isMultiplayer =false;
	
	if(players[theID].isAI == false){
		if(allUsers.activeUsers[theID]){
			if(draw == false)
				allUsers.activeUsers[theID].emit('theGameIsOver',{line:["lost",winDiff]});
			else 
				allUsers.activeUsers[theID].emit('theGameIsDraw',true);
			
			leaveTheRoom(theID);
			//resetPlayer(theID);
		}
	}

	if(players[theOpponent].isAI == false){
		if(allUsers.activeUsers[theOpponent]){
			if(draw == false)
				allUsers.activeUsers[theOpponent].emit('theGameIsOver',{line:["won",winDiff]});
			else 
				allUsers.activeUsers[theOpponent].emit('theGameIsDraw',true);
			
			leaveTheRoom(theOpponent);
			//resetPlayer(theOpponent);
		}
	}
	
	var spectateRoom = allGames.activeGames[theRoom].spectatingRoom;
	//to send who won to all spectators
	io.in(spectateRoom).emit('gameResultForSpectators',players[theOpponent].nameOfUser);
	
	clearAllIntervals(theRoom,theID,theOpponent);
	allGames.activeGames[theRoom]={};
  }
  
  function makingOfGame(k){
      setOccupyPropertyOfBlocks(k);
      setBackgroundPropertyOfBlocks(k);
      setBackgroundPropertyOfNextBlocks(k);
      
      randomBlockGenerator(k);
	  
      selectNextPiece(k);
      moveShapeToInitialPos(k);
      
	  randomBlockGenerator(k);
      moveNextShapeToInitialPos(k);
      colorNextShape(k);
	  
	  if(players[k].isAI == true){
		callAI(k);
		if(players[k].bestX!=null && players[k].bestY!=null)
			makeAImoves(k);
	  }
  }
  
  //to check if object is empty
function isEmpty(obj) {
    // null and undefined are "empty"
    if (obj == null) return true;

    // Assume if it has a length property with a non-zero value
    // that that property is correct.
    if (obj.length > 0)    return false;
    if (obj.length === 0)  return true;

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