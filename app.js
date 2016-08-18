/*
 # RUN THE BOT:
 Run your bot from the command line:
 token=<MY TOKEN> node slack_bot.js

 # USE THE BOT:

 Find your bot inside Slack to send it a direct message.

 -> http://howdy.ai/botkit
 */

if (!process.env.token) {
	console.log('Error: Specify token in environment');
	process.exit(1);
}

var storageConfig = {path: 'data-store'};


var Botkit = require('botkit'),
	os = require('os'),
	myStorage = require('./storage')(storageConfig);

//add actions here when new ones are created
var actions = [
	'base',
	'running-late'
];
//add persona here when new ones are created
var personas = [
		'default'
	],
	persona;
//

var	controller = Botkit.slackbot({
	// debug: true
	// storage: myStorage
});

var bot = controller.spawn({
	token: process.env.token
}).startRTM(function () {
	/* TODO I don't think this is the best way to do this.  Not even sure it will really work if I want to reuse this
	 bot in multiple channels. */
	// set persona - maybe do in a language file
	bot.identifyBot(function (err, result){
		var botTeamId = result.team_id;
		controller.storage.teams.get(botTeamId, function (err, result) {
			if (result && result.persona) {
				persona = result.persona;
				loadActions();
			} else {
				//set for default for now
				//TODO make random personas on different days or make it set-able
				controller.storage.teams.save(
					{
						id:botTeamId,
						persona: personas[0]
					}, function () {
						persona = personas[0];
						loadActions();
					});
			}
		});
	});
});

function loadActions() {
	actions.forEach(function (action) {
		console.log('Loaded action:',action);
		require('./tasks/' + action + '/index')(bot, controller, persona);
	});
}