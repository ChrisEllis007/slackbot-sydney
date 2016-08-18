var languageFile = require('./lang');
var schedule = require('node-schedule');
var comprehension = require('../comprehension')['running-late'];

module.exports = function (bot, controller, persona) {

	var lang = languageFile[persona];


	//THIS NEEDS TO BE TESTED
	//clear sick/late/ooo list each day at midnight
	var j = schedule.scheduleJob('0 0 0 * *', function(){
		controller.storage.users.all(function (err, msgs) {
			console.log('Clearing list : ', msgs);
			if (Object.keys(msgs).length !== 0) {//is empty object?
				for (var msg in msgs) {
					var userMsg = msgs[msg];
					if (userMsg.task === 'running-late') {
						controller.storage.users.delete(userMsg.id, function(){
							console.log('deleted result : ', arguments);
						});
					}
				}
			}
		});
	});

	var haveTime = function (msg, expectedTime) {
		if (msg.search(/(minutes|mins|hour|(\s|\d)m\s|h\s)/g) != -1) {
			/*
			 I'll be about 30 minutes late
			 I'm an hour late
			 Running 10m late
			 1h late
			 train delayed 30mins
			 */
			//multiply number by 1 for minutes or 60 for hours
			var timeScale = msg.search(/(minutes|mins|(\s|\d)m\s)/g) != -1 ? 1 : 60,
				minutesLate = Number(msg.replace(/\D+/g, '')) * timeScale,
				expectedTime = expectedTime || new Date(),
				timeIn, hours;
			//TODO do some logic to see if we are after 9.30am
			expectedTime.setHours(9);
			expectedTime.setMinutes(30);
			timeIn = new Date(expectedTime.getTime() + minutesLate * 60000);
			hours = timeIn.getHours();
			var ampm = hours >= 12 ? 'pm' : 'am';
			hours = hours % 12;
			hours = hours ? hours : 12; // the hour '0' should be '12'
			//convert to time string
			var timeInPretty = hours + ':' + timeIn.getMinutes() + ampm;
			return timeInPretty;
		} else {
			return null;
		}
	};

	var confirmTime = function (message, prettyTime, userObj) {
		bot.startConversation(message, function (err, convo) {
			if (!err) {
				//'So you\'ll be in around ' + prettyTime + '?', [
				convo.ask(substitute(lang['in-around?'], prettyTime), [
					{
						pattern: bot.utterances.yes,
						callback: function (response, convo) {
							// since no further messages are queued after this,
							// the conversation will end naturally with status == 'completed'
							convo.next();
						}
					},
					{
						pattern: bot.utterances.no,
						callback: function (response, convo) {
							// stop the conversation. this will cause it to end with status == 'stopped'
							convo.stop();
						}
					},
					{
						default: true,
						callback: function (response, convo) {
							convo.repeat();
							convo.next();
						}
					}
				]);
				convo.on('end', function (convo) {

					if (convo.status == 'completed') {
						controller.storage.users.save(userObj, function (err, user) {
							bot.reply(message, lang['ok']);
						});
					} else if (convo.status == 'stopped') {
						userObj.status = "failed-to-understand";
						controller.storage.users.save(userObj, function (err, user) {
							bot.reply(message, lang['minor-error']);
						});
					} else {
						// this happens if the conversation ended prematurely for some reason
						bot.reply(message, lang['major-error']);
					}
				});
			}
		});
	};

	var substitute = function (string, values) {
		values = [].concat(values);//ensure it's an array
		values.forEach(function (str) {
			string = string.replace(/\@s/, str);
		});
		console.log('returning ', string);
		return string;
	};

	controller.hears(comprehension['who-is-late'], 'direct_message,direct_mention,mention', function (bot, message) {
		controller.storage.users.all(function (err, msgs) {
			if (Object.keys(msgs).length !== 0) {//is empty object?
				console.log('mshs = ', msgs);
				for (var msg in msgs) {
					var userMsg = msgs[msg];
					var str = userMsg.name + ' is ' + userMsg.reason + ' today.';
					if (userMsg.timeIn && userMsg.timeIn !== 'not-in') {
						str += ' ';
						str += substitute(lang['they-are-in-around'], userMsg.timeIn);
					}
					bot.reply(message, str);
				}
			} else {
				bot.reply(message, lang['nothing-to-report']);
			}
		});
	});

	controller.hears(comprehension['i-am-late'], 'direct_message,direct_mention,mention', function (bot, message) {
		controller.storage.users.get(message.user, function (err, user) {
			bot.api.users.info({
				token: process.env.token,
				user: message.user
			}, function (err, data) {
				if (err) {
					throw err
				}
				var userName = data.user.name,
					msg = message.text;
				// 'Thanks for letting me know ' + userName);

				bot.reply(message, substitute(lang['thanks'], userName));
				var prettyTime = haveTime(msg);
				if (prettyTime !== null) {

					//CHECK IF AFTER 9.30 - if so then moan
					confirmTime(message, prettyTime, {
						id: message.user,
						name: userName,
						timeIn: prettyTime,
						reason: 'late',
						status: 'complete'
					});
				} else {
					bot.startConversation(message, function (err, convo) {
						if (!err) {
							convo.ask(lang['how-late?'], function (response, convo) {
								var prettyTime = haveTime(response.text);
								if (prettyTime !== null) {
									confirmTime(message, prettyTime, {
										id: message.user,
										name: userName,
										timeIn: prettyTime,
										reason: 'late',
										status: 'complete'
									});
								}
								convo.next();
							});
						}
					});
				}
			});
		});
	});

	controller.hears(comprehension['i-am-out-today'], 'direct_message,direct_mention,mention', function (bot, message) {
		controller.storage.users.get(message.user, function (err, user) {
			bot.api.users.info({
				token: process.env.token,
				user: message.user
			}, function (err, data) {
				if (err) {
					throw err
				}
				var userName = data.user.name;
				var userObj = {
					id: message.user,
					task: 'running-late',
					name: userName,
					timeIn: 'not-in',
					reason: 'OOO',
					status: 'complete'
				};
				controller.storage.users.save(userObj, function (err, user) {
					bot.reply(message, substitute(lang['thanks'], userName));//'Thanks for letting me know ' + userName);
				});
			});
		});
	});

	controller.hears(comprehension['i-am-sick-today'], 'direct_message,direct_mention,mention', function (bot, message) {
		controller.storage.users.get(message.user, function (err, user) {
			bot.api.users.info({
				token: process.env.token,
				user: message.user
			}, function (err, data) {
				if (err) {
					throw err
				}
				var userName = data.user.name;
				var userObj = {
					id: message.user,
					task: 'running-late',
					name: userName,
					timeIn: 'not-in',
					reason: 'ill',
					status: 'complete'
				};
				controller.storage.users.save(userObj, function (err, user) {
					bot.reply(message, substitute(lang['you-are-ill'], userName));// + '.  I hope you\'re feeling better tomorrow.');
				});
			});
		});
	});

	controller.hears(comprehension['i-am-working-from-home'], 'direct_message,direct_mention,mention', function (bot, message) {
		controller.storage.users.get(message.user, function (err, user) {
			bot.api.users.info({
				token: process.env.token,
				user: message.user
			}, function (err, data) {
				if (err) {
					throw err
				}
				var userName = data.user.name;
				var userObj = {
					id: message.user,
					name: userName,
					task: 'running-late',
					timeIn: 'not-in',
					reason: 'WFH',
					status: 'complete'
				};
				controller.storage.users.save(userObj, function (err, user) {
					bot.reply(message, substitute(lang['recorded-you'], userName));//'Ok ' + userName + '. I\'ve recorded this for today.');
				});
			});
		});
	});
};
