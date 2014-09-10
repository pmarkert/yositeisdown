(function() { 
	var app = angular.module('dashboardApp', []);

	app.controller('LinkController', [ '$log', '$http', function($log, $http) {
		var self = this;
		this.links = [];
		this.save = function(link) {
			$log.log("Saving - " + JSON.stringify(link));
			$http.post('/api/link', link).success(function(result) { $log.log(result); });
		};
		alert(location.search);
		$http.get('/api/links?username=' + location.search.substr(1)).success(function(data) {
			self.links = data;
		});
	}]);
}());
