bus = {}
bus.request = {
	location: function (settings) {
		if (!navigator.geolocation) {
			alert('Dein Gerät hat leider kein GPS.');
			return;
		}
		var afterPositionFetched 	= function(position) {
			console.log(position)
			if (settings.callback) {
				settings.callback({coords: position.coords});
			}
		}
		var positionNotFetched 		= function() {
			alert('Deine Position konnte nicht bestimmt werden. Hast du GPS aktiviert und der Verwendung des Standortes zugestimmt?');
		}
		navigator.geolocation.getCurrentPosition(afterPositionFetched, positionNotFetched);
	},
	station: function(settings) {
		bus.dom.setLoadingMessage('Die nächste Station wird gesucht.')
		$.ajax({
			url: 'http://transport.opendata.ch/v1/locations',
			data: {
				x: settings.coords.latitude,
				y: settings.coords.longitude,
				type: 'station',
				limit: 15
			},
			success: function(data) {
				if (data.stations.length == 0) {
					alert('Keine Haltestellen in der Nähe gefunden.');
				}
				var location = {
					stop: data.stations.splice(0,1)[0],
					nearby: data.stations
				}
				bus.ui.clearScreen();
				bus.ui.setStop(location);
			}
		})
	},
	board: function(stop) {
		$.ajax({
			url: 'http://transport.opendata.ch/v1/stationboard',
			data: {
				id: stop.id,
				limit: 20
			},
			success: function(data) {
				var connections 		= _.map(data.stationboard, 		function (connection) { return _.pick(connection, 'category', 'categoryCode', 'number', 'to', 'stop', 'name'); }),
					connections 		= _.map(connections,			function (connection) { connection.stop.until = (new Date(connection.stop.departure.substr(0, 19)) - new Date() - 120*60*1000); return connection }),
					connections 		= _.map(connections, 			function (connection) { connection.stop = _.pick(connection.stop, 'platform', 'departure', 'until'); return connection }),
					connections 		= _.groupBy(connections,		function (connection) { return connection.to }),
					connections 		= _.map(connections, 			function (connection) { return _.groupBy(connection, function (bus) { return bus.name }); });
				bus.ui.createBoard(connections);
			}
		})
	}
}

bus.dom = {
	setLoadingMessage: function (msg) {
		document.getElementById('loading-message').innerHTML = msg;
	}
}
bus.helpers = {
	getTimeUntilFromDate: function(date) {
		var date = new Date(date + new Date().getTime());
		var minutes = date.getMinutes();
		if (minutes < 10) {
			minutes = "0" + minutes
		}
		return date.getHours() + ":" + minutes;
	},
	timeLeftToString: function(miliseconds) {
		var seconds = miliseconds/1000;
		var minutes = seconds/60;
		var hours 	= Math.floor(minutes/60);
		var string 	= "";
		if (minutes > 60) {
			string += hours + " h ";
		}
		if (seconds > 120) {
			string += Math.floor(minutes-(hours*60)) + " min";
		}
		if (seconds > 60 && seconds <= 120) {
			string += "1 min";
		}
		if (seconds < 60) {
			string += "jetzt";
		}
		return string;
	},
	timeLeftToNumber: function(miliseconds) {
		var seconds = miliseconds/1000,
			minutes = seconds/60;
		if (seconds < 0) {
			return {unit: '', number: 'jetzt'}
		}
		if (seconds < 60) {
			return {unit: 'Sekunden', number: Math.floor(seconds)}
		}
		if (seconds < 120) {
			return {unit: 'Minute', number: 1}
		}
		if (minutes < 60) {
			return {unit: 'Minuten', number: Math.floor(seconds/60)}
		}
		if (minutes < 120) {
			return {unit: 'Stunde', number: 1}
		}
		else {
			return {unit: 'Stunden', number: Math.floor(minutes/60)}
		}
	},
	parseType: function(type) {
		if (type == 'NFO') {
			return 'Trolleybus'
		}
		if (type == 'NFB') {
			return 'Niederflurbus'
		}
		if (type.substr(0,1) == 'S') {
			return 'S-Bahn ' + type.substr(1);
		}
		if (type == 'RE') {
			return 'Regionalzug'
		}
		return type;
	}
}
bus.ui = {
	setStop: function(data) {
		bus.ui.clearScreen();
		var html = _.template(bus.templates.busstop, data);
		$(document.body).append(html);
		bus.request.board(data.stop);
	},
	touchUp: function(node, callback) {
		var one = $(node).one('mouseup', callback);
		var two = $(node).one('touchend', callback);
		$(document).on('scroll', function() {
			one.off();
			two.off();
			console.log('canceled')
		});
	},
	createBoard: function(connections) {
		console.log(connections)
		var html = _.template(bus.templates.board, {connections: connections, helpers: bus.helpers });
		$(document.body).append(html);
		document.getElementsByClassName('destination')[0].style.display = 'block';
	},
	setUpEvents: function() {
		$(document)
		.on('mousedown touchdown', '.reveal-stops', 	bus.ui.revealStops 	)
		.on('mousedown touchdown', '.busstop', 			bus.ui.changeStop 	)
		.on('mousedown touchdown', '.busreveal',		bus.ui.revealBoard 	)
	},
	revealStops: function() {
		bus.ui.touchUp(this, function() {
			this.style.display = 'none';
			document.getElementsByClassName('nearby-busstops')[0].style.display = 'block';
		});
	},
	changeStop: function() {
		bus.ui.touchUp(this, function() {
			bus.ui.setStop({stop: this.dataset, nearby: []});
		});
	},
	clearScreen: function() {
		$(document.getElementsByClassName('tile')).remove();
	},
	revealBoard: function() {
		bus.ui.touchUp(this, function() {
			$('.destination').hide();
			$(this).next('.destination').show()
		});
	}
}
bus.templates = {
	busstop: [
		"<div class='tile busstop-tile'>",
			"<h2>Du bist bei</h2>",
			"<h1><%= stop.name %></h1>",
			"<% if (nearby.length != 0) { %>",
				"<div class='list'>",
					"<div class='reveal reveal-stops'>Andere Haltestellen</div>",
				"</div>",
				"<div class='list nearby-busstops'>",
						"<% _.each(nearby, function (stop) { %>",
							"<div class='option busstop' data-id='<%= stop.id %>' data-name='<%=  stop.name%>'><%= stop.name %></div>",
						"<% }); %>",
				"</div>",
			"<% } %>",
		"</div>"
	].join('\n'),
	board: [
		"<div class='tile board'>",
			"<h2 class='center'>Busverbindungen</h2>",
			"<% console.log(connections) %>",
			"<div class='list'>",
				"<% _.each(connections, function (connection) { %>",
					"<% _.each(connection, function (line) { %>",
						"<div class='option busreveal'><%= line[0].to %> via <%= helpers.parseType(line[0].category) %></div>",
						"<div class='destination'>",
							"<% var first = line.splice(0,1)[0]; console.log(first) %>",
							"<h2>Dein Bus kommt in</h2>",
							"<h1><%= helpers.timeLeftToNumber(first.stop.until).number %> <span><%= helpers.timeLeftToNumber(first.stop.until).unit %></span></h1>",
							"<h2>Weitere Verbindungen</h2>",
							"<ul>",
								"<% _.each(line, function(bus) { %>",
									"<li>",
										"<span class='busnumber'><%= bus.number %></span>",
										"<span><%= helpers.getTimeUntilFromDate(bus.stop.until) %> <span>(<%= helpers.timeLeftToString(bus.stop.until) %>)</span></span>",
									"</li>",
								"<% }); %>",
							"</ul>",
						"</div>",
					"<% }); %>",
				"<% }); %>",
			"</div>",
		"</div>"
	].join('\n')
}