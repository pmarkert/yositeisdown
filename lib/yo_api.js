var request = require("request");
var _ = require("underscore");
module.exports = function(YO_API_KEY) {
	return function(username, link, callback) {
		var yo_config = {
			YO_API_SEND_URL : "https://api.justyo.co/yo/",
			MAX_RETRY : 6
		};
		if(_.isObject(YO_API_KEY)) {
			yo_config = _.defaults(YO_API_KEY, yo_config);
		}
		else {
			yo_config.YO_API_KEY = YO_API_KEY;
		}
		yo_config.tries = yo_config.MAX_TRIES;
		sendYo(yo_config, username, link, callback);
	};
}

function sendYo(yo_config, username, link, callback) {
	console.log("sendYo(" + JSON.stringify(yo_config) + "," + username + "," + link + ", callback)");
	var data = { api_token : yo_config.YO_API_KEY, username : username };
	if(link) data.link = link;
	request.post(yo_config.YO_API_SEND_URL, { form : data } , function(err, response) {
		if(!err) {
			if(response.statusCode !== 200) {
				err = "Invalid HTTP response code - " + response.statusCode + " returned from Yo service. Response: " + response.body;
			}
			// Need to find a less fragile way to detect this
			else if(/Rate limit exceeded. Only one Yo per recipient per minute./.test(response.body)) {
				if(yo_config.tries > 0) {
					console.log("Rate limited YOing " + username + ", trying again in 30 seconds. " + tries + " more tries.");
					yo_config.tries -= 1;
					setTimeout(function() { 
						sendYo(yo_config, username, link, callback); 
					}, 30000);
					return;
				}
				else {
					err = "Exceeded MAX_TRIES=" + yo_config.MAX_TRIES + ", trying to YO " + model.USERNAME;
				}
			}
		}
		return callback(err, response);
	}); 
}
