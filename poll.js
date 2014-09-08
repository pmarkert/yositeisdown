var request = require("request");
var _ = require("underscore");
var mongodb = require("mongodb").MongoClient;

var config = require("./lib/config")({
	PORT : 3000,
	YO_API_KEY : "INSERT KEY HERE",
	YO_API_SEND_URL : "https://api.justyo.co/yo/",
	RESPONSE_URL_FORMAT : "${SCHEME}://${HOST}/message?m=${MESSAGE}",
	MONITORED_URL : null,
	USER_TO_NOTIFY : null
});

if(!config.get("MONITORED_URL")) {
	return console.log("No MONITORED_URL configured, skipping...");
}

// Process the RESPONSE_URL_FORMAT to replace scheme, hostname, etc.
// Switching out the default underscore <%=%> for %{} delimiters
var url_template = _.template(config.get("RESPONSE_URL_FORMAT"), { interpolate : /\$\{(.+?)\}/ });

function monitor(link) {
	request(link.url, function(error, response, body) {
		if(error || response.statusCode!=200) {
			console.log("Detected error monitoring " + link.url + ", so sending notification");
			var model = {
				MESSAGE : encodeURIComponent("Error - " + error),
				USERNAME : link.username
			};
			if(!error) {
				model.MESSAGE = encodeURIComponent("StatusCode was " + response.statusCode);
			}
			model.link = url_template(model);
			sendYo(model, 3, function(err, response) {
				if(err) {
					return console.log("Error sending YO to user " + link.username + " - " + err);
				}
				return console.log("Notified user " + link.username);
			});
		}
		else {
			console.log("Monitored " + link.url + " and all is well.");
		}
	});
}

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

mongodb.connect(config.get("MONGOHQ_URL"), function(err, db) {
	db.link.find( { active : { "$gt" : 0 } }, function(err, links) {
		links.forEach(monitor);
	});
});
