var languageFile = require('./lang');
var comprehension = require('../comprehension')['base'];

module.exports = function (bot, controller, persona) {

	var lang = languageFile[persona];


	controller.hears(comprehension['shutdown'], 'direct_message', function (bot, message) {

		bot.startConversation(message, function (err, convo) {

			convo.ask(lang['are-you-sure'], [
				{
					pattern: bot.utterances.yes,
					callback: function (response, convo) {
						convo.say(lang['confirm']);
						convo.next();
						setTimeout(function () {
							process.exit();
						}, 3000);
					}
				},
				{
					pattern: bot.utterances.no,
					default: true,
					callback: function (response, convo) {
						convo.say(lang['cancel']);
						convo.next();
					}
				}
			]);
		});
	});

//this gets done by a scheduled task in the running-late task
	controller.hears(comprehension['remove-data-late'], 'direct_message', function (bot, message) {
		controller.storage.users.all(function (err, msgs) {
			bot.reply(message, 'Clearing list..');
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
}
