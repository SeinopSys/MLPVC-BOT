const
	unirest = require('unirest'),
	nth = require('nth'),
	Time = require('../classes/Time'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils'),
	config = require('../config');

module.exports = new Command({
	name: 'nextep',
	help: 'Returns the season, episode number and title of the next episode along with relative air time',
	perm: 'everyone',
	usage: [true],
	action: args =>{
		unirest.post(config.SITE_ABSPATH + 'episode/nextup')
			.header("Accept", "application/json")
			.end(function(result){
				if (result.error || typeof result.body !== 'object'){
					console.log(result.error, result.body);
					return Server.respond(args.channelID, util.replyTo(args.userID, 'Request to the website\'s API failed (HTTP ' + result.status + '). ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
				}

				const data = result.body;

				if (!data.status)
					return Server.respond(args.channelID, util.replyTo(args.userID, data.message));

				const
					which = data.episode === 1 ? 'first' : nth.appendSuffix(data.episode),
					when = Time.Remaining(new Date(), new Date(data.airs));
				let sentence = `The ${which} episode of season ${data.season} titled ${data.title} is going to air ${when}`;
				Server.respond(args.channelID, util.replyTo(args.userID, sentence));
			});
	}
});
