var socket = io();
var previousTouchMove = 0;

function enableSwipe(elementID){	
		var theElement = document.getElementById(elementID);
		var startx=0,starty=0,dist_touch=0,dist_touchY=0,endx=0,endy=0,horTravelled=0,verTravelled=0;
		var sensitivity=20;
		var wEl = theElement.offsetWidth;
		var hEl = theElement.offsetHeight;
		
		theElement.addEventListener('touchstart',function(e){
			previousTouchMove = 0;
			var touchobj = e.changedTouches[0];//reference first touch point(i.e first finger)
			startx = parseInt(touchobj.clientX);//gets the position of touch point relative to left edge of browser
			starty = parseInt(touchobj.clientY);
			e.preventDefault();
		},false);
		
		theElement.addEventListener('touchmove',function(e){
			var touchobj = e.changedTouches[0]; //reference first point for this event
			dist_touch = parseInt(touchobj.clientX) - startx;
			dist_touchY = parseInt(touchobj.clientY) - starty;
			if(Math.abs(dist_touch) >= sensitivity){
				horTravelled = dist_touch;
				socket.emit('DragEvent',{horDisTravelled:horTravelled});
				startx = parseInt(touchobj.clientX);//gets the position of touch point relative to left edge of browser
				starty = parseInt(touchobj.clientY);
			}
			e.preventDefault();
		},false);
		
		theElement.addEventListener('touchend',function(e){
			var touchobj = e.changedTouches[0]; //reference first point for this event
			endx = parseInt(touchobj.clientX);
			endy = parseInt(touchobj.clientY);
			
			horTravelled = parseInt(endx-startx);
			verTravelled = parseInt(endy-starty);
			
			e.preventDefault();
			socket.emit('touchMovement',{startPoint:startx,horizontalDistTravelled:horTravelled,endPoint:endx,
										 startPointY:starty,verticalDistTravelled:verTravelled,endPointY:endy});
		},false);
}