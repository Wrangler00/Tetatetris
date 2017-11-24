function getCookie(cname) {
		var name = cname + "=";
		var ca = document.cookie.split(';');
		for(var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') {
				c = c.substring(1);
			}
			if (c.indexOf(name) == 0) {
				return c.substring(name.length, c.length);
			}
		}
	return "";
}

function deleteAllCookies() {
	var cookies = $.cookie(); for(var cookie in cookies) { $.removeCookie(cookie); }
}

window.onload = function() {
var cookie_value = getCookie("id");
console.log(cookie_value.length);
if(cookie_value.length <= 4){
	cookie_value = '577cdffe86a55d1b377eb307';
}

//console.log(cookie_value+"  cookie value");
var z = document.getElementById("cook").value = cookie_value;}