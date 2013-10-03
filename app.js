bus = {
	title: 'title1',
	title1: document.getElementById('title1'),
	title2: document.getElementById('title2')
}
bus.request = {
	location: function (settings) {
		if (!navigator.geolocation) {
			bus.ui.switchTitle('Dein Gerät hat leider kein GPS.');
			return;
		}
		var afterPositionFetched 	= function(position) {
			console.log(position)
			if (settings.callback) {
				settings.callback({coords: position.coords});
			}
		}
		var positionNotFetched 		= function() {
			bus.ui.switchTitle('Position konnte nicht bestimmt werden.')
		}
		navigator.geolocation.getCurrentPosition(afterPositionFetched, positionNotFetched);
	},
	station: function(settings) {
		var data =  {
			type: 'station',
			limit: 15
		}
		if (settings.coords) {
			bus.ui.switchTitle('Die nächste Station wird gesucht...');
			data.x = settings.coords.latitude;
			data.y = settings.coords.longitude;
		}
		else {
			bus.ui.switchTitle('Station wird gesucht...');
			data.query = settings.query;
		}
		
		$.ajax({
			url: 'http://transport.opendata.ch/v1/locations',
			data: data,
			success: function(data) {
				if (data.stations.length == 0) {
					bus.ui.switchTitle('Keine Haltestellen in der Nähe gefunden.');
					return;
				}
				bus.ui.switchTitle('Wann kommt mein Bus?')
				var location = {
					stop: data.stations.splice(0,1)[0],
					nearby: data.stations
				}
				bus.ui.clearScreen();
				bus.ui.setStop(location);
			},
			error: function() {
				bus.ui.switchTitle('Anfrage fehlgeschlagen.')
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
					connections 		= _.map(connections,			function (connection) { 
						connection.stop.until = bus.ui.fixTimeZone(connection.stop.departure);
						return connection
					}),
					connections 		= _.map(connections, 			function (connection) { connection.stop = _.pick(connection.stop, 'platform', 'departure', 'until', 'location'); return connection }),
					connections 		= _.groupBy(connections,		function (connection) { return connection.to }),
					connections 		= _.map(connections, 			function (connection) { return _.groupBy(connection, function (bus) { return bus.name }); });
				bus.ui.createBoard(connections);
			},
			error: function() {
				bus.ui.switchTitle('Anfrage fehlgeschlagen.')
			}
		})
	},
	ride: function (stop) {
		bus.ui.switchTitle('Lade Informationen...')
		$.ajax({
			url: 'http://transport.opendata.ch/v1/connections',
			data: {
				from: stop.start,
				to: stop.end,
				date: stop.date.substr(0, 10),
				time: stop.date.substr(11, 16)
			},
			dataType: 'json',
			success: function (data) {
				var passList = data.connections[0].sections[0].journey.passList;
				console.log('passList:', passList)
				passList = _.map(passList, function (connection) { 
					connection.until = bus.ui.fixTimeZone(connection.departure || connection.arrival);
					return connection;
				});
				bus.ui.createRide(passList);
				bus.ui.switchTitle('Wann kommt mein Bus?')
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
			string += Math.floor(seconds) + " sec";
		}
		return string;
	},
	timeLeftToNumber: function(miliseconds) {
		var seconds = miliseconds/1000,
			minutes = seconds/60;
		if (seconds <= 0) {
			return {unit: '', 			number: 'jetzt', available: true}
		}
		if (seconds < 1) {
			return {unit: 'Sekunde', 	number: 1}
		}
		if (seconds < 60) {
			return {unit: 'Sekunden', 	number: Math.floor(seconds)}
		}
		if (seconds < 120) {
			return {unit: 'Minute', 	number: 1}
		}
		if (minutes < 60) {
			return {unit: 'Minuten', 	number: Math.floor(seconds/60)}
		}
		if (minutes < 120) {
			return {unit: 'Stunde', 	number: 1}
		}
		else {
			return {unit: 'Stunden', 	number: Math.floor(minutes/60)}
		}
	},
	parseStation: function(station) {
		commaindex = station.indexOf(', ')
		if (commaindex != -1) {
			var realstation = station.substr(commaindex + 1);
			var location = station.substr(0, commaindex);
			return realstation + '<small> ' + location + '</small>'
		}
		else {
			return station;
		}
	},
	parseType: function(type) {
		if (type == 'NFO') {
			return 'Trolleybus'
		}
		if (type == 'NFB') {
			return 'Niederflurbus'
		}
		if (type == 'TRO') {
			return 'Trolleybus'
		}
		if (type.substr(0,1) == 'S') {
			return 'S-Bahn'
		}
		if (type == 'RE') {
			return 'RegionalExpress'
		}
		if (type == 'R') {
			return 'Regionalzug'
		}
		if (type == 'BUS') {
			return 'Bus';
		}
		if (type == 'T') {
			return 'Tram';
		}
		if (type == 'NFT') {
			return 'Niederflurtram';
		}
		if (type == 'IR') {
			return 'Interregio'
		}
		if (type == 'EC') {
			return 'EuroCity'
		}
		if (type == 'ICN') {
			return 'InterCity Neigezug'
		}
		if (type == 'BAT') {
			return 'Schiff'
		}
		if (type == 'TGV') {
			return 'Train à Grande Vitèsse (TGV)'
		}
		if (type == 'ICE') {
			return 'InterCity Express'
		}
		if (type == 'RJ') {
			return 'RailJet'
		}
		if (type == 'EN') {
			return 'EuroNight'
		}
		if (type == 'CNL') {
			return 'City Night Line'
		}
		if (type == 'SN') {
			return 'S-Bahn Nachtlinie'
		}
		if (type == 'D') {
			return 'Schnellzug'
		}
		if (type == 'EXT') {
			return 'Extrazug'
		}
		if (type == 'LB') {
			return 'Luftseilbahn'
		}
		return type;
	},
	getTypeIdentifier: function(bus) {
		var categories = [null, 'train', 'train', 'train', 'ship', 'train', 'bus', 'cableway', 'Train', 'tram'];
		return categories[bus.categoryCode];
	},
	getTypeString: function(bus) {
		var categories = [null, 'Dein Zug', 'Dein Zug', 'Dein Zug', 'Dein Schiff', 'Dein Zug', 'Dein Bus', 'Deine Bahn', 'Train', 'Dein Tram'];
		return categories[bus.categoryCode]
	},
	updateTimeLeft: function(id, until, categoryCode) {
		if (until > 0) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 1000, categoryCode)
			}, 1000)
		}
	},
	updateLabel: function(id, until, subtract, categoryCode) {
		until -= subtract;
		var time = bus.helpers.timeLeftToNumber(until)
		var html = _.template(bus.templates.time, {time: time, id: id, category: categoryCode});
		var query = document.querySelector('[data-id="' + id + '"]');
		$(query).replaceWith(html);
		if (until <= 0) {
			return;
		}
		else if (until < 60001) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 1000, categoryCode)
			}, 1000);
			return;
		}
		else if (60000 < until < 120000) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, until - 60000, categoryCode)
			}, until - 60000);
			return;
		}
		else if (119999 < until < 3600000) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 60000, categoryCode)
			}, 60000);
			return;
		}
		else {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 3600000, categoryCode)
			}, 3600000)
			return;
		}
	},
	isoFix: function (string) {
		var string = string.replace(/�/g, 'ü');
		return string;
	}
}
bus.ui = {
	setStop: function(data) {
		data.helpers = bus.helpers;
		bus.ui.clearScreen();
		var html = _.template(bus.templates.busstop, data);
		$('#tiles').append(html);
		bus.request.board(data.stop);
	},
	createBoard: function(connections) {
		var html = _.template(bus.templates.board, {connections: connections, helpers: bus.helpers });
		$('#tiles').append(html);
		document.getElementsByClassName('destination')[0].style.display = 'block';

	},
	createRide: function (data) {
		var random = Math.floor(Math.random()*10000000),
			html = _.template(bus.templates.ride, {data: data, random: random});
		$('.tile').remove()
		$('#tiles').append(html);
		bus.ui.updateRide({id: random, data: data});
	},
	updateRide: function (obj) {
		var ride = document.querySelector('[data-ride="' + obj.id + '"]'),
			segmentfound = false,
			place = _.each(obj.data, function (stop, key) {
			var next = obj.data[key+1];
			if (next != undefined) {
				var nextstation = bus.ui.fixTimeZone(next.arrival ? next.arrival : next.departure),
					prevstation = bus.ui.fixTimeZone(stop.arrival || stop.departure);
				if (nextstation < 0) {
					$(ride).find('.stationspacefill').eq(key).css('height', '100%')
				}
				if (nextstation > 0 && prevstation < 0) {
					if (segmentfound) { return; }
					segmentfound = true;
					progress = Math.abs(prevstation) / (Math.abs(prevstation) + nextstation);
					console.log(progress);
					$(ride).find('.stationspacefill').eq(key).css('height', progress*100 + '%')
				}
			}
		});
		setTimeout(function() {
			bus.ui.updateRide(obj)
		}, 500);
	},
	setUpEvents: function() {
		$(document)
		.on('click', '.reveal-stops', 	bus.ui.revealStops 	)
		.on('click', '.reveal-map', 	bus.ui.revealMap 	)
		.on('click', '.busstop', 		bus.ui.changeStop 	)
		.on('click', '.busreveal',		bus.ui.revealBoard 	)
		.on('click', '.search-stop', 	bus.ui.searchStop 	)
		.on('click', '.boarding', 		bus.ui.boarding		)
	},
	searchStop: function() {
		var input = prompt('Station eingeben:');
		bus.request.station({query: input});
	},
	revealStops: function() {
		this.style.display = 'none';
		document.getElementsByClassName('nearby-busstops')[0].style.display = 'block';
	},
	revealMap: function() {
		document.getElementById('map').style.display = 'block';
		$('.reveal-map').hide();
	},
	changeStop: function() {
		bus.ui.setStop({stop: this.dataset, nearby: []});
	},
	clearScreen: function() {
		$(document.getElementsByClassName('tile')).remove();
	},
	revealBoard: function() {
		$(this).next('.destination').show().siblings('.destination').hide();
	},
	boarding: function () {
		bus.request.ride(this.dataset);
	},
	switchTitle: function(text) {
		if (bus.title == 'title1') {
			bus.title = 'title2';
			$(bus.title1).hide();
			$(bus.title2).text(text).show();
		}
		else {
			bus.title = 'title1';
			$(bus.title2).hide()
			$(bus.title1).text(text).show();
		}
	},
	fixTimeZone: function (date) {
		if (typeof date == 'object') {
			var a = date - new Date()
		}
		else {
			var a = (new Date(date.substr(0, 19)) - new Date());
			if (/WebKit/.test(navigator.userAgent)) {
				a -= 120*60*1000;
			}
		}
		return a;
	}
}
bus.templates = {
	busstop: [
		"<div class='tile busstop-tile'>",
			"<h2>Du bist bei</h2>",
			"<h1><%= helpers.parseStation(stop.name) %></h1>",
			"<div id='map'>",
				"<img onload=$(\'.busstop-tile\').addClass(\'ready\') class='map' src='//maps.googleapis.com/maps/api/staticmap?center=<%= stop.x || stop.coordinate.x %>,<%= stop.y || stop.coordinate.y %>&zoom=15&size=<%= document.body.clientWidth - 10 %>x180&sensor=true&zoom=14&scale=2'>",
				"<div class='blue-circle'></div>",
				"<div class='bus-symbol'><div class='bus-icon'></div></div>",
			"</div>",
			"<div class='list'>",
				"<div class='reveal reveal-map'>Karte anzeigen</div>",
			"</div>",
			"<% if (nearby.length != 0) { %>",
				"<div class='list'>",
					"<div class='reveal reveal-stops'>Andere Haltestellen</div>",
				"</div>",
				"<div class='list nearby-busstops'>",
					"<% _.each(nearby, function (stop) { %>",
						"<div class='option busstop' data-id='<%= stop.id %>' data-name='<%= stop.name %>' data-x='<%= stop.coordinate.x %>' data-y='<%= stop.coordinate.y %>'><%= helpers.parseStation(stop.name) %></div>",
					"<% }); %>",
					"<div class='list'>",
						"<div class='reveal search-stop'>Haltestelle suchen</div>",
					"</div>",
				"</div>",
			"<% } %>",
		"</div>"
	].join('\n'),
	board: [
		"<div class='tile board'>",
			"<% console.log(connections) %>",
			"<div class='list'>",
				"<% _.each(connections, function (connection) { %>",
					"<% _.each(connection, function (line) { %>",
						"<div class='option busreveal'>",
							"<%= helpers.parseStation(line[0].to) %>",
							"<% if (helpers.getTypeIdentifier(line[0]) == 'bus') { %>",
								"<span class='linenumber'><%= line[0].number %></span>",
							"<% } %>",
							"<% if (helpers.getTypeIdentifier(line[0]) == 'tram') { %>",
								"<span class='linenumber'><%= line[0].number %></span>",
							"<% } %>",
							"<% if (helpers.getTypeIdentifier(line[0]) == 'train') { %>",
								"<span class='linenumber train'><img src='img/train.svg' /></span>",
							"<% } %>",
							"<% if (helpers.getTypeIdentifier(line[0]) == 'ship') { %>",
								"<span class='linenumber ship'><img src='img/ship.svg' /></span>",
							"<% } %>",
						"</div>",
						"<div class='destination'>",
							"<% var first = line.splice(0,1)[0]; console.log(first) %>",
							"<% var time = helpers.timeLeftToNumber(first.stop.until), id = Math.floor(Math.random()*1000000) %>",
							"<% helpers.updateTimeLeft(id, first.stop.until, first.categoryCode) %>",
							"<table>",
								"<td>",
									"<%= _.template(bus.templates.time, {time: time, id: id, category: first.categoryCode}) %>",
									"<div class='list'>",
										"<div class='reveal boarding' data-start='<%= first.stop.location.id %>' data-end='<%= first.to %>' data-date='<%= first.stop.departure %>'>Einsteigen</div>",
									"</div>",
								"</td>",
								"<td>",
									"<% if (line.length != 0) { %>",
										"<div id='moreconnections'>",
											"<h2>Weitere Verbindungen</h2>",
											"<ul>",
												"<% _.each(line, function(bus) { %>",
													"<li>",
														"<span><%= helpers.getTimeUntilFromDate(bus.stop.until) %> <span>(<%= helpers.timeLeftToString(bus.stop.until) %>)</span></span>",
													"</li>",
												"<% }); %>",
											"</ul>",
										"</div>",
									"<% } %>",
								"</td>",
							"</table>",
						"</div>",
					"<% }); %>",
				"<% }); %>",
			"</div>",
			"<div class='dot'></div>",
		"</div>"
	].join('\n'),
	time: [
		"<div id='leftpane' data-id='<%= id %>'>",
			"<% if (!time.available) { %>",
				"<div class='time-wrapper'>",
					"<h2>Abfahrt in</h2>",
					"<h1>",
						'<%= time.number %> <p><%= time.unit %></p>',
					"</h1>",
				"</div>",
			"<% } else { %>",
				"<% var cat = bus.helpers.getTypeIdentifier({categoryCode: category});", 
				"var categoryString = bus.helpers.getTypeString({categoryCode: category}); %>",
				"<h2><%= categoryString %> ist da!</h2><br>",
				"<% if (cat == 'bus') { %>",
					"<img src='img/busblack.svg' class='slidein'>",
				"<% } %>",
				"<% if (cat == 'tram') { %>",
					"<img src='img/tram.svg' class='scalein'>",
				"<% } %>",
				"<% if (cat == 'ship') { %>",
					"<img src='img/ship.svg' class='slidein'>",
				"<% } %>",
				"<% if (cat == 'train') { %>",
					"<img src='img/trainblack.svg' class='slidein'></img>",
				"<% } %>",
			"<% } %>",
		"</div>"

	].join('\n'),
	ride: [
		"<div class='tile'>",
			"<h2>Du bist im Bus von</h2>",
			"<h3><%= bus.helpers.isoFix(data[0].station.name) %> <span class='lighttext'>nach</span> <%= bus.helpers.isoFix(_.last(data).station.name) %></h3>",
		"</div>",
		"<div class='tile nomargin' data-ride='<%= random %>'>",
			"<ul class='ride-stops'>",
				"<div class='ride-dot first-dot'></div>",
					"<% _.each(data, function(stop, index) { %>",
						"<li class='ride-stop'>",
							"<% if (index != data.length-1) {%>",
								"<div class='stationspace'>",
									"<div class='stationspacefill'></div>",
								"</div>",
							"<% } %>",
							"<span class='bus-stop-time'><%= bus.helpers.getTimeUntilFromDate(stop.until) %></span>",
							"<%= bus.helpers.parseStation(bus.helpers.isoFix(stop.station.name)) %>",
						"</li>",
					"<% }); %>",
				"<div class='ride-dot last-dot'></div>",
			"</ul>",
		"</div>"
	].join('\n')
}