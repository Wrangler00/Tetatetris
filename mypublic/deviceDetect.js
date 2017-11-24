//GET THE TYPE OF DEVICE USING JS
	//open
	var isMobile = {
		Android: function() {
			return navigator.userAgent.match(/Android/i);
		},
		BlackBerry: function() {
			return navigator.userAgent.match(/BlackBerry/i);
		},
		iOS: function() {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
		},
		Opera: function() {
			return navigator.userAgent.match(/Opera Mini/i);
		},
		Windows: function() {
			return navigator.userAgent.match(/IEMobile/i);
		},
		any: function() {
			return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
		}
	};
	//closed
	
	//old code
	/*if(isMobile.Android() ) socket.emit("Device type","android");
		else if( isMobile.iOS() ) socket.emit("Device type","Ios");
		else if( isMobile.Opera() ) socket.emit("Device type","Opera");
		else if( isMobile.Windows() ) socket.emit("Device type","Windows");
		else if( isMobile.any() ) socket.emit("Device type","any");
		else	socket.emit("Device type","desktop");*/
		