var request = require("request");
var _ = require("underscore");
var mongodb = require("mongodb").MongoClient;

var config = require("./lib/config")({
	PORT : 3000,
	YO_API_KEY : "INSERT KEY HERE",
	YO_API_SEND_URL : "https://api.justyo.co/yo/",
	RESPONSE_URL_FORMAT : "${SCHEME}://${HOST}/error_report?id=${MESSAGE}",
});

// Process the RESPONSE_URL_FORMAT to replace scheme, hostname, etc.
// Switching out the default underscore <%=%> for %{} delimiters
var url_template = _.template(config.get("RESPONSE_URL_FORMAT"), { interpolate : /\$\{(.+?)\}/ });

function monitor(link, callback) {
	console.log("Checking " + JSON.stringify(link));
	request(link.url, function(error, response, body) {
		if(error || response.statusCode!=200) {
			console.log("Detected error monitoring " + link.url + ", so sending notification");
			mongodb.connect(config.get("MONGOHQ_URL"), function(err, db) {
				if(err) {
					console.log("Error connecting to mongo to save error_report - " + err);
					return callback(false);
				}
				db.collection("error_report").save( { linkid : link._id, date : new Date(), response : { statusCode : response.statusCode }, body : body }, function(err, saved_report) {
					db.close();
					if(err) {
						console.log("Error saving error_report from link - " + JSON.stringify(link) + " - " + err);
						return callback(false);
					}
					console.log("Saved report - " + JSON.stringify(saved_report));
					var model = {
						MESSAGE : saved_report._id,
						USERNAME : link.username
					};
					model.link = url_template(model);
					sendYo(model, 3, function(err, response) {
						if(err) {
							return console.log("Error sending YO to user " + link.username + " - " + err);
						}
						return console.log("Notified user " + link.username);
					});
					return callback(false);
				});
			});
		}
		else {
			console.log("Monitored " + link.url + " and all is well.");
			return callback(true);
		}
	});
}

function sendYo(model, tries, callback) {
	console.log("Yoing - " + JSON.stringify(model));
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
				console.log(JSON.stringify(response));
			}
			return callback(err, response);
		}
		else {
			return callback(null, response);
		}
	}); 
}

mongodb.connect(config.get("MONGOHQ_URL"), function(err, db) {
	if(err) return console.log("Error connecting to MONGOHQ_URL - " + err);
	console.log("Connected to mongodb - looking for links to poll...");
	db.collection("link").find( { active : { "$gt" : 0 } }, function(err, links) {
		if(err) return console.log("Error looking for links to poll - " + err);
		links.each(function(err, link) {
			if(err) return console.log("Error enumerating links - " + err);
			if(!link) { // No more links to poll
				db.close();
				return console.log("Finished polling.");
			}
			monitor(link, function(success) {
				if(!success) {
					link.active -= 1;
					mongodb.connect(config.get("MONGOHQ_URL"), function(err, db) {
						if(err) return console.log("Error connecting to MONGOHQ_URL - " + err);
						db.collection("link").save(link, function(err, saved_link) {
							db.close();
							if(err) return console.log("Error decrementing active count for link - " + JSON.stringify(link) + " : " + err);
							console.log("Decremented active count for link - " + JSON.stringify(link));
						});
					});
				}
			});
		});
	});
});
