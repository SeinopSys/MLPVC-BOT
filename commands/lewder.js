const
	unirest = require('unirest'),
	Command = require('../classes/Command'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'lewder',
	help: 'Signal that the conversation is not lewd enough.',
	perm: 'everyone',
	usage: [true],
	action: args => {
		unirest.get('https://derpibooru.org/images/1308747.json')
			.header("Accept", "application/json")
			.end(function(result){
				if (result.error || typeof result.body !== 'object'){
					console.log(result.error, result.body);
					return Server.respond(args.channelID, util.replyTo(args.userID, 'Derpibooru image data retrieval failed (HTTP '+result.status+'). '+Server.mentionOwner(args.userID)+' should see what caused the issue in the logs.'));
				}

				Server.respondWithDerpibooruImage(args, result.body);
			});
	},
});
