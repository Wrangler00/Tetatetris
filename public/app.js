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
var elo = new Elo();
var mongo = require('mongodb');
var mongoose = require('mongoose');
var halloffame = {};

mongoose.connect('mongodb://localhost/loginapp');
var db = mongoose.connection;

// var routes = require('./routes/index');
var users = require('./routes/users');
var Trophy = require('./models/trophy');

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
app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
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

//Key Socket.room
// 

// Global Vars
app.use(function (req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});



app.use('/', users);
app.use('/users', users);
app.use(express.static(__dirname + '/mypublic'));
http.listen(80,function(){
  console.log('listening on *:3002');
});



io.on('connection',function(socket){  
  
  console.log("a user connected");
  halloffame = {};
  Trophy.getUserByTrophy(function(err, user){
    if(err) throw err;
    if(user){
              console.log("user"+user[0]);
              for (var i=0;i<user.length;i++){


                console.log(user[i].trophy_id);
              halloffame[user[i].name]=user[i].rank;
            }

              socket.emit('halloffamedata',halloffame);
              
              
            }
    else {        
              console.log("couldnot find halloffame data");

            }
   });
   socket.emit('getclientdata',true);
  socket.on('clientdatarecieve',function(data){
   socket.username = data;
   Trophy.getUserBydbid(socket.username, function(err, user){
    if(err) throw err;
    if(user){
              socket.trophy_no = user.trophies;
            }
    else {        
              console.log("couldnot update trophies");

            }
   });
  allUsers.activeUsers[socket.id] = socket;
  socket.existingUser = false;
  socket.emit('checkCookieExists',socket.username);
  
  socket.on('userExists',function(theUser){
    console.log("the user exists: "+theUser);
    socket.username = theUser;
    var theKey = getKeyOfExistingUser(theUser);
    if(theKey == 404)
      console.log("+++++++++++++++++++++++++++++++++++The game is not been played!");
    else{
      console.log("++a match with same username is found");
      if(getIsMultiplayer(theKey)){

        loadCurrentStatusOfGame(socket,theKey);
        socket.emit('YouCanPlayMultiplayer',true);
      }
      else{
        console.log("+++++++++++++++++++++++++++++++++++The game is not been played!");
      }
    }
  });
  });
  
  
  socket.on('adduser', function(username){
    // we store the username in the socket session for this client
    console.log("in add user!!");
    socket.username = username;
  });
  
  socket.on('gridMakingCompleted',function(){
    var mySocketID = socket.id;
    setTheReplayDictionary(socket.id);
    proceedToGame(socket);
  });
  
  socket.on('iWillPlayGame',function(stat){
    socket.emit('makeGridFirst',true);
    console.log("iWillPlayGame");
  });

  socket.on('Iwanttospectate',function(){
    console.log("------------spectating");
    socket.emit('sending data of clients', finding_opponent()); 
  });
  
  socket.on('sendMeTheGameOfThisID',function(data){
    var isRoom = data;
    console.log("sendMeTheGameOfThisID: "+isRoom);
    
    var specRoom = allGames.activeGames[isRoom].spectatingRoom;
    joinTheRoom(socket,specRoom);
    allGames.activeGames[isRoom].totSpectators++;
  });
  
  socket.on('wantToPlayMultiplayer',function(){
    console.log(socket.id+" wants to play multiplayer");
    create_game(socket.id);
    //
    players[socket.id].multiplayerInfo.mySocket = socket;
    //
    if(checkMultiplayerAvailbility(socket.id) == true){
      console.log("------------Inside wantToPlayMultiplayer");
      roomFormation(socket.id);
      io.to(socket.id).emit('YouCanPlayMultiplayer', true);
      io.to(players[socket.id].multiplayerInfo.opponentID).emit('YouCanPlayMultiplayer', true);
    }
    else{
      allUsers.waitingForBattleUsers[socket.id]=socket;
      allUsers.NoOfmultiplayerUsersInQueue++;
      console.log("No online players currently !!");
    }
  });
  
  socket.on('IwantReplays',function(){
    console.log("clients wants replays");
    socket.emit('sendingDataOfRecentGames',findingRecentGamesPlayed());
  });
  
  socket.on('Clients key status',function(data){
    var myID = socket.id;
    copyTheReceivedControlsIntoDictionary(data,myID);
    keys_stat = data;
    checkkeystatus(socket.id);
  });
  
  socket.on('restartButtonIsPressed',function(){
    restartButton(socket.id);
  });
  
  socket.on('replayButtonIsPressed',function(data){
    var roomID = data;
    if(allGames.noOfGamesPlayed == 0)
      console.log("No games have yet been played!");
    else
      replayButton(socket.id,roomID);
  });
  
  socket.on('disconnect',function(temp){
    console.log('user disconnected');
    if(players[socket.id])
      clearInterval(players[socket.id].mVar);
  });
});

const pieces =['i','j','l','o','s','t','z'];
const randomColors =["#f44336","#4CAF50","#00BCD4","#FFC107","#2196F3","#FF5722"];
const boxShadowproperty = "inset 0px 0px 5px 2px rgba(0,0,0,0.71)";
const defaultBackgroundColor ="rgba(255, 255, 255, 0.4)";
const gridWidth=15;
const gridHeight=24;
const previewGridWidth=4;
const previewGridHeight=4;    
    
var currentReplays ={};
var replayDictionary = {};
var players ={};

var AllTimeReplayData ={};
var replayCountData = {};

var isGameCurrentlyPlayed=0;
var blockProperties = new Array();
var totalRooms = 0;
var allGames={};

var allUsers={
    activeUsers:{},
    currentlyPlayingUsers:{},
    replayWatchingUsers:{},
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

function setTheReplayDictionary(k){
  replayDictionary[k] = {
    allControllersData:{},
    allShapesData:[],
    allColorsData:[],
    allNextShapesData:[],
    allNextColorsData:[]
  };
}

function setCurrentlyWatchingReplayDictionary(k,isRoom,fPlayer,sPlayer)
{
  currentReplays[k] = {
    replayRoom:null,
    firstPlayer:null,
    secondPlayer:null,
    repVar:null,
    replayTimer:null,
    replayRoomTimer:null
  }
}
    
function makeActiveGamesDictionary(RName,RNo,ID1,ID2){
  
  console.log("Inside makeallGames.activeGames!!!!!!");
  var roomName = RName,fstPlayer = ID1,sndPlayer = ID2,roomNumber = RNo;  
  var specRoom = roomName+"spectate";
  allGames.activeGames[roomName] = {
    firstPlayer:fstPlayer,
    secondPlayer:sndPlayer,
    myRoomNo:roomNumber,
    totalPlayers:0,
    gameTimer:null,
    spectatingRoom:specRoom,
    totSpectators:0,
    specTimer:null
  };
}

function storeDataToPastGames(theRoom){
  var tRoom = theRoom;
  allGames.pastGames[tRoom] = {
    firstPlayer:allGames.activeGames[tRoom].firstPlayer,
    secondPlayer:allGames.activeGames[tRoom].secondPlayer,
    firstUsername:players[allGames.activeGames[tRoom].firstPlayer].username,
    secondUsername:players[allGames.activeGames[tRoom].secondPlayer].username,
    myRoomNo:allGames.activeGames[tRoom].myRoomNo,
    totalPlayers:0,
    gameTimer:null
  };
}

function getIsMultiplayer(ky){
  var key =ky;
  return players[key].isMultiplayer;
}

function loadCurrentStatusOfGame(soc,theKey)
{
  var theSoc =soc;
  var isKey = theKey;
  console.log("++++++++++++++++++++++++++++++You left the game in middle");
  console.log("socket.id before assigning = "+theSoc.id);
  theSoc.id = isKey;

  console.log("socket.id after assigning = "+theSoc.id);
  allUsers.activeUsers[theSoc.id] = theSoc;
  theSoc.existingUser = true;   
}

function getKeyOfExistingUser(theUser)
{
  //var theSoc = soc;
  var userNm = theUser;
  var foundout = 404;
  var theSock = 0;
  Object.keys(players).forEach(function (key) {
    console.log("players[key].username = "+players[key].username);
    if(userNm.localeCompare(players[key].username) == 0)
      {
        foundout =key;
        //theSock = players[key].multiplayerInfo.mySocket;
      }
  });
  //if(foundout == 404)
    return foundout;
  //else
    //return theSock;
}

function proceedToGame(soc)
{
  var sockett = soc;
  if(sockett.existingUser == false){
      
    console.log("Inside gridMakingCompleted : The User Does not Exists!")
    players[sockett.id].isMultiplayer = true;
    makingOfGame(sockett.id);
      
    var rName = players[sockett.id].multiplayerInfo.myRoom;
    allGames.activeGames[rName].totalPlayers++;
      
    //if both players ready then start the game
    if(checkIfplayersReady(sockett.id) == true) {
      console.log("--------------I am game starter!!");
      gameStarter(sockett.id);
    }
    else
      console.log("Both players not ready!");
  }
  else{
    console.log("Inside gridMakingCompleted : The User Already Exists!");
  }
  players[sockett.id].mVar = setInterval( function() {
  if (Object.keys(allUsers.activeUsers).indexOf(sockett.id)>-1) 
    {sendTetrisDataToClient(sockett.id);} }, 30 );
}

function gameStarter(k){
  console.log("All players are ready");
  var IID = k;
  var oppo = players[k].multiplayerInfo.opponentID;
  var rName = players[IID].multiplayerInfo.myRoom;
  
  var play1 = allGames.activeGames[rName].firstPlayer;
  var play2 = allGames.activeGames[rName].secondPlayer;
  //console.log("****************the room of gamestarter"+rName);
  allGames.activeGames[rName].gameTimer = setInterval( function() {
  if (Object.keys(allUsers.activeUsers).indexOf(IID)>-1) 
    {singleRoomMoveBox(play1,play2);} }, 500);
    
  allGames.activeGames[rName].specTimer = setInterval( function() {
  if (Object.keys(allUsers.activeUsers).indexOf(IID)>-1) 
    {broadcastGameToSpectators(rName);} }, 30);
  
}

function checkIfplayersReady(k)
{
  var IID = k;
  var rName = players[IID].multiplayerInfo.myRoom;
  if(allGames.activeGames[rName].totalPlayers == 2)
    return true;
    
  return false;
}

function broadcastGameToSpectators(theRoom)
{
  var isRoom = theRoom;
  var spectateRoom = allGames.activeGames[isRoom].spectatingRoom;
  var totMembers = allGames.activeGames[isRoom].totSpectators;
  //console.log("Total members in spectating room"+totMembers);
  if(totMembers>0)
  {
    //console.log("spectateRoom: "+spectateRoom);
    var p1 = allGames.activeGames[isRoom].firstPlayer;
    var p2 = allGames.activeGames[isRoom].secondPlayer;
    
    io.in(spectateRoom).emit('updateTheTetrisDetails',{tetrisBackgroundProperty:players[p1].backgroundPropertyOfAllBlocks,
    tetrisPreviewProperty:players[p1].backgroundPropertyOfNextBlocks,
    CurrentScore:players[p1].Score,
    //timer:players[data].timeSinceStart ,
    OpponentsTetrisBackgroundProperty:players[p2].backgroundPropertyOfAllBlocks});
  }
}

//to store all shapes with their color used in game
function setTheAllShapesUsedInGame(k,theShape,theColor){
  replayDictionary[k].allShapesData.push(theShape);
  replayDictionary[k].allColorsData.push(theColor);
}

//to store all next shapes and their colors used in the game
function setTheAllNextShapesUsedInGame(k,theNextShape,theNextColor){
  replayDictionary[k].allNextShapesData.push(theNextShape);
  replayDictionary[k].allNextColorsData.push(theNextColor);
}

/*function setTheTimer(k){
  players[k].timeElapsed = players[k].timeElapsed+1;
}*/

function joinTheRoom(k,roomName){
  var theID = k;
  var theRoom = roomName;
  theID.join(theRoom);
}

function leaveTheRoom(k){
  var theID = k;
  var theSocket = allUsers.activeUsers[theID];
  var theRoom = players[theID].multiplayerInfo.myRoom;
  theSocket.leave(theRoom);    
}

function sendTetrisDataToClient(k){ 
  //console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
  var opID = players[k].multiplayerInfo.opponentID;
  if(players[opID])
  allUsers.activeUsers[k].emit('updateTheTetrisDetails',{tetrisBackgroundProperty:players[k].backgroundPropertyOfAllBlocks,
  tetrisPreviewProperty:players[k].backgroundPropertyOfNextBlocks ,
  CurrentScore:players[k].Score,
  timer:players[k].timeSinceStart ,
  OpponentsTetrisBackgroundProperty:players[opID].backgroundPropertyOfAllBlocks});
}

function checkMultiplayerAvailbility(){
  if(allUsers.NoOfmultiplayerUsersInQueue == 0)
    return false;
  else 
    return true;
}

function assignOpponentsID(socketId_temp,key){
  var firstID = socketId_temp;
  var secondID = key;
  
  players[firstID].multiplayerInfo.opponentID = secondID;
  players[secondID].multiplayerInfo.opponentID = firstID;   
}

function roomFormation(socketId_temp){
  Object.keys(allUsers.waitingForBattleUsers).forEach(function (key) { 
      
      //console.log("key:  "+key);
      
      assignOpponentsID(socketId_temp,key);
      
      allUsers.NoOfmultiplayerUsersInQueue--;
      delete allUsers.waitingForBattleUsers[key];
      
      totalRooms++;
      var mySoc = allUsers.activeUsers[socketId_temp];
      var roomName = "Room"+totalRooms;
      console.log("roomName: "+roomName);
      var opponentsID = players[socketId_temp].multiplayerInfo.opponentID;
      var opponentsSocket = allUsers.activeUsers[opponentsID];
      
      players[socketId_temp].multiplayerInfo.myRoom = roomName;
      players[opponentsID].multiplayerInfo.myRoom = roomName;
      players[socketId_temp].multiplayerInfo.myRoomNo = totalRooms;
      players[key].multiplayerInfo.myRoomNo = totalRooms;
      
      //console.log("Inside roomFormation-------"+players[opponentsID].multiplayerInfo.myRoom+"----"+players[socketId_temp].multiplayerInfo.myRoom);
      makeActiveGamesDictionary(roomName,totalRooms,socketId_temp,opponentsID);
      
      players[key].multiplayerInfo.isFirstPlayer = true;      
      
      joinTheRoom(mySoc,roomName);
      joinTheRoom(opponentsSocket,roomName);    
  });
}

//had to modify this function
function finding_opponent(){
  var items = Object.keys(allGames.activeGames).map(function(key) {
    console.log("finding_opponent: "+key+" , "+players[allGames.activeGames[key].firstPlayer].multiplayerInfo.myRoom);
    return [allGames.activeGames[key].firstPlayer, 
    allGames.activeGames[key].secondPlayer,
    players[allGames.activeGames[key].firstPlayer].username,
    players[allGames.activeGames[key].secondPlayer].username,
    key];//.sort();
  });
  return items;//.sort();
}

function findingRecentGamesPlayed(){
  var items = Object.keys(allGames.pastGames).map(function(key) {
    return [allGames.pastGames[key].firstPlayer, 
    allGames.pastGames[key].secondPlayer,
    allGames.pastGames[key].firstUsername,
    allGames.pastGames[key].secondUsername,
    key];//.sort();
  });
  return items;//.sort();
}


function checkkeystatus(k){
  if (keys_stat['rotateButton']==true)
    rotateButton(k); 
  if (keys_stat['leftButton']==true)
    leftButton(k);
  if (keys_stat['rightButton']==true)
    rightButton(k);
  if(players[k].previousDropClick != keys_stat['dropButton']){
    if (keys_stat['dropButton'] ==true)
      dropButtonPressed(k);
    if (keys_stat['dropButton'] ==false)
      dropButtonReleased(k);
    players[k].previousDropClick = keys_stat['dropButton'];
  }
}

function setTheControllersOfreplayGame(k){
  keys_stat = replayDictionary[k].allControllersData[players[k].countOfDataSend];
  checkkeystatus(k);
  players[k].countOfDataSend++;
}

function copyTheReceivedControlsIntoDictionary(data,kID){
    //console.log("+++++++++++++++++++++++++++++Inside copyTheReceivedControlsIntoDictionary");
    
    replayDictionary[kID].allControllersData[players[kID].countOfDataSend]={
      stopButton:false,
      dropButton:false,
      rotateButton:false,
      rightButton:false,
      leftButton:false
    }
    
    Object.keys(data).forEach(function(key) {
      replayDictionary[kID].allControllersData[players[kID].countOfDataSend][key] = data[key];
      /*if(replayDictionary[kID].allControllersData[players[kID].countOfDataSend][key] ==  true)
        console.log("key = : "+key+" : "+replayDictionary[kID].allControllersData[players[kID].countOfDataSend][key]);
      console.log("data : "+key+" : "+data[key]);*/
    }); 
    
    //console.log("*****************************players[kID].countOfDataSend"+players[kID].countOfDataSend);
    players[kID].countOfDataSend++;
  }

function create_game(k){
  players[k]={  
    multiplayerInfo:{
      mySocket:null,
      opponentID:null,
      myRoom:null,
      myRoomNo:null,
      isFirstPlayer:false
    },
    xPos:null,
    myVar:null,
    lastPos:null,
    yPos:null,
    rightMostX:null,
    rightMostY:null,
    leftMostX:null,
    leftMostY:null,
    bottomMostX:null,
    bottomMostY:null,
    pressed:false,
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
    anyColor :"#f44336",
    occupiedPropertiesOfAllBlocks :[],
    backgroundPropertyOfAllBlocks :[],
    backgroundPropertyOfNextBlocks:[],
    cacheShapeStage:null,
    timeSinceStart: 0,
    currentSpeed:null,
    username:allUsers.activeUsers[k].username,
    isMultiplayer:false,
    timeElapsed:0,
    timeVar:null,
    dropTimerVar:null,
    countOfDataSend:0,
    previousDropClick:false,
    replayMode:false,
    shapesCount:0,
    trophy_no:allUsers.activeUsers[k].trophy_no
  };
}

  function setOccupyPropertyOfBlocks(k){
    for(var i=0 ;i<gridHeight ;i++)
    {
      var data = [];
      for(var j=0;j<gridWidth;j++){
        data.push(0);
      }
      players[k].occupiedPropertiesOfAllBlocks.push(data);
    }
  }
  
  function setBackgroundPropertyOfBlocks(k){
    for(var i=0 ;i<gridHeight ;i++)
    {
      var data2 = [];
      for(var j=0;j<gridWidth;j++){
        data2.push(defaultBackgroundColor);
      }
      players[k].backgroundPropertyOfAllBlocks.push(data2);
    }
  }
  
  function setBackgroundPropertyOfNextBlocks(k){
    for(var i=0 ;i<previewGridHeight ;i++)
    {
      var data2 = [];
      for(var j=0;j<previewGridWidth;j++){
        data2.push(defaultBackgroundColor);
      }
      players[k].backgroundPropertyOfNextBlocks.push(data2);
    }
  }
  
  function resetGame(k){
    
    for(var i=0 ;i<gridHeight ;i++){
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
    
    players[k].Score  = 0;
    players[k].currentSpeed = 500;
    players[k].timeSinceStart = 0;
    clearTheInterval(players[k].myVar);
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
    switch(players[k].nextPiece)
    {
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
    //selects random block
    randomPiece(k);
    randomColorGenerator(k);
    players[k].shapesCount++;
  }
  
  //function to generate random color
  function randomColorGenerator(k){
    if(players[k].replayMode == false){
      //random color generator
      var any = Math.floor((Math.random()*(randomColors.length-1))+0);
      players[k].nextColor = randomColors[any];
    }
    else{
      players[k].nextColor = replayDictionary[k].allNextColorsData[players[k].shapesCount];
    }
  }
  
  //players[k] function selects random character from array
  function randomPiece(k){
    if(players[k].replayMode == false){
      var any = Math.floor((Math.random()*(pieces.length-1))+0);
      players[k].nextPiece = pieces[any];
    }
    else{
      players[k].nextPiece = replayDictionary[k].allNextShapesData[players[k].shapesCount];
    } 
  }
  
  //checks whether a block is occupied or not
  function isOccupied(x,y,k){
    if(x<0 || x>=gridHeight || y<0 || y>=gridWidth){
      return true;
    }
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
  
  //sets the property of a all blocks of current shape
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
    switch(players[k].shapeType)
    {
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
    switch(players[k].shapeType)
    {
      case 'i':   
            players[k].rightMostX = players[k].shapePos[3][0];
            players[k].rightMostY = players[k].shapePos[3][1];
          
            players[k].leftMostX = players[k].shapePos[0][0];
            players[k].leftMostY = players[k].shapePos[0][1];
                    
            players[k].bottomMostX = players[k].shapePos[3][0];
            players[k].bottomMostY = players[k].shapePos[3][1];
            break;
            
      case 'j': 
            if(players[k].shapeStage == 0)
            {
              players[k].rightMostX = players[k].shapePos[2][0];
              players[k].rightMostY = players[k].shapePos[2][1];
              
              players[k].leftMostX = players[k].shapePos[3][0];
              players[k].leftMostY = players[k].shapePos[3][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1)
              {
                players[k].rightMostX = players[k].shapePos[3][0];
                players[k].rightMostY = players[k].shapePos[3][1];
              
                players[k].leftMostX = players[k].shapePos[0][0];
                players[k].leftMostY = players[k].shapePos[0][1];
                        
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2)
                {
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
                
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                          
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3)
                  {
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                  
                    players[k].leftMostX = players[k].shapePos[0][0];
                    players[k].leftMostY = players[k].shapePos[0][1];
                            
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
      
      case 'l': if(players[k].shapeStage == 0)
            {
              players[k].rightMostX = players[k].shapePos[3][0];
              players[k].rightMostY = players[k].shapePos[3][1];
            
              players[k].leftMostX = players[k].shapePos[2][0];
              players[k].leftMostY = players[k].shapePos[2][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1)
              {
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[0][0];
                players[k].leftMostY = players[k].shapePos[0][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2)
                {
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
              
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                        
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
              players[k].rightMostX = players[k].shapePos[1][0];
              players[k].rightMostY = players[k].shapePos[1][1];
          
              players[k].leftMostX = players[k].shapePos[2][0];
              players[k].leftMostY = players[k].shapePos[2][1];
                    
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1)
              {
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[1][0];
                players[k].leftMostY = players[k].shapePos[1][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2)
                {
                  players[k].rightMostX = players[k].shapePos[1][0];
                  players[k].rightMostY = players[k].shapePos[1][1];
              
                  players[k].leftMostX = players[k].shapePos[2][0];
                  players[k].leftMostY = players[k].shapePos[2][1];
                        
                  players[k].bottomMostX = players[k].shapePos[3][0];
                  players[k].bottomMostY = players[k].shapePos[3][1];
                }
                else if(players[k].shapeStage == 3)
                  {
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
      
      case 't':
            if(players[k].shapeStage == 0)
            {
              players[k].rightMostX = players[k].shapePos[2][0];
              players[k].rightMostY = players[k].shapePos[2][1];
            
              players[k].leftMostX = players[k].shapePos[0][0];
              players[k].leftMostY = players[k].shapePos[0][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1)
              {
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
                players[k].leftMostX =  players[k].shapePos[0][0];
                players[k].leftMostY =  players[k].shapePos[0][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
            else if(players[k].shapeStage == 2)
                {
                  players[k].rightMostX = players[k].shapePos[3][0];
                  players[k].rightMostY = players[k].shapePos[3][1];
              
                  players[k].leftMostX = players[k].shapePos[1][0];
                  players[k].leftMostY = players[k].shapePos[1][1];
                        
                  players[k].bottomMostX = players[k].shapePos[2][0];
                  players[k].bottomMostY = players[k].shapePos[2][1];
                }
                else if(players[k].shapeStage == 3)
                  {
                    players[k].rightMostX = players[k].shapePos[2][0];
                    players[k].rightMostY = players[k].shapePos[2][1];
                
                    players[k].leftMostX = players[k].shapePos[1][0];
                    players[k].leftMostY = players[k].shapePos[1][1];
                          
                    players[k].bottomMostX = players[k].shapePos[3][0];
                    players[k].bottomMostY = players[k].shapePos[3][1];
                  }
            break;
            
      case 'z':
            if(players[k].shapeStage == 0)
            {
              players[k].rightMostX = players[k].shapePos[3][0];
              players[k].rightMostY = players[k].shapePos[3][1];
            
              players[k].leftMostX = players[k].shapePos[0][0];
              players[k].leftMostY = players[k].shapePos[0][1];
                      
              players[k].bottomMostX = players[k].shapePos[3][0];
              players[k].bottomMostY = players[k].shapePos[3][1];
            }
            else if(players[k].shapeStage == 1)
              {
                players[k].rightMostX = players[k].shapePos[2][0];
                players[k].rightMostY = players[k].shapePos[2][1];
            
                players[k].leftMostX = players[k].shapePos[1][0];
                players[k].leftMostY = players[k].shapePos[1][1];
                      
                players[k].bottomMostX = players[k].shapePos[3][0];
                players[k].bottomMostY = players[k].shapePos[3][1];
              }
              else if(players[k].shapeStage == 2)
                {
                  players[k].rightMostX = players[k].shapePos[3][0];
                  players[k].rightMostY = players[k].shapePos[3][1];
              
                  players[k].leftMostX = players[k].shapePos[0][0];
                  players[k].leftMostY = players[k].shapePos[0][1];
                        
                  players[k].bottomMostX = players[k].shapePos[2][0];
                  players[k].bottomMostY = players[k].shapePos[2][1];
                }
                else if(players[k].shapeStage == 3)
                  {
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
    switch(players[k].shapeType)
    {
      case 'i':
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                { 
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
                else if(players[k].shapeStage == 3)
                  {
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
  
  //to check if any row is completed
  //if a row is completed erase row and transfer it to other opponent
  function checkRowCompletion(k){
    var simultaneousRowsCompleted = 0;
    //console.log("====================================  "+players[k].bottomMostX);
    for(var i=0;i<=players[k].bottomMostX;i++)
    {
      //console.log("====================================  "+gridWidth);
      for(var j=0;j<gridWidth;j++)
      {
        if(isOccupied(i,j,k) == false)
          break;
      }
      if(j == gridWidth)
      {
        var tempData = [];
        for(var z=0; z<gridWidth ;z++) 
        {
          tempData.push(players[k].backgroundPropertyOfAllBlocks[i][z]);
        }
        addCompletedRowToOpponents(tempData,k);
        simultaneousRowsCompleted++;
        eraseRow(i,k);
        dropTetris(i,k);
        //calculateScore(k,simultaneousRowsCompleted,0);      
      }
    }
  }
  
  //erases the completed row
  function eraseRow(x,k){
    for(var z=0;z<gridWidth;z++)
    {
      updateOccupyPropertyOfBlocks(x,z,0,k);
      updateBackgroundPropertyOfBlocks(x,z,defaultBackgroundColor,k);
    }
  }
  
  //drops the rest of tetris just above the completed row 
  function dropTetris(z,k){
    for(var y=0;y<gridWidth;y++)
    {
      for(var l=z-1;l>=0;l--)
      {
        var temp = l+1;
        updateOccupyPropertyOfBlocks(temp,y,players[k].occupiedPropertiesOfAllBlocks[l][y],k);
        updateBackgroundPropertyOfBlocks(temp,y,players[k].backgroundPropertyOfAllBlocks[l][y],k);
      }
    }
  }
  
  function addCompletedRowToOpponents(tempData,k){
    var oppo = players[k].multiplayerInfo.opponentID;
    for(var i=1; i<gridHeight ;i++)
    {
      for(var j=0;j<gridWidth ;j++)
      {
        players[oppo].occupiedPropertiesOfAllBlocks[i-1][j] = players[oppo].occupiedPropertiesOfAllBlocks[i][j];
        players[oppo].backgroundPropertyOfAllBlocks[i-1][j] = players[oppo].backgroundPropertyOfAllBlocks[i][j];  
      }
    }
    moveShapeUp(oppo);
    var tt = gridHeight-1;
    
    for(var i=0;i<gridWidth ;i++)
    {
      players[oppo].occupiedPropertiesOfAllBlocks[tt][i] = 1;
      players[oppo].backgroundPropertyOfAllBlocks[tt][i] = tempData[i];
    }
  }
  
  function checkConditionToAddRowToOpponents(completedRows,k){
    //console.log("---------------------checkConditionToAddRowToOpponents(completedRows,k): "+completedRows);
    var lth = completedRows.length;
    
    for(var i=0; i<players[k].gridWidth; i++)
    {
      for(var j=0;j<lth;j++)
      {
        if(isOccupied(i,j,k) == true)
          return false;
      }
    }
    return true;
  }
  
  //calculates players[k].Score 
  /*function calculateScore(k,cRCompleted,typeOfScoring){
    var consecuentRows = cRCompleted;
    
    switch(typeOfScoring)
    {
      case 0:
          //all rows completed
          players[k].Score = players[k].Score +(1000*consecuentRows);
          break;
          
      case 1:
          //on rotation
          players[k].Score +=10;
          break;
      
      case 2: //on drop
          players[k].Score +=10;
          break;    
    } 
  }*/
  
  function moveShapeUp(k){
    players[k].shapePos[0][0]--;
    players[k].shapePos[1][0]--;
    players[k].shapePos[2][0]--;
    players[k].shapePos[3][0]--;
    
    if(players[k].shapePos[0][0] < 0 || players[k].shapePos[1][0] < 0 || players[k].shapePos[2][0] < 0 || players[k].shapePos[3][0] < 0)
    {
      console.log("The piece location is getting out of tetris");
      gameOver(k);
    }
    //console.log("-------------------------Move shape up"+players[k].shapePos[0][0]+ players[k].shapePos[1][0]+players[k].shapePos[2][0] +players[k].shapePos[3][0]);
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
    switch(players[k].shapeType)
    {
      case 'i':
            if(players[k].shapeStage == 0 || players[k].shapeStage == 2)
            {
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
            }
            else if(players[k].shapeStage == 1 || players[k].shapeStage == 3)
            {
              var x1=players[k].bottomMostX+1;
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[3][1]]== 1)
                return true;
              else
                return false;
            }
            break;
      
      case 'j':
            if(players[k].shapeStage == 0)
            {
              var x1=players[k].shapePos[2][0]+1;
              var x2=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
                var x1= players[k].shapePos[1][0]+1;
                var x2= players[k].shapePos[2][0]+1;
                var x3= players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var x1= players[k].shapePos[3][0]+1;
                  var x2= players[k].shapePos[1][0]+1
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[3][1]]==1
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[1][1]]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
              var x1=players[k].shapePos[2][0]+1;
              var x2=players[k].shapePos[3][0]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[2][1]]==1 
              || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
                var x1= players[k].shapePos[1][0]+1;
                var x2= players[k].shapePos[2][0]+1;
                var x3= players[k].shapePos[3][0]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[1][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[2][1]]==1 
                || players[k].occupiedPropertiesOfAllBlocks[x3][players[k].shapePos[3][1]]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
                  var x1= players[k].shapePos[0][0]+1;
                  var x2= players[k].shapePos[3][0]+1;
                  
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[x1][players[k].shapePos[0][1]]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[x2][players[k].shapePos[3][1]]==1)
                    return true;
                  else
                    return false;
                }
                else if(players[k].shapeStage == 3)
                {
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
    //console.log("Inside move box!!: "+id);
    //gameOver condition has to be fixed as 
    //its not accurate condition for game over
    if( (players[id].bottomMostX == 1 || players[id].bottomMostX == 0) && checkOccupiedBlock(id) == true){
      gameOver(id);
    }
    else if(players[id].bottomMostX == gridHeight-1 || (checkOccupiedBlock(id)) ==  true){
        selectNextPiece(id);
        
        //for storing the shape data
        if(players[id].replayMode == false){
          //console.log("inside move box players[id].replayMode == false");
          setTheAllShapesUsedInGame(id,players[id].shapeType,players[id].anyColor);
        }
        eraseNextShape(id);
        randomBlockGenerator(id);
        
        //for storing the next shape data
        if(players[id].replayMode == false){
          //console.log("inside move box players[id].replayMode == false");
          setTheAllNextShapesUsedInGame(id,players[id].nextPiece,players[id].nextColor);
        }
        checkRowCompletion(id);
        moveShapeToInitialPos(id);
        moveNextShapeToInitialPos(id);
        colorNextShape(id);
      }
      
      else if((checkOccupiedBlock(id)) ==  false){
          makeBlockUnoccupied(id);
          eraseShape(id);
          moveShapeDown(id);
          makeBlockOccupied(id);
          colorTheShape(id);
         }
  }
  
  //controls the shape right movement
  function checkRightMovement(k){
    switch(players[k].shapeType)
    {
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
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][1]][y2]==1)
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            else if(players[k].shapeStage == 1)
              {
                var y1= players[k].shapePos[2][1]+1;
                var y2= players[k].shapePos[3][1]+1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
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
                else if(players[k].shapeStage == 3)
                {
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
            if(players[k].shapeStage == 0 || players[k].shapeStage == 1 || players[k].shapeStage == 2 || players[k].shapeStage == 3)
            {
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
            if(players[k].shapeStage == 0)
            {
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
              else if(players[k].shapeStage == 2)
                {
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
            
      case 't':   
            if(players[k].shapeStage == 0)
            {
              var y1=players[k].shapePos[2][1]+1;
              var y2=players[k].shapePos[3][1]+1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                {
                  var y1 = players[k].shapePos[0][1]+1;
                  var y2 = players[k].shapePos[3][1]+1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
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
      
      case 'z': 
            if(players[k].shapeStage == 0)
            {
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
              else if(players[k].shapeStage == 2)
                {
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
    
    switch(players[k].shapeType)
    {
      case 'i':
            if(players[k].shapeStage == 0 || players[k].shapeStage == 2)
            {
              var y1=players[k].shapePos[0][1]-1;
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]== 1)
                return true;
              else
                return false;
            }
            else if(players[k].shapeStage == 1 || players[k].shapeStage == 3)
              {
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
            if(players[k].shapeStage == 0)
            {
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
            else if(players[k].shapeStage == 1)
              {
                var y1= players[k].shapePos[0][1]-1;
                var y2= players[k].shapePos[1][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][1]][y2]==1)
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
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
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
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
            else if(players[k].shapeStage == 1)
              {
                var y1= players[k].shapePos[0][1]-1;
                var y2= players[k].shapePos[3][1]-1;
                
                if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y1]==1 
                || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
                  return true;
                else
                  return false;
              }
              else if(players[k].shapeStage == 2)
                {
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
                else if(players[k].shapeStage == 3)
                {
                  var y1= players[k].shapePos[0][1]-1;
                  var y2= players[k].shapePos[1][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1 )
                    return true;
                  else
                    return false;
                }
            break;
      
      case 'o': 
            if(players[k].shapeStage == 0 || players[k].shapeStage == 1 || players[k].shapeStage == 2 || players[k].shapeStage == 3)
            {
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
            if(players[k].shapeStage == 0)
            {
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[2][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                {
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[2][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1 )
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[3][1]-1;
                
              if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[3][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                {
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[1][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[1][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
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
            if(players[k].shapeStage == 0)
            {
              var y1=players[k].shapePos[0][1]-1;
              var y2=players[k].shapePos[2][1]-1;
                                                                                            if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
              || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                return true;
              else 
                return false;
            }
            else if(players[k].shapeStage == 1)
              {
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
              else if(players[k].shapeStage == 2)
                {
                  var y1 = players[k].shapePos[0][1]-1;
                  var y2 = players[k].shapePos[2][1]-1;
                  
                  if(players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[0][0]][y1]==1 
                  || players[k].occupiedPropertiesOfAllBlocks[players[k].shapePos[2][0]][y2]==1)
                    return true;
                  else 
                    return false;
                }
                else if(players[k].shapeStage == 3)
                  {
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
    if(players[k].rightMostY == gridWidth-1)
    {
      ;//alert("No more room for moving right!");
    }
    else if(checkRightMovement(k) == true)
      {
        ;//console.log("checkRightMovement() == true");
      }
      else
      {
        makeBlockUnoccupied(k);
        eraseShape(k);
        moveTheShapeToRight(k);
        colorTheShape(k);
        makeBlockOccupied(k);
      }
  }
  
  //controls the shape left movement
  function leftButton(k){
    if(players[k].leftMostY == 0)
    {
      ;//alert("No more room for moving left!");
    }
    else if(checkLeftMovement(k) ==  true)
      {
        ;
      }
      else
      {
        makeBlockUnoccupied(k);
        eraseShape(k);
        moveTheShapeToLeft(k);
        colorTheShape(k);
        makeBlockOccupied(k);
      }
  }
  
  //function of drop button when players[k].pressed
  function dropButtonPressed(k){
    var id =k;
    //console.log("drop button pressed!");
    players[id].dropTimerVar = setInterval( function() 
    {if (Object.keys(allUsers.activeUsers).indexOf(id)>-1) moveBox(id); }, 50);
  }
  
  //function of drop button when released
  function dropButtonReleased(k){
    var idd = k;
    //console.log("dropButtonReleased");
    clearInterval(players[idd].dropTimerVar);
  }
  
  //stops the tetris
  function stopButton(k){
    //players[k].isStopped=1;
    clearInterval(players[k].mVar);
    //clearTheInterval(players[k].timeVar);
  }
  
  function stopTheGameTimer(rmName)
  {
    var rName = rmName;
    var timeVar = allGames.activeGames[rName].gameTimer;
    //console.log("---------------------the room of stopTheGameTimer: "+rName);
    clearInterval(allGames.activeGames[rName].gameTimer);
    clearInterval(allGames.activeGames[rName].specTimer);
    
  }
  
  //rotates the current shape to next rotation stage
  function rotateButton(k){
    storeCurrentPos(k);
    makeBlockUnoccupied(k);
    players[k].shapeStage = (players[k].shapeStage+1)%4;
        
    moveShapeToNextRotationStage(k);
        
    if(isRotationValid(k) == true)
    {
      updateOccupyPropertyOfBlocks(players[k].cachePos[0][0],players[k].cachePos[0][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[1][0],players[k].cachePos[1][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[2][0],players[k].cachePos[2][1],0,k);
      updateOccupyPropertyOfBlocks(players[k].cachePos[3][0],players[k].cachePos[3][1],0,k);
          
      updateBackgroundPropertyOfBlocks(players[k].cachePos[0][0],players[k].cachePos[0][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[1][0],players[k].cachePos[1][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[2][0],players[k].cachePos[2][1],defaultBackgroundColor,k);
      updateBackgroundPropertyOfBlocks(players[k].cachePos[3][0],players[k].cachePos[3][1],defaultBackgroundColor,k);
          
      colorTheShape(k);
      makeBlockOccupied(k);
    } 
    else 
    {
      rollBack(k);
      makeBlockOccupied(k);
    }
  }
  
  //if is rotation is valid then apply rotation
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
  
  //function to restart game 
  function restartButton(k) {
    resetGame(k);
  }

  function sendTetrisDataToReplayClient(k,firstPlayer,secondPlayer){  
    //sending replay game to the client
    var p1 = firstPlayer,
    p2 = secondPlayer;
    allUsers.activeUsers[k].emit('updateTheTetrisDetails',{tetrisBackgroundProperty:players[p1].backgroundPropertyOfAllBlocks,
    tetrisPreviewProperty:players[p1].backgroundPropertyOfNextBlocks ,
    CurrentScore:players[p1].Score,//timer:players[k].timeSinceStart ,
    OpponentsTetrisBackgroundProperty:players[p2].backgroundPropertyOfAllBlocks});
  }
          
  function createMultiPlayerInfoForReplay(k1,k2,rName)  
  {
    var id1 = k1;
    var id2 = k2;
    var theRoom = rName;
    
    //for first
    players[id1].multiplayerInfo.opponentID = id2;
    players[id1].myRoom = theRoom;
    players[id1].isFirstPlayer = true;
    
    //for second
    players[id2].multiplayerInfo.opponentID = id1;
    players[id2].myRoom = theRoom;
    players[id2].isFirstPlayer = true;
  }
  
  function replayButton(k,roomID){
    var theRoom = roomID;
    //in process
    console.log("replayButton! ");
      var firstPlayer,secondPlayer;
      var theRoom;
      var availableReplay =0;
      Object.keys(allGames.pastGames).forEach(function (key){
        if(theRoom.localeCompare(key) == 0)
        {
          availableReplay = 1;
          firstPlayer = allGames.pastGames[key].firstPlayer;
          secondPlayer = allGames.pastGames[key].secondPlayer;
          theRoom = key;
        }
      });
      if(availableReplay == 1)
      {
        console.log("Inside replay button else part: "+firstPlayer+", "+secondPlayer);
      
        create_game(firstPlayer);
        create_game(secondPlayer);
        
        setCurrentlyWatchingReplayDictionary(k,theRoom,firstPlayer,secondPlayer);
        
        createMultiPlayerInfoForReplay(firstPlayer,secondPlayer,theRoom);
        
        //assignOpponentsID(firstPlayer,secondPlayer);
        
        players[firstPlayer].replayMode = true;
        players[secondPlayer].replayMode = true;
        
        makingOfGame(firstPlayer);
        makingOfGame(secondPlayer);
        
        currentReplays[k].replayRoomTimer = setInterval( function() 
        {if (Object.keys(allUsers.activeUsers).indexOf(k)>-1) 
        {singleRoomMoveBox(firstPlayer,secondPlayer); } }, 500);
        
        currentReplays[k].replayTimer = setInterval( function() 
        {if (Object.keys(allUsers.activeUsers).indexOf(k)>-1) 
        {replayTimer(k,firstPlayer,secondPlayer);} }, 100);
        
        currentReplays[k].repVar = setInterval( function() 
        {if (Object.keys(allUsers.activeUsers).indexOf(k)>-1) 
        {sendTetrisDataToReplayClient(k,firstPlayer,secondPlayer);} }, 30 );
        
        currentReplays[k].replayRoomTimer
        currentReplays[k].replayTimer
        currentReplays[k].repVar
      }
      else
        console.log("Some Problem occured while comparing roomName in replay dictionary!");
  }
  
  function replayTimer(k,fPlayer,sPlayer){
    setTheControllersOfreplayGame(fPlayer);
    setTheControllersOfreplayGame(sPlayer);
  }
  
  function clearTheInterval(Inter){
    clearInterval(Inter);
  }
  
  function clearAllIntervals(theRoom,p1,p2)
  {
    var isRoom = theRoom;
    var play1 = p1;
    var play2 = p2;
    clearInterval(players[play1].dropTimerVar);
    clearInterval(players[play2].dropTimerVar);
    stopTheGameTimer(isRoom);
    clearInterval(players[play1].mVar);
    clearInterval(players[play2].mVar);
  }

  function rank_decider(user,rating){
    var level_no =  ((rating+100)/300)-2;
    level_no = parseInt(level_no);
    switch(level_no)
    {
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
  function gameOver(k){
    
    var theID = k;
    console.log("game is over: "+theID);
    if(players[theID].replayMode == false){

      // my code starts
    var theSocket = allUsers.activeUsers[theID];
    var theOpponent = players[theID].multiplayerInfo.opponentID;
    theOpponentSocket = allUsers.activeUsers[theOpponent];
    console.log("winner_rating"+winner_rating);
    console.log("looser_deduction"+looser_deduction);
    var winner_rating = elo.newRatingIfWon(parseInt(players[theID].trophy_no), parseInt(players[theOpponent].trophy_no));
    var looser_deduction = parseInt(theOpponentSocket.trophy_no)-winner_rating+parseInt(theSocket.trophy_no);
    console.log(theSocket.trophy_no+"idddddd");
    console.log(theOpponentSocket.trophy_no+"opponentID");
    console.log("winner_rating"+winner_rating);
    console.log("looser_deduction"+looser_deduction);
    theSocket.trophy_no = winner_rating;
    theOpponentSocket.trophy_no = looser_deduction;
    players[theID].trophy_no = winner_rating;
    players[theOpponent].trophy_no = looser_deduction;
    if (winner_rating<800)winner_rating = 800;
    Trophy.getUserBydbid(players[theID].username, function(err, user){
    if(err) throw err;
    if(user){
              console.log("winner_rating"+winner_rating);
              user.trophies = winner_rating;
              rank_decider(user,winner_rating);
              user.save();
            }
    else {        
              console.log("couldnot update trophies");

            }
   });
  if (looser_deduction<800)looser_deduction = 800;
    Trophy.getUserBydbid(players[theOpponent].username, function(err, user){
    if(err) throw err;
    if(user){
              console.log("looser_deduction"+looser_deduction);
              user.trophies = looser_deduction;
              rank_decider(user,looser_deduction);
              user.save();
            }
    else {        
              console.log("couldnot update trophies");

            }

  
   });
    // my code ends
      
      allGames.noOfGamesPlayed++;
      var theOpponent = players[theID].multiplayerInfo.opponentID;
      var theRoom = players[theID].multiplayerInfo.myRoom;
      players[theID].isMultiplayer =false;
      players[theOpponent].isMultiplayer =false;
      
      storeDataToPastGames(theRoom);
      clearAllIntervals(theRoom,theID,theOpponent);
      
      allUsers.activeUsers[theID].emit('theGameIsOver',true);
      allUsers.activeUsers[theOpponent].emit('theGameIsOver',true);
      
      leaveTheRoom(theID);
      leaveTheRoom(theOpponent);
      
      delete allGames.activeGames[theRoom];
      
      // delete players[theID];
      // delete players[theOpponent];
    }
    else{
      console.log("gameover of replay game");
      clearInterval(currentReplays[k].replayRoomTimer);
      clearInterval(currentReplays[k].replayTimer);
      clearInterval(currentReplays[k].repVar);
    }
  }
  
  /*function increaseDifficulty(k){
    if(players[k].currentSpeed>50 && (players[k].timeSinceStart%30000) == 0 && players[k].timeSinceStart>0)
    {
      players[k].currentSpeed = players[k].currentSpeed-50;
      //setTimer(players[k].currentSpeed,k);
    }
    players[k].timeSinceStart++;
  }*/
  
  function singleRoomMoveBox(k1,k2){
    var thek1 = k1;
    var thek2 = k2;
    //console.log("------inside singleRoomMoveBox"+thek1+" , "+thek2);
    moveBox(thek1);
    moveBox(thek2);
  }
  
  function makingOfGame(k){
      setOccupyPropertyOfBlocks(k);
      setBackgroundPropertyOfBlocks(k);
      setBackgroundPropertyOfNextBlocks(k);
      
      randomBlockGenerator(k);
      //if the actual game is being played not the replay 
      if(players[k].replayMode == false)
      {
        setTheAllNextShapesUsedInGame(k,players[k].nextPiece,players[k].nextColor);
      }
      
      selectNextPiece(k);
      
      if(players[k].replayMode == false)
      {
        setTheAllShapesUsedInGame(k,players[k].shapeType,players[k].anyColor);
      }
      
      moveShapeToInitialPos(k);
      randomBlockGenerator(k);
      
      if(players[k].replayMode == false)
      {
        setTheAllNextShapesUsedInGame(k,players[k].nextPiece,players[k].nextColor);
      }
      
      moveNextShapeToInitialPos(k);
      colorNextShape(k);
  }