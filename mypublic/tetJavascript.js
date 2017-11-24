	socket.on("Connected",function(){
		var user = getCookie("idOfUser");
		user = jQuery.parseJSON(user);
		socket.emit('clientUser_id',user);
	});
	
	socket.on('disconnect', function () {
		clearTimeout(netSpeedBlinker);
		clearTimeout(connectionReset);
		//alertify.alert('Server disconnected! Check your net connection');
	});
	
	socket.on('checkUserExists',function(data){
		var id =data;
		var user = getCookie("idOfUser");
		user = jQuery.parseJSON(user);
		if (user.db_id == id){
			socket.emit('userExists',user.db_id);
		}
		else{
			console.log("-----user dosn't exists");
		}
	});
	
	socket.on('setUserDetails',function(data){
		nameOfUser = data.username;
		troph = data.trophies;
		
		document.getElementById("nameOfUser").innerHTML = nameOfUser;
		document.getElementById("trophiesOfUser").innerHTML = troph;
	});
	
	socket.on('halloffamedata',function(data){
		halloffame = data;
		
		var list = document.getElementsByClassName("splash");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="none";
		}
		
		var list1 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list1.length; i++) {
			list1[i].style.display="none";
		}
		
		var list2 = document.getElementsByClassName("splash-wrapper");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="none";
		}
		
		document.getElementById("hall_of_fame").style.display = "block";
		//halloffame.length
		for(var i=0;i<20;i++){
			var ulli = document.createElement('ul');
			var b1=document.createElement('li');
			
			b1.id=i+"hall";
			
			var div_temp1 = document.createElement('div');
			div_temp1.setAttribute("class", "p1-trophies");
			
			var pTag1 = document.createElement('p');	
			
			var div_temp2 = document.createElement('div');
			div_temp2.setAttribute("class","count2");
			
			var image_temp = document.createElement("img");
			image_temp.setAttribute("src","../trophy.png");	
			
			var pTag2 = document.createElement('p');				
			
			pTag1.innerHTML = halloffame[i].name;
			pTag2.innerHTML = halloffame[i].trophies;
			
			//under count
			div_temp2.appendChild(image_temp);
			div_temp2.appendChild(pTag2);
			
			//under p1-trophies
			div_temp1.appendChild(pTag1);
			
			//under li
			b1.appendChild(div_temp1);
			b1.appendChild(div_temp2);
			
			//under ul
			ulli.appendChild(b1);
			document.getElementById("hallOfFameSpace").appendChild(ulli);	
		}
	});
	
	socket.on('YouCanPlayMultiplayer',function(temp){
		//to prevent the screen to show when no opponents are found
		clearTimeout(oppSearchTimeoutVar);
		document.getElementById("noOpponentsFound").style.display = "none";
		YouCanPlayMultiplayer = true;
	
		//to stop mainscreen sound
		mainScreenSound.pause();
		mainScreenSound.currentTime = 0;
		
		//to stop searching opponent sound
		searchOpp.pause();
		searchOpp.currentTime=0;
		
		//game play sound start here
		gamePlaySound.addEventListener('ended', function() {
			this.currentTime = 0.5;
			this.play();
		}, false);
		gamePlaySound.play();
		
		var data = temp;
		oppNameOfUser = data.oppName;
		oppTroph = data.oppoTrophy;
		
		var list2 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="none";
		}
		
		document.getElementById("opponentSearch").style.display = "none";
		
		canPlayMultiplayer = true;
		multiPlayer(false);
		letTheGamesBegin();
		
		theKeySendVar = setInterval( function() {
			if(canPlayGame == 0) {
				sendkeys();
			} },110);
	});

	socket.on('updateTheTetrisDetails',function(data){
		clearTimeout(netSpeedBlinker);
		clearTimeout(connectionReset);
		document.getElementById("netSpeedBlinker").style.display = "hidden";
		
		//to show net speed blinker when data not received
		if(YouCanPlayMultiplayer)
			connectionContinuity();
		
		backgroundPropertyOfAllBlocks_temp = [];                                                                                                                               
		backgroundPropertyOfAllBlocks_temp_Opponents = [];
		backgroundPropertyOfAllBlocks_temp = data.tetrisBackgroundProperty.slice(0);
		backgroundPropertyOfNextBlocks = data.tetrisPreviewProperty.slice(0);
		backgroundPropertyOfAllBlocks_temp_Opponents = data.OpponentsTetrisBackgroundProperty.slice(0);
		diffLevel = data.currentLevel;
		
		if(data.rowAddition == true || data.rowCompletion == true){	
			rowCompletionSound.play();
		}
		timer = data.timer;
		
		if(gridMakingCompleted == true){ 
			var rowsAdded = data.rowsAdded;
			updateTetris(rowsAdded);
			updateDiffLevel(diffLevel);
			updateTimer(timer,data.theCriticalTime,data.theFinalTime);
	
			if(onetimeDetails == false){
				if(data.myLevel <= data.oppLevel)
					setTheme(data.oppLevel);
				else
					setTheme(data.myLevel);
				
				updateLevel(data.myLevel);
				troph = data.theTrophy;
				oppTroph = data.oppTrophy;
				
				nameOfUser = data.theUser;
				oppNameOfUser = data.oppUser;
				
				winTrophy = data.winningTrophy;
				
				updateTrophy(troph,oppTroph);
				updateUserName(nameOfUser,oppNameOfUser);
				updateWinTrophy(winTrophy);
				
				onetimeDetails = true;
			}
		}
	});

	socket.on('makeGridFirst',function(){
		var list0 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list0.length; i++) {
			list0[i].style.display="block";
		}
		
		var list = document.getElementsByClassName("container");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="block";
		}
		
		document.getElementById("currentTrophies").style.display = "block";
		document.getElementById("currentLevel").style.display = "block";
		
		var list2 = document.getElementsByClassName("difficulty-meter");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
		
		var list3 = document.getElementsByClassName("upcoming");
		for (var i = 0; i < list3.length; i++) {
			list3[i].style.display="block";
		}
		
		var list4 = document.getElementsByClassName("time");
		for (var i = 0; i < list4.length; i++) {
			list4[i].style.display="block";
		}
		
		var list5 = document.getElementsByClassName("my-trophies");
		for (var i = 0; i < list5.length; i++) {
			list5[i].style.display="block";
		}
		
		var list6 = document.getElementsByClassName("opponent-trophies");
		for (var i = 0; i < list6.length; i++) {
			list6[i].style.display="block";
		}
		
		document.getElementById("netSpeedBlinker").style.display = "none";
		
		document.getElementById("p1ID").style.display = "block";
		document.getElementById("p2ID").style.display = "block";

		makingOfPreviewBlock();
		makingOfGrid();	
		
		enableSwipe('p1ID');
	});
	
	socket.on('leaveSpectateRoomCompleted',function(){
		hideGameScreen();
		hideMainScreen();
		showMainScreen();
	});
	
	socket.on('theGameIsOver',function(data){
		clearTimeout(netSpeedBlinker);
		clearTimeout(connectionReset);
		
		//game background music stop
		gamePlaySound.pause();
		gamePlaySound.currentTime = 0;
		
		previousDate=9007199254740992;
		netSpeedBlinkerCount=0;
	
		YouCanPlayMultiplayer = false;
		onetimeDetails =false;
		
		line = data.line;
		trophy = line[1];
		clearInterval(theKeySendVar);
		
		var list1 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list1.length; i++) {
			list1[i].style.display="none";
		}
		
		var list2 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
		
		if (line[0]== "won"){
			//play game lost sound
			gameWinSound.play();
			
			document.getElementById("gameWon").style.display = "block";
			document.getElementById("trophyWon").innerHTML = "Trophies Won "+trophy;
		}
		
		if (line[0]== "lost"){
			//play game lost sound
			gameLostSound.play();
	
			document.getElementById("gameLost").style.display = "block";
			document.getElementById("trophyLost").innerHTML = "Trophies Lost "+trophy;
		}
		
		document.getElementById("currentTrophies_p").innerHTML = "-";
		document.getElementById("currentLevel").innerHTML = "-";
		document.getElementById("timeText").innerHTML = "-";
	});
	
	socket.on('theGameIsDraw',function(){
		var list1 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list1.length; i++) {
			list1[i].style.display="none";
		}
		 
		var list2 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
		
		document.getElementById("gameWon").style.display = "block";
		document.getElementById("winningStatus").innerHTML = "Timeout! <br> Match Draw";
		document.getElementById("winningStatus").style.color = 'red';
		document.getElementById("trophyWon").innerHTML = "Trophies Won 0";
	});
	       
	//to receive illegal move alert and play illegal move sound play
	socket.on('illegal move',function(){
		//console.log("illegal move");
		illegalSound.play();
	});
	
	socket.on('gameResultForSpectators',function(data){
		//console.log('spectate over-----');
		var list1 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list1.length; i++) {
			list1[i].style.display="none";
		}
		
		var list2 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
		
		document.getElementById("gameWon").style.display = "block";
		document.getElementById("winningStatus").innerHTML = data+" Won";
		document.getElementById("trophyWon").style.display = "none";
		
		document.getElementById("currentTrophies_p").innerHTML = "-";
		document.getElementById("currentLevel").innerHTML = "-";
		document.getElementById("timeText").innerHTML = "-";
	});
	
	socket.on('sending data of clients',function(data){				
		onlinePlayers = data;
		//spectate screen sound 
		specReplay.play();
		if(onlinePlayers.length !=0)
			document.getElementById("NoGamesSpectate").style.display = "none";
		else
			document.getElementById("NoGamesSpectate").style.display = "block";
			
		for(i=0;i<onlinePlayers.length;i++){
			if(onlinePlayers[i][0] != "/#"+socket.id && currentPlayersOnSpectate[onlinePlayers[i][4]] != true){
				currentPlayersOnSpectate[onlinePlayers[i][4]] = true;
				var ulli = document.createElement('ul');
				
				//1st player
				var b1=document.createElement('li');
				b1.id=i+"q";
				
				var div_temp1 = document.createElement('div');
				div_temp1.setAttribute("class", "p1-trophies");
				
				var pTag1 = document.createElement('p');	
				
				var div_temp2 = document.createElement('div');
				div_temp2.setAttribute("class","count");
				
				var pTag2 = document.createElement('p');				
				
				var vsClass = document.createElement('b');
				vsClass.setAttribute("class", "vs");
				
				var image_temp = document.createElement("img");
				image_temp.setAttribute("src","../trophy.png");	
				
				
				pTag1.innerHTML = onlinePlayers[i][2];
				pTag2.innerHTML = onlinePlayers[i][5];;
				
				vsClass.innerHTML = "vs";
				
				//under count
				div_temp2.appendChild(image_temp);
				div_temp2.appendChild(pTag2);
				
				//under p1-trophies
				div_temp1.appendChild(pTag1);
				div_temp1.appendChild(div_temp2);
				div_temp1.appendChild(vsClass);
				
				/**/
				var div_temp3 = document.createElement('div');
				div_temp3.setAttribute("class", "p2-trophies");
				
				var pTag3 = document.createElement('p');				
				
				var div_temp4 = document.createElement('div');
				div_temp4.setAttribute("class", "count");
				
				var image_temp2 = document.createElement("img")
				image_temp2.setAttribute("src","../trophy.png");	
				
				var pTag4 = document.createElement('p');	
				
				pTag3.innerHTML = onlinePlayers[i][3];
				pTag4.innerHTML = onlinePlayers[i][6];;
				
				//under count
				div_temp4.appendChild(image_temp2);
				div_temp4.appendChild(pTag4);
				
				//under p2-trophies
				div_temp3.appendChild(pTag3);
				div_temp3.appendChild(div_temp4);
				
				//under li
				b1.appendChild(div_temp1);
				b1.appendChild(div_temp3);
				//under ul
				
				//2nd player
				var b2=document.createElement('li');
				b2.id=i+"q";
				ulli.appendChild(b1);
				ulli.appendChild(b2);
				
				var btn = document.createElement("BUTTON");
				btn.setAttribute("class","btn btn-green watch");
				
				var st = document.createElement("strong");
				st.setAttribute("class","watch strong");
				st.innerHTML = "WATCH";
				
				btn.appendChild(st);
				btn.id = onlinePlayers[i][4];
				
				ulli.appendChild(btn);
				
				document.getElementById("theSpace").appendChild(ulli);
				
				btn.onclick=function(){
									//console.log(this.id);
									specReplay.pause();
									specReplay.currentTime=0;
									getspectatingdata(this.id);
								};
			}             
		}
	});

	//to get the cookie
	function getCookie(cname) {
		var name = cname + "=";
		var ca = document.cookie.split(';');
		for(var i = 0; i < ca.length;i++) {
			var c = ca[i];
			while(c.charAt(0) == ' ') {
				c = c.substring(1);
			}
			if (c.indexOf(name) == 0) {
				return c.substring(name.length,c.length);
			}
		}
		return "";
	}
	
	function connectionContinuity(){
		//ifdata is not received within 1.5 sec then show slow net blinker
		netSpeedBlinker = setTimeout(function(){
			document.getElementById("netSpeedBlinker").style.display = "block";
			//if data is still not received within 3 sec then reset connection
			connectionReset = setTimeout(function(){
				document.getElementById("netSpeedBlinker").style.display = "hidden";
				clearTimeout(netSpeedBlinker);
				resetConnection();
			},3000);
		},2000);
	}
	
	/*
	Level assigning based on trophies
	Level 1: 800-900
	Level 2: 901-1000
	Level 3: 1001-1200
	Level 4: 1201-1500
	Level 5: 1501-1700
	Level 6: 1701-2000
	Level 7: 2001-2500
	Level 8: 2501-3000	
	*/
	
	function setTheme(lvl){
		switch(lvl){
			case 2: document.getElementById("backkkk").style.backgroundImage = "url('Level-2.jpg')";
					break;
					
			case 3: document.getElementById("backkkk").style.backgroundImage = "url('Level-3.jpg')";
					break;
					
			case 4: document.getElementById("backkkk").style.backgroundImage = "url('Level-4.jpg')";
					break;
					
			case 5: document.getElementById("backkkk").style.backgroundImage = "url('Level-5.jpg')";
					break;
					
			case 6: document.getElementById("backkkk").style.backgroundImage = "url('Level-6.jpg')";
					break;
					
			case 7: document.getElementById("backkkk").style.backgroundImage = "url('Level-7.jpg')";
					break;
					
			case 8: document.getElementById("backkkk").style.backgroundImage = "url('Level-8.jpg')";
					break;
					
			case 9: document.getElementById("backkkk").style.backgroundImage = "url('Level-9.jpg')";
					break;
		
			default:console.log("Inside default of setTheme!!");
					document.getElementById("backkkk").style.backgroundImage = "url('bg.jpg')";
					break;
		}
	}
	
	function updateDiffLevel(diffLevel){
		switch(diffLevel){
		case 1: document.getElementById('lvl1').setAttribute("class","l1active");
				break;
		case 2: document.getElementById('lvl2').setAttribute("class","l2active");
				document.getElementById('lvl1').setAttribute("class","l1");
				break;
		case 3: document.getElementById('lvl3').setAttribute("class","l3active");
				document.getElementById('lvl2').setAttribute("class","l2");
				break;
		case 4: document.getElementById('lvl4').setAttribute("class","l4active");
				document.getElementById('lvl3').setAttribute("class","l3");
				break;
		case 5: document.getElementById('lvl5').setAttribute("class","l5active");
				document.getElementById('lvl4').setAttribute("class","l4");
				break;
		}
	}
	
	function resetDiffLevel(){
		document.getElementById("lvl1").setAttribute("class","l1");
		document.getElementById("lvl2").setAttribute("class","l2");
		document.getElementById("lvl3").setAttribute("class","l3");
		document.getElementById("lvl4").setAttribute("class","l4");
		document.getElementById("lvl5").setAttribute("class","l5");
	}

	function updateWinTrophy(tempWinTrophy){
		if(typeof tempWinTrophy != 'undefined')
			document.getElementById("currentTrophies_p").innerHTML = "+ "+tempWinTrophy;
		else
			document.getElementById("currentTrophies_p").innerHTML = "-";
	}
	
	function updateUserName(myName,oppName){
		if(typeof myName != 'undefined')
			document.getElementById("myName").innerHTML = myName;
		else
			document.getElementById("myName").innerHTML = "-";
		
		if(typeof oppName != 'undefined')
			document.getElementById("opponentName").innerHTML = oppName;
		else
			document.getElementById("opponentName").innerHTML = "-";
	}
	
	function updateTrophy(temp_troph,temp_oppTrophy){
		if(typeof myName != 'temp_troph')
			document.getElementById("playerTrophy").innerHTML = temp_troph;
		else
			document.getElementById("playerTrophy").innerHTML = "-";
		if(typeof myName != 'temp_oppTrophy')
			document.getElementById("oppTrophy").innerHTML = temp_oppTrophy;
		else
			document.getElementById("oppTrophy").innerHTML = "-";
	}

	function updateTimer(isTime,critical,finalTime){
		//console.log("finalTime:  "+finalTime);
		var theTime = isTime;
		if(critical == true && isCritical==false){
			d= document.getElementById("theTime");
			d.className += " pulse";
			isCritical = true;
		}
		if(finalTime != 200){
			ff = document.getElementById("countDown");
				
			if(isFinalTime == false){
				ff.style.display = "block";
				ff.className += " pulse";
				isFinalTime = true;
			}
			document.getElementById("countDownLabel").innerHTML = finalTime;			
		}
		if(typeof theTime != 'undefined')
			document.getElementById("timeText").innerHTML = theTime;
		else
			document.getElementById("timeText").innerHTML = "-";
	}
	
	function makeBackgroundPropertyOfBlocks(){
		for(i=0 ;i<gridHeight+graveyard;i++){
			var data2 = [];
			for(j=0;j<gridWidth;j++){
				data2.push(defaultBackgroundColor);
			}
			backgroundPropertyOfAllBlocks.push(data2);
			backgroundPropertyOfAllBlocksOpponents.push(data2);
			backgroundPropertyOfAllBlocks_temp.push(data2);
			backgroundPropertyOfAllBlocks_temp_Opponents.push(data2);
		}
	}
	
	function makeBackgroundPropertyNextBlocks(){
		for(i=0 ;i<previewGridHeight ;i++){
			var data = [];
			for(j=0;j<previewGridWidth;j++){
				data.push(defaultBackgroundColor);
			}
			backgroundPropertyOfNextBlocks.push(data);
		}
	}
	
	function updateTetris(rowsAdd){	
			for(var i=0;i<gridHeight;i++){
				for(var j=0;j<gridWidth;j++){
					//graveyard is no of rows out of grid in the starting
					//or the hidden rows at the starting of grid
					if(backgroundPropertyOfAllBlocks[i+graveyard][j] != backgroundPropertyOfAllBlocks_temp[i+graveyard][j]){
							switch(backgroundPropertyOfAllBlocks_temp[i+graveyard][j]){
								case "orange":	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyOrange");
												break;
												
								case "yellow":	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyYellow");
												break;
												
								case "red":		getID(i+"x"+j).setAttribute("class","tetrisblockPropertyRed");
												break;
												
								case "green":	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyGreen");
												break;
												
								case "purple":	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyPurple");
												break;
								
								case "blue":	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyBlue");
												break;
								
								case "cyan":   	getID(i+"x"+j).setAttribute("class","tetrisblockPropertyCyan");
												break;
								
								default:   	    break;
							}
					}
					if(rowsAdd!=0){
						if(gridHeight-i <= rowsAdd){
							var id='#'+i+'x'+j;
							if(!$(id).hasClass("blink_me"))
								$(id).addClass("blink_me");
						}
						isRowAdded = rowsAdd;
					}
					else{
						if(gridHeight-i <= isRowAdded){
							var id='#'+i+'x'+j;
							if($(id).hasClass("blink_me"))
								$(id).removeClass("blink_me");
						}
					}
					
					if(backgroundPropertyOfAllBlocks_temp[i+graveyard][j] != defaultBackgroundColor);
					 else	getID(i+"x"+j).setAttribute("class","");
				}
			}
		if(rowsAdd == 0)
			isRowAdded = 0;
		backgroundPropertyOfAllBlocks = [];
		backgroundPropertyOfAllBlocks = backgroundPropertyOfAllBlocks_temp.slice(0);
		
		//opponents
		for(var i=0;i<gridHeight;i++){
			for(var j=0;j<gridWidth;j++){
				if(backgroundPropertyOfAllBlocksOpponents[i+graveyard][j] != backgroundPropertyOfAllBlocks_temp_Opponents[i+graveyard][j]){
					switch(backgroundPropertyOfAllBlocks_temp_Opponents[i+graveyard][j]){
						case "orange":	getID(i+"o"+j).setAttribute("class","tetrisblockPropertyOrange");
										break;
										
						case "yellow":	getID(i+"o"+j).setAttribute("class","tetrisblockPropertyYellow");
										break;	
										
						case "red":		getID(i+"o"+j).setAttribute("class","tetrisblockPropertyRed");
										break;
										
						case "green":	getID(i+"o"+j).setAttribute("class","tetrisblockPropertyGreen");
										break;
										
						case "purple":  getID(i+"o"+j).setAttribute("class","tetrisblockPropertyPurple");
										break;
						
						case "blue":	getID(i+"o"+j).setAttribute("class","tetrisblockPropertyBlue");
										break;
						
						case "cyan":    getID(i+"o"+j).setAttribute("class","tetrisblockPropertyCyan");
										break;
						
						default: break;
					}
				}
				if(backgroundPropertyOfAllBlocks_temp_Opponents[i+graveyard][j] != defaultBackgroundColor);
					else
						getID(i+"o"+j).setAttribute("class","");
			}
		}
		
		backgroundPropertyOfAllBlocksOpponents = [];
		backgroundPropertyOfAllBlocksOpponents = backgroundPropertyOfAllBlocks_temp_Opponents.slice(0);
		
		for(i=0;i<previewGridHeight;i++){
			for(j=0;j<previewGridWidth;j++){
				getID(i+"v"+j).style.backgroundColor = backgroundPropertyOfNextBlocks[i][j];
				switch(backgroundPropertyOfNextBlocks[i][j]){
						
						case "orange":	getID(i+"v"+j).setAttribute("class","tetrisblockPropertyOrange");
										break;
										
						case "yellow":	getID(i+"v"+j).setAttribute("class","tetrisblockPropertyYellow");
										break;
										
						case "red":		getID(i+"v"+j).setAttribute("class","tetrisblockPropertyRed");
										break;
						
						case "green":	getID(i+"v"+j).setAttribute("class","tetrisblockPropertyGreen");
										break;
						
						case "purple":	
										getID(i+"v"+j).setAttribute("class","tetrisblockPropertyPurple");
										break;
						
						case "blue":	
										getID(i+"v"+j).setAttribute("class","tetrisblockPropertyBlue");
										break;
						
						case "cyan":    getID(i+"v"+j).setAttribute("class","tetrisblockPropertyCyan");
										break;
						
						
						default: break;
					}
				if(backgroundPropertyOfNextBlocks[i][j] != defaultBackgroundColor);
				else{
					getID(i+"v"+j).setAttribute("class","");
				}
			}
		}
	}
	
	function resetConnection(){
		socket = io({ forceNew: true });

		socket.once('connect', function() {
		  socket.disconnect();
		});

		socket.once('disconnect', function() {
		  socket.once('connect', function() {
			console.log('Connected for the second time!');
		  });
		  socket.connect();
		});
	}
	
	function updateLevel(tempLevel){
		if(typeof tempLevel !='undefined')
			getID("currentLevel").innerHTML = "LEVEL "+tempLevel;	
		else
			getID("currentLevel").innerHTML = "-";
	}
	
	function makingOfPreviewBlock(){
		var ull =  document.createElement('ul');
		for(i=0;i<previewGridHeight;i++){
			for(j=0;j<previewGridWidth;j++){
				var b1=document.createElement('li');
				b1.id=i+"v"+j;
				ull.appendChild(b1);
			}
		}
		document.getElementById("nextBlockWindow").appendChild(ull);
	}
	
	function makingOfGrid(){
		var ulli = document.createElement('ul');
		ulli.id = "p1IDulli";
		for(var i=0;i<gridHeight;i++){
			for(var j=0;j<gridWidth;j++){
				var b1=document.createElement('li');
				b1.id=i+"x"+j;
				ulli.appendChild(b1);
			}
		}
		document.getElementById("p1ID").appendChild(ulli);
		
		var ulli2 =  document.createElement('ul');
		ulli2.id = "p2IDulli";
		for(var i=0;i<gridHeight;i++){
			for(var j=0;j<gridWidth;j++){
				var b1=document.createElement('li');
				b1.id=i+"o"+j;
				ulli2.appendChild(b1);
			}
		}
		document.getElementById("p2ID").appendChild(ulli2);
		gridMakingCompleted = true;
		
		/*-----------------vs modal box----------------------------*/
		document.getElementById("battleInfoModal").style.display = "block";
		
		//nameOfUser,oppNameOfUser
		document.getElementById("firstPlayerModal").innerHTML = ""+nameOfUser;
		document.getElementById("secondPlayerModal").innerHTML = ""+oppNameOfUser;
		
		//troph,oppTroph
		document.getElementById("FirstPlayerTrophyModal").innerHTML = ""+troph;
		document.getElementById("SecondPlayerTrophyModal").innerHTML = ""+oppTroph;
		
		setTimeout(function(){
			document.getElementById("battleInfoModal").style.display = "none";
			if(canPlayGame==0)	socket.emit('gridMakingCompleted',true);	
		},4000);
		/*-----------------vs modal box------------------------------*/
	}
	
	function getID(currentID){
		return document.getElementById(currentID);
	}
	
	document.addEventListener("keydown", tetrisKeyDown, false);
	document.addEventListener("keyup", tetrisKeyUp, false);
	
	function tetrisKeyDown(e){
		var keyCode = e.keyCode;
		
		if(keyCode == 88){
			keystatus['stopButton']=true;
		}
		if(keyCode == 37 || keyCode == 65){
			keystatus['leftButton']=true;
		}
		if(keyCode == 38 || keyCode == 87){
			keystatus['rotateButton']=true;
		}
		if(keyCode == 39 || keyCode == 68){
				keystatus['rightButton']=true;
		}
		if(keyCode == 40 || keyCode == 83){
			keystatus['dropButton']=true;
		}
	}
	
	function tetrisKeyUp(ey){
		var keyCode = ey.keyCode;
		if(keyCode == 40 || keyCode == 83){
			keystatus['dropButton']=false;
		}
		if(keyCode == 88){
			keystatus['stopButton']=false;
		}
		if(keyCode == 37 || keyCode == 65){
			keystatus['leftButton']=false;
		}
		if(keyCode == 38 || keyCode == 87){
			keystatus['rotateButton']=false;
		}
		if(keyCode == 39 || keyCode == 68){
			keystatus['rightButton']=false;
		}
		if(keyCode == 83)
			changeSounds();
	}

	function sendkeys(){
		if(canPlayGame==0)
			socket.emit('Clients key status',keystatus);
	}
	
	//toggle sounds
	function changeSounds(){
		if(soundOn == true){
			soundOn = false;
			document.getElementById("soundImg").src = "../volume_off.png";
			
			gamePlaySound.volume=0.0;
			rowCompletionSound.volume=0.0;
			gameLostSound.volume=0.0;
			gameWinSound.volume=0.0;
			mainScreenSound.volume=0.0;
			specReplay.volume = 0.0;
			buttonClick.volume = 0.0;
			buttonHover.volume = 0.0;
			searchOpp.volume = 0.0;
			illegalSound.volume = 0.0;
		}
		else{
			soundOn = true;
			document.getElementById("soundImg").src = "../volume_up.png";
			
			//default sounds
			gamePlaySound.volume=1.0;
			rowCompletionSound.volume=1.0;
			gameLostSound.volume=1.0;
			gameWinSound.volume=1.0;
			mainScreenSound.volume=1.0;
			specReplay.volume = 1.0;
			buttonClick.volume = 1.0;
			buttonHover.volume = 1.0;
			searchOpp.volume = 1.0;
			illegalSound.volume = 1.0;
		}
	}
	
	function restartButton(){
		resetDiffLevel();
		document.getElementById("gameWon").style.display = "none";
		document.getElementById("gameLost").style.display = "none";
		document.getElementById("p1ID").style.display = "none";
		document.getElementById("p2ID").style.display = "none";

		document.getElementById("p1IDulli").remove();
		document.getElementById("p2IDulli").remove();

		hideGameScreen();
		showMainScreen();

		document.getElementById("countDown").style.display = "none";
		var user = getCookie("idOfUser");
		user = jQuery.parseJSON(user);
		socket.emit('clientUser_id',user);
	}
	
	function multiPlayer(resp){
		buttonClick.play();
		var list = document.getElementsByClassName("splash");
		for(var i = 0; i < list.length; i++) {
			list[i].style.display="none";
		}
		
		var list2 = document.getElementsByClassName("splash-wrapper");
		for(var i = 0; i < list2.length; i++) {
			list2[i].style.display="none";
		}
		
		if(resp == true){
			document.getElementById("opponentSearch").style.display = "block";
			
			mainScreenSound.pause();
			mainScreenSound.currentTime = 0;
			
			searchOpp.play();
			
			oppSearchTimeoutVar = setTimeout(function(){
				searchOpp.pause();
				searchOpp.currentTime = 0;
				document.getElementById("opponentSearch").style.display = "none";  
				socket.emit('playWithAI',true);
			}, 30000);
			
			socket.emit('wantToPlayMultiplayer',true);
		}
		else	console.log("resp == false");
	}
	
	function hallOfFameButton(){
		buttonClick.play();
		//console.log("hall of fame button pressed");
		
		hideMainScreen();
		//mainscreensound
		mainScreenSound.pause();
		mainScreenSound.currentTime = 0;
		
		specReplay.play();
		
		hideMainScreen();
		document.getElementById("isHallOfFame").style.display="block";
		socket.emit("hallOfFameButtonPressed");
	}
	
	function letTheGamesBegin(){
		canPlayGame =0;
		makeBackgroundPropertyOfBlocks();
		socket.emit('iWillPlayGame',true);
	}

	function spectator(){
		buttonClick.play();
		
		//console.log("spectator");
		spectateScreenOn = true;
		//spectate screen sound 
		
		hideMainScreen();
		document.getElementById("isSpectate").style.display="block";
		
		mainScreenSound.pause();
		mainScreenSound.currentTime=0;
		
		specReplay.play();
		
		//for refreshing spectate screen
		theSpectateRepeatVar = setInterval( function() {
			if(spectateScreenOn == true) {
				socket.emit('Iwanttospectate',true);
			} 
		},500);
	}
	
	//to cancel searching opponent
	function cancelSearchingOpponent(){
		if(YouCanPlayMultiplayer == false){
			document.getElementById("cancelSearch").innerHTML = "Cancelling...";
			document.getElementById("noOpponentsFound").style.display = "none";
			clearTimeout(oppSearchTimeoutVar);
			
			socket.emit("cancelTheGame",true);	
			//to show main screen after 5 secs
			setTimeout(function(){
				cancelBattleCode();
				searchOpp.pause();
				searchOpp.currentTime=0;
			},2000);
		}
		else console.log("You can't cancel the game right now");
	}

	//part of cancel searching opponent
	function cancelBattleCode(){
		document.getElementById("opponentSearch").style.display = "none";
		document.getElementById("cancelSearch").innerHTML = "Cancel";
		showMainScreen();
	}
	
	//to cancel the spectate
	function cancelSpectate(){
		socket.emit('cancelTheSpectate',true);
	}
	
	function showMainScreen(){
		mainScreenSound.play();
		
		var list = document.getElementsByClassName("splash");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="block";
		}
		
		var list2 = document.getElementsByClassName("splash-wrapper");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
			
		var list3 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list3.length; i++) {
				list3[i].style.display="block";
		}
	}
	
	function hideGameScreen(){
		var list0 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list0.length; i++) {
			list0[i].style.display="none";
		}
		
		var list = document.getElementsByClassName("container");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="none";
		}
		
		document.getElementById("currentTrophies").style.display = "none";
		document.getElementById("currentLevel").style.display = "none";
		
		var list2 = document.getElementsByClassName("difficulty-meter");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="none";
		}
		
		var list3 = document.getElementsByClassName("upcoming");
		for (var i = 0; i < list3.length; i++) {
			list3[i].style.display="none";
		}
		
		var list4 = document.getElementsByClassName("time");
		for (var i = 0; i < list4.length; i++) {
			list4[i].style.display="none";
		}
		
		var list5 = document.getElementsByClassName("my-trophies");
		for (var i = 0; i < list5.length; i++) {
			list5[i].style.display="none";
		}
		
		var list6 = document.getElementsByClassName("opponent-trophies");
		for (var i = 0; i < list6.length; i++) {
			list6[i].style.display="none";
		}
		
		document.getElementById("idOfCancelSpectateButton").style.display="none";
		//document.getElementById("isSpectate").style.display="none";
	}
	
	function cancelSpectateController(){
		socket.emit('cancelSpectatePlease',true);
	}
	
	function hideMainScreen(){
		var list = document.getElementsByClassName("splash");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="none";
		}
		
		var list2 = document.getElementsByClassName("splash-wrapper");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="none";
		}
			
		var list3 = document.getElementsByClassName("overlay");
		for (var i = 0; i < list3.length; i++) {
				list3[i].style.display="none";
		}
	}
	
	function backSpectate(){
		//console.log("backSpectate clicked!");
		document.getElementById("isSpectate").style.display="none";
		
		specReplay.pause();
		specReplay.currentTime=0;
		spectateScreenOn = false;
		clearInterval(theSpectateRepeatVar);
		
		showMainScreen();
	}
	
	function backHallOfFame(){
		//console.log("backHallOfFame clicked!");
		document.getElementById("isHallOfFame").style.display="none";
		
		specReplay.pause();
		specReplay.currentTime=0;
		showMainScreen();
	}
	
	function playMouseHover(){
		buttonHover.play();
	}
	
	function getspectatingdata(k){		
		spectateScreenOn = false;		
		//console.log("getspectatingdata");
		clearInterval(theSpectateRepeatVar);
		var roomID = k;
		
		var list0 = document.getElementsByClassName("invisible");
		for (var i = 0; i < list0.length; i++) {
			list0[i].style.display="block";
		}
		
		var list = document.getElementsByClassName("container");
		for (var i = 0; i < list.length; i++) {
			list[i].style.display="block";
		}
		
		document.getElementById("currentTrophies").style.display = "block";
		document.getElementById("currentLevel").style.display = "block";
		
		var list2 = document.getElementsByClassName("difficulty-meter");
		for (var i = 0; i < list2.length; i++) {
			list2[i].style.display="block";
		}
		
		var list3 = document.getElementsByClassName("upcoming");
		for (var i = 0; i < list3.length; i++) {
			list3[i].style.display="block";
		}
		
		var list4 = document.getElementsByClassName("time");
		for (var i = 0; i < list4.length; i++) {
			list4[i].style.display="block";
		}
		
		var list5 = document.getElementsByClassName("my-trophies");
		for (var i = 0; i < list5.length; i++) {
			list5[i].style.display="block";
		}
		
		var list6 = document.getElementsByClassName("opponent-trophies");
		for (var i = 0; i < list6.length; i++) {
			list6[i].style.display="block";
		}
		
		document.getElementById("idOfCancelSpectateButton").style.display="block";
		document.getElementById("isSpectate").style.display="none";
		
		makeBackgroundPropertyOfBlocks();
		makingOfPreviewBlock();
		makingOfGrid();
		
		socket.emit("sendMeTheGameOfThisID",roomID);
	}
	
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

	//augmenting native DOM functions (stack overflow solution)
	Element.prototype.remove = function() {
    	this.parentElement.removeChild(this);
	}

	NodeList.prototype.remove = HTMLCollection.prototype.remove = function() {
    	for(var i = this.length - 1; i >= 0; i--) {
        	if(this[i] && this[i].parentElement) {
            	this[i].parentElement.removeChild(this[i]);
        	}
    	}
	}