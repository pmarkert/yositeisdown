(function() {
	var app = angular.module('dashboardApp', []);
	var username = location.search.substr(1);

	app.controller('LinkController', [ '$log', '$http', function($log, $http) {
		var self = this;
		self.links = [];
		self.editing = null;

		self.add = function() {
			link = { _id : null, username : username };
			self.links.push(link);
			self.editing = link;
		}

		self.edit = function(link) {
			self.editing = link;
		}

		self.save = function(link) {
			$log.log("Saving - " + JSON.stringify(link));
			$http.post('/api/link', link).success(function(result) { $log.log(result); });
		};

		self.cancel = function(link) {
			if(!link._id) self.links.pop();
			self.editing = null;
		}

		$http.get('/api/links?username=' + username).success(function(data) {
			self.links = data;
		});
	}]);
}());
