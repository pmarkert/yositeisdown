var express = require("express");
var morgan = require("morgan");
var http = require("http");
var request = require("request");
var _ = require("underscore");
var mongodb = require("mongodb");
var bodyParser = require("body-parser");
var uuid = require("node-uuid");

var config = require("./lib/config")({
	PORT : 3000,
	YO_API_KEY : "INSERT KEY HERE",
	YO_API_SEND_URL : "https://api.justyo.co/yo/"
});

var app = express();
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use("/", express.static(__dirname + "/public"));

// GET Endpoint triggered as the yo application callback
// YO will call this and supply the username as a querystring
app.get("/yo", function(req, res) {
	var username = req.query.username;
	var link = req.query.link;
	
	if(link) {
		app.mongo.collection("link").save( { _id : uuid.v4(), username : username, url : link, name : null, active : 1 }, function(err, saved_link) {
			console.log("Saved - " + JSON.stringify(saved_link));
		});
	}
	else {
		console.log("Empty yo, send user to the dashboard.");
		res.send("Empty yo, send user to the dashboard.");
	}
});

app.get("/message", function(req, res) {
	res.send(req.query.m);
});

app.get("/error_report", function(req, res) {
	app.mongo.collection("error_report").findOne( { _id : req.query.id }, function(err, error_report) {
		if(err) {
			return res.send("Error reading report - " + err);
		}
		return res.json(error_report);
	});
});

app.get("/api/links", function(req, res) {
	var username = req.query.username;
	app.mongo.collection("link").find( { username : username }, function(err, links) {
		if(err) return res.json( { Error : err } );
		return links.toArray(function(err, arr) {
			res.json(arr);
		});
	});
});

app.post("/api/link", function(req, res) {
	app.mongo.collection("link").save(req.body, function(err, saved) {
		if(err) return res.json( { Error : err } );
		return res.json(saved);
	});
});

mongodb.MongoClient.connect(config.get("MONGOHQ_URL"), function(err, db) {
	if(err) {
		return console.log("Could not connect to MONGOHQ_URL");
	}
	app.mongo = db;
	app.listen(config.get("PORT"), function(err) {
		if(err)
			return console.error("Error - " + err);
		console.log("Listening on " + config.get("PORT"));
	});
});
