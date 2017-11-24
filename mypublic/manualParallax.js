//--------------------------------parallax--------------------------------
		var WIDTH, HEIGHT;
		var sensitivity = 1.3;

		function mousehandler(e){
			e = e||window.event;
			CENTERWIDTH = WIDTH/2;
			CENTERHEIGHT = HEIGHT/2;

			deltax = (e.clientX-CENTERWIDTH)/(WIDTH/2);
			deltay = (e.clientY-CENTERHEIGHT)/(HEIGHT/2);
			//console.log(e.clientX  +", " + e.clientY + " : " + deltax + ", " +deltay);
			document.getElementById("backkkk").style.backgroundSize = "" + (WIDTH*1.3) + "px "  + (HEIGHT*1.3) + "px";
			document.getElementById("backkkk").style.backgroundPosition = "" + ((deltax*100/5)+50) + "% " + ((deltay*100/5)+50) + "%";
		};

		window.addEventListener('deviceorientation', function(event) {
			var alpha = event.alpha;
			var beta = event.beta; //y
			var gamma = event.gamma; //x
			document.getElementById("backkkk").style.backgroundSize = "" + (WIDTH*1.3) + "px "  + (HEIGHT*1.3) + "px";
			document.getElementById("backkkk").style.backgroundPosition = "" + ((gamma*100/180)+50) + "% " + ((beta*100/180)+50) + "%";
		}, false);

		function init2(){
			//console.log("init");
			WIDTH = window.innerWidth;
			HEIGHT = window.innerHeight;
			window.onmousemove = mousehandler;
		}
//----------------------------------------------------------------------------------