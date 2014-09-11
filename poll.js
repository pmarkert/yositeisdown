var _ = require("underscore");
var mongodb = require("mongodb").MongoClient;
var uuid = require("node-uuid");
var request = require("request");

var config = require("./lib/config")({
	YO_API_KEY : null,
	RESPONSE_URL_FORMAT : "${SCHEME}://${HOST}/error_report?id=${MESSAGE}",
});

// Prepare the RESPONSE_URL_FORMAT to replace the scheme, hostname, etc.
// Switching out the default underscore <%=,%> for ${,} delimiters
var url_template = _.template(config.get("RESPONSE_URL_FORMAT"), { interpolate : /\$\{(.+?)\}/ });

// Setup the yoProxy tied to the configured account
var yoSender = require("./lib/yo_api");
var sendYo = yoSender(config.get("YO_API_KEY"));

function monitor(link, callback) {
	console.log("Checking " + JSON.stringify(link));
	request(link.url, function(error, response, body) {
		if(error || response.statusCode!=200) {
			console.log("Detected error monitoring - " + link.url);
			mongodb.connect(config.get("MONGOHQ_URL"), function(err, db) {
				if(err) {
					console.log("Error connecting to mongo to save error_report - " + err);
					return callback(false);
				}
				var error_report = { 
					_id : uuid.v4(), 
					linkid : link._id, 
					date : new Date(), 
					response : { 
						statusCode : response.statusCode,
						body : body 
					}
				};
				db.collection("error_report").save(error_report, function(err, saved_report) {
					db.close();
					if(err) {
						console.log("Error saving error_report from link - " + JSON.stringify(link) + " - " + err);
						return callback(false);
					}
					console.log("Saved error_report - " + JSON.stringify(saved_report));
					var model = {
						MESSAGE : saved_report._id,
						USERNAME : link.username
					};
					sendYo(link.username, url_template(model), function(err, response) {
						if(err) return console.log("Error sending YO to user " + link.username + ", but report was still saved as " + error_report._id + " YoError:" + err);
						return console.log("YOed user " + link.username + " for report " + error_report._id);
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
