const
	YouTubeAPI = require('youtube-api'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils'),
	config = require('../config');

// This is needed so we don't hit the anonymous usage cap
YouTubeAPI.authenticate({
	type: "key",
	key: config.YT_API_KEY,
});

module.exports = new Command({
	name: 'youtube',
	help: 'Returns the first result of a YouTube sarch. Results are based on US region & English language preferences.',
	usage: ['hillary clinton meme queen 2016', 'harambe', 'darude sandstorm'],
	perm: 'everyone',
	action: args => {
		if (args.isPM)
			return Server.reply(args.message, util.onserver);

		if (!args.argArr.length)
			return Server.reply(args.message, util.reqparams(args.command));

		YouTubeAPI.search.list({
			part: 'snippet',
			q: args.argStr,
			type: 'video',
			maxResults: 1,
			regionCode: 'US',
			relevanceLanguage: 'en',
			safeSearch: args.channel.name === 'nsfw' ? 'none' : 'moderate',
		}, function(error, result) {
			if (error || typeof result.items === 'undefined'){
				console.error(error, result);
				return Server.reply(args.message, `YouTube search failed. ${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
			}

			if (typeof result.items[0] === 'undefined' || typeof result.items[0].id.videoId === 'undefined')
				return Server.reply(args.message, 'YouTube search returned no results.');

			Server.reply(args.message, `https://youtube.com/watch?v=${result.items[0].id.videoId}`);
		});
	},
});
