var request = require("request");
var _ = require("underscore");

var config = require("./lib/config")({
	PORT : 3000,
	YO_API_KEY : "INSERT KEY HERE",
	YO_API_SEND_URL : "https://api.justyo.co/yo/",
	RESPONSE_URL_FORMAT : "${SCHEME}://${HOST}/message?${MESSAGE}",
	MONITORED_URL : null,
	USER_TO_NOTIFY : null
});

if(!MONITORED_URL) {
	return console.log("No MONITORED_URL configured, skipping...");
}
request(config.get("MONITORED_URL"), function(error, response, body) {
	if(response.status!=200) {
		console.log("Detected error monitoring " + config.get("MONITORED_URL") + ", so sending notification");
		var model = {
			MESSAGE : encodeURIComponent("Error - " + err),
			USERNAME : req.query.username
		};
		model.link = url_template(model);
		sendYo(model, 3, function(err, response) {
			if(err) {
				return console.log("Error sending YO to user " + config.get("USER_TO_NOTIFY") + " - " + err);
			}
			return console.log("Notified user " + config.get("USER_TO_NOTIFY"));
		});
	}
	else {
		console.log("Monitored " + config.get("MONITORED_URL") + " and all is well.");
	}
});

function sendYo(model, tries, callback) {
	request.post(config.get("YO_API_SEND_URL"), { form : { api_token : config.get("YO_API_KEY"), username : model.USERNAME, link : model.link } }, function(err, response) {
		if(err || response.statusCode !== 200) {
			if(/Rate limit exceeded. Only one Yo per recipient per minute./.test(response.body)) { // Need to find a less fragile way to detect this
				if(tries < config.get("MAX_TRIES")) {
					tries = tries + 1;
					console.log("Rate limited YOing " + model.USERNAME + ", trying again in 30 seconds. Try #" + tries);
					setTimeout(function() { 
						console.log("Retrying for " + model.USERNAME);
						sendYo(model, tries, function() {}); 
					}, 30000);
					err = "Once per minute per user rate limit exceeded, will try again up to " + config.get("MAX_TRIES") + " times.";
				}
				else {
					console.log("Exceeded MAX_TRIES=" + config.get("MAX_TRIES") + ", trying to YO " + model.USERNAME);
				}
			}
			else {
				console.log("ERROR Sending Yo to " + model.USERNAME + " - " + response.body);
			}
			return callback(err, response);
		}
		else {
			return callback(null, response);
		}
	}); 
}
