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
			return {unit: 's', 	number: 1}
		}
		if (seconds < 60) {
			return {unit: 's', 	number: Math.floor(seconds)}
		}
		if (seconds < 120) {
			return {unit: 'min', 	number: 1}
		}
		if (minutes < 60) {
			return {unit: 'min', 	number: Math.floor(seconds/60)}
		}
		if (minutes < 120) {
			return {unit: 'h', 	number: 1}
		}
		else {
			return {unit: 'h', 	number: Math.floor(minutes/60)}
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
			return 'Du fährst mit einem Trolleybus.'
		}
		if (type == 'NFB') {
			return 'Du fährst mit einem Niederflurbus.'
		}
		if (type == 'TRO') {
			return 'Du fährst mit einem Trolleybus.'
		}
		if (type.substr(0,1) == 'S') {
			return 'Dies ist eine S-Bahn-Linie.'
		}
		if (type == 'RE') {
			return 'Dieser Zug ist ein RegioExpress.'
		}
		if (type == 'R') {
			return 'Dieser Zug ist ein Regionalzug.'
		}
		if (type == 'BUS') {
			return '';
		}
		if (type == 'T') {
			return '';
		}
		if (type == 'NFT') {
			return 'Es handelt sich um ein rollstuhlfreundliches Niederflurtram.';
		}
		if (type == 'IR') {
			return 'Der Zug ist ein Interregio.'
		}
		if (type == 'EC') {
			return 'Dies ist eine EuroCity-Linie.'
		}
		if (type == 'ICN') {
			return 'Zuggattung: InterCity Neigezug.'
		}
		if (type == 'BAT') {
			return ''
		}
		if (type == 'TGV') {
			return 'Dies ist ein TGV-Zug.'
		}
		if (type == 'ICE') {
			return 'Dieser Zug ist ein InterCity Express.'
		}
		if (type == 'RJ') {
			return 'Dieser Zug ist ein RailJet.'
		}
		if (type == 'EN') {
			return 'Dies ist ein Nachtreisezug.'
		}
		if (type == 'CNL') {
			return 'Zuggattung: City Night Line.'
		}
		if (type == 'SN') {
			return 'Dies ist eine S-Bahn Nachtlinie.'
		}
		if (type == 'D') {
			return 'Dies ist ein Schnellzug.'
		}
		if (type == 'EXT') {
			return 'Achtung: Dies ist Extrazug.'
		}
		if (type == 'LB') {
			return 'Es handelt sich um eine Luftseilbahn.'
		}
		if (type == 'N' || type == 'P') {
			return 'Dies ist ein Nahverkehrzug.'
		}
		return type;
	},
	getTypeIdentifier: function(bus) {
		var categories = [null, 'train', 'train', 'train', 'ship', 'train', 'bus', 'cableway', 'Train', 'tram'];
		return categories[bus.categoryCode];
	},
	getTypeString: function(bus) {
		var categories = [null, 'Dein Zug', 'Dein Zug', 'Dein Zug', 'Dein Schiff', 'Dein Zug', 'Dein Bus', 'Deine Bahn', 'Dein Zug', 'Dein Tram'];
		return categories[bus.categoryCode];
	},
	getTypeStringPlural: function(bus) {
		var categories = [null, 'Züge', 'Züge', 'Züge', 'Schiffe', 'Züge', 'Busse', 'Bahnen', 'Züge', 'Tramme'];
		return categories[bus.categoryCode];
	},
	getTypeStringOneMore: function(bus) {
		var categories = [null, 'Ein weiterer Zug', 'Ein weiterer Zug', 'Der nächste Zug', 'Das nächste Schiff', 'Ein weiterer Zug', 'Ein weiterer Bus', 'Die nächste Bahn', 'Der nächste Zug', 'Ein weiteres Tram'];
		return categories[bus.categoryCode];
	},
	updateTimeLeft: function(id, until, categoryCode, date) {
		if (until > 0) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 1000, categoryCode, date)
			}, 1000)
		}
	},
	updateLabel: function(id, until, subtract, categoryCode, date) {
		console.log(date);
		var until = bus.ui.fixTimeZone(date);
		var time = bus.helpers.timeLeftToNumber(until);
		var html = _.template(bus.templates.time, {time: time, id: id, category: categoryCode});
		var query = document.querySelector('[data-id="' + id + '"]');
		$(query).replaceWith(html);
		if (until <= 0) {
			return;
		}
		else if (until < 60001) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 1000, categoryCode, date)
			}, 1000);
			return;
		}
		else if (60000 < until < 120000) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, until - 60000, categoryCode, date)
			}, until - 60000);
			return;
		}
		else if (119999 < until < 3600000) {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 60000, categoryCode, date)
			}, 60000);
			return;
		}
		else {
			setTimeout(function() {
				bus.helpers.updateLabel(id, until, 3600000, categoryCode, date)
			}, 3600000)
			return;
		}
	},
	isoFix: function (string) {
		var string = string.replace(/�/g, 'ü');
		return string;
	},
	coordinateCalculator: function(lat1, lat2, lon1, lon2) {
		var R = 6378.137; // km
		var dLat = (lat2-lat1).toRad();
		var dLon = (lon2-lon1).toRad();
		var lat1 = lat1.toRad();
		var lat2 = lat2.toRad();

		var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		        Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2); 
		var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
		var d = R * c;
		return d;
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
		$('.tile').addClass('invisible');
		$('header').addClass('enable-back');
		$('#tiles').append(html);
		bus.ui.updateRide({id: random, data: data});
	},
	updateRide: function (obj) {
		var ride = document.querySelector('.ride[data-ride="' + obj.id + '"]'),
			segmentfound = false,
			spaceprogress,
			nextstationkey;
		_.each(obj.data, function (stop, key) {
			var next = obj.data[key+1];
			if (next != undefined) {
				var nextstation = bus.ui.fixTimeZone(next.arrival ? next.arrival : next.departure),
					prevstation = bus.ui.fixTimeZone(stop.arrival || stop.departure);
				if (nextstation < 0) {
					$(ride).find('.stationspacefill').eq(key).css('height', '100%')
				}
				if (nextstation > 0 && prevstation < 0) {
					if (segmentfound) { return; }
					$('.activestation').removeClass('activestation')
					var busstop = $(ride).find('.ride-stop').eq(key+1)[0];
					if (!busstop.classList.contains('activestation')) {
						var active = document.querySelector('.activestation');
						if (active) {
							active.classList.remove('activestation');
						}
						busstop.classList.add('activestation');
					}
					segmentfound = true;
					spaceprogress = Math.abs(prevstation) / (Math.abs(prevstation) + nextstation);
					nextstationkey = key;
					$(ride).find('.stationspacefill').eq(key).css('height', spaceprogress*100 + '%')
				}
			}
		});
		var firstdeparture = obj.data[0].departure,
			untilfirstdeparture = bus.ui.fixTimeZone(firstdeparture);
		if (untilfirstdeparture > 0) {
			var timeleft = bus.helpers.timeLeftToNumber(untilfirstdeparture);
			$('.timer').text(timeleft.number + ' ' + timeleft.unit);
		}
		else {
			$('.before-departure').removeClass('before-departure');
			var lastarrival = _.last(obj.data).arrival;
			untillastarrival = bus.helpers.timeLeftToNumber(bus.ui.fixTimeZone(lastarrival));
			$('.timer').text('Ankunft in '+ untillastarrival.number + ' ' + untillastarrival.unit);
			var totaldistance = _.reduce(obj.data, function (memo, location, key) {
				if (!obj.data[key+1]) {return memo;}
				var distance = bus.helpers.coordinateCalculator(location.location.coordinate.y, obj.data[key+1].location.coordinate.y, location.location.coordinate.x, obj.data[key+1].location.coordinate.x);
				return memo + distance
			}, 0)*1.15;
			var distanceridden = _.reduce(obj.data, function (memo, location, key) {
				if (!obj.data[key+1]) { return memo; }
				if (key-1 > nextstationkey) { return memo; }
				var prog = bus.ui.fixTimeZone(obj.data[key+1].arrival || obj.data[key+1].departure);
				var distance = bus.helpers.coordinateCalculator(location.location.coordinate.y, obj.data[key+1].location.coordinate.y, location.location.coordinate.x, obj.data[key+1].location.coordinate.x);
				if (prog < 0) {
					return memo + distance
				}
				else {
					return memo + distance*spaceprogress;
				}
			}, 0)*1.15;
			$('.top-ride-tile').html(_.template(bus.templates.rideinfos, {time: untillastarrival, distanceridden: distanceridden, totaldistance: totaldistance}))
		}
		setTimeout(function() {
			bus.ui.updateRide(obj)
		}, 1000);
	},
	setUpEvents: function() {
		$(document)
		.on('click', '.reveal-stops', 	bus.ui.revealStops 	)
		.on('click', '.reveal-map', 	bus.ui.revealMap 	)
		.on('click', '.busstop', 		bus.ui.changeStop 	)
		.on('click', '.busreveal',		bus.ui.revealBoard 	)
		.on('click', '.search-stop', 	bus.ui.searchStop 	)
		.on('click', '.boarding', 		bus.ui.boarding		)
		.on('click', '#back',			bus.ui.back 		)
	},
	back: function() {
		$('header').removeClass('enable-back');
		$('.tile:visible').remove();
		$('.tile').removeClass('invisible');
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
			if (/WebKit/.test(navigator.userAgent) && date.substr(20) == '0200') {
				a -= 120*60*1000;
			}
			else if (/WebKit/.test(navigator.userAgent) && date.substr(20) == '0100') {
				a -= 60*60*1000;
			}
		}
		return a;
	}
}
bus.templates = {
	busstop: [
		"<div class='tile busstop-tile'>",
			"<h2>Dein Standort</h2>",
			"<h1><%= helpers.parseStation(stop.name) %></h1>",
			"<div id='map'>",
				"<img onload=$(\'.busstop-tile\').addClass(\'ready\') class='map' src='//maps.googleapis.com/maps/api/staticmap?center=<%= stop.x || stop.coordinate.x %>,<%= stop.y || stop.coordinate.y %>&zoom=15&size=<%= document.body.clientWidth - 10 %>x180&sensor=true&zoom=14&scale=2'>",
				"<div class='blue-circle'></div>",
				"<div class='bus-symbol'><div class='bus-icon'></div></div>",
			"</div>",
			"<table class='buttons'>",
				"<tr>",
					"<td><button class='reveal-map'>Karte anzeigen</button></td>",
					"<td><button class='reveal-stops'>Andere Haltestellen</button></td>",
				"</tr>",
			"</table>",
			"<% if (nearby.length != 0) { %>",
				"<div class='list nearby-busstops'>",
					"<% _.each(nearby, function (stop) { %>",
						"<div class='option busstop' data-id='<%= stop.id %>' data-name='<%= stop.name %>' data-x='<%= stop.coordinate.x %>' data-y='<%= stop.coordinate.y %>'><%= helpers.parseStation(stop.name) %></div>",
					"<% }); %>",
					"<button class='search-stop'>Haltestelle suchen</button>",
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
							"<% var first = line.splice(0,1)[0]; %>",
							"<% var time = helpers.timeLeftToNumber(first.stop.until), id = Math.floor(Math.random()*1000000) %>",
							"<% helpers.updateTimeLeft(id, first.stop.until, first.categoryCode, first.stop.departure) %>",
							"<%= _.template(bus.templates.time, {time: time, id: id, category: first.categoryCode}) %>",
							"<p><%= bus.helpers.parseType(first.category) %>",
							"<% if (line.length != 0) { %>",
									"<% if (line.length == 1) { %>",
										"<%= helpers.getTypeStringOneMore({categoryCode: first.categoryCode}) %> fährt um <%= helpers.getTimeUntilFromDate(line[0].stop.until) %>.",
									"<% } else { %>",
										"Weitere <%= helpers.getTypeStringPlural({categoryCode: first.categoryCode}) %> fahren um ",
										"<% _.each(line, function(bus, key) { %>",
											"<%= helpers.getTimeUntilFromDate(bus.stop.until) %><% if (key == line.length -1 ) { %>.<% }%><% if (key+2 < line.length ) { %>,<% }%>",
											"<% if (key == line.length -2 ) { %>und<% }%>",
										"<% }); %>",
									"<% } %>",
							"<% } %>",
							"</p>",
							"<div class='list'>",
								"<button class='reveal boarding' data-start='<%= first.stop.location.id %>' data-end='<%= first.to %>' data-date='<%= first.stop.departure %>'>Einsteigen</button>",
							"</div>",
						"</div>",
					"<% }); %>",
				"<% }); %>",
			"</div>",
		"</div>"
	].join('\n'),
	time: [
		"<div id='leftpane' data-id='<%= id %>'>",
			"<% if (!time.available) { %>",
				"<div class='time-wrapper'>",
					"<h2>Abfahrt in</h2>",
					"<h1>",
						'<%= time.number %><span><%= time.unit %></span>',
					"</h1>",
				"</div>",
			"<% } else { %>",
				"<% var cat = bus.helpers.getTypeIdentifier({categoryCode: category});", 
				"var categoryString = bus.helpers.getTypeString({categoryCode: category}); %>",
				"<h2 class='center'><%= categoryString %> ist da!</h2><br>",
				"<div style='text-align: center'>",
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
				"</div>",
			"<% } %>",
		"</div>"

	].join('\n'),
	ride: [
		"<div class='tile before-departure top-ride-tile'>",
			"<div class='ride-dot'></div>",
			"<div class='stationspace toptile'></div>",
			"<h3 class='dotinfront'><%= bus.helpers.isoFix(data[0].station.name) %></h3>",
			"<p class='dotinfront lighttext'>Abfahrt in <span class='timer' data-ride='<%= random %>'>3 Minuten</span></p>",
		"</div>",
		"<div class='tile nomargin ride before-departure' data-ride='<%= random %>'>",
			"<ul class='ride-stops'>",
				"<div class='stationspace-extension'></div>",
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
	].join('\n'),
	rideinfos: [
		"<h2>Zeit verbleibend bis Endstation</h2>",
		"<h1><%= time.number %> <small><%= time.unit %></small></h1>",
		"<h2><span><%= Math.round(distanceridden*100)/100 %>/<%= Math.round(totaldistance*100)/100 %>km</span> - <span><%= Math.round(distanceridden/totaldistance*10000)/100 %>%</span></h2>"
	].join('\n')
}
Number.prototype.toRad = function() { return this * (Math.PI / 180); };