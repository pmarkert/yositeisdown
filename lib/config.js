module.exports = function(defaults) {

	// Load configuration taking preference for command-line arguments, then environment settings, 
	// and then either a user-specified config file or else the default "config.json"
	var config = require("nconf");
	config
		.argv()
		.env()
		.file(config.get("config") || "config.json")
		.defaults(defaults);
	return config;
}
