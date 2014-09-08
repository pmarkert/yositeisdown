var express = require("express");
var morgan = require("morgan");
var http = require("http");
var request = require("request");
var _ = require("underscore");

var config = require("./lib/config")({
	PORT : 3000,
	YO_API_KEY : "INSERT KEY HERE",
	YO_API_SEND_URL : "https://api.justyo.co/yo/"
});

var app = express();
app.use(morgan('dev'));
app.use("/", express.static(__dirname + "/public"));

// GET Endpoint triggered as the yo application callback
// YO will call this and supply the username as a querystring
app.get("/yo", function(req, res) {
	var username = req.query.username;
	var link = req.query.link;

	console.log("Thanks.");
	res.send("Thanks.");
});

app.get("/message", function(req, res) {
	res.send(req.query);
});

app.listen(config.get("PORT"), function(err) {
	if(err)
		return console.error("Error - " + err);
	console.log("Listening on " + config.get("PORT"));
});
