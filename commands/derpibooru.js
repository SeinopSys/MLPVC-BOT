const
	unirest = require('unirest'),
	chalk = require('chalk'),
	Command = require('../classes/Command'),
	util = require('../shared-utils'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'derpibooru',
	help:
	'This command can be used to return the first result of a Derpibooru search.\n' +
	'**Note:** Any rooms aside from <#nsfw> will only show results accessible by the site\'s default filter. Using the command in a DM is the same as being in <#nsfw>\n\n' +
	'__**Bot-secific search keywords:**__\n\n' +
	' ● `o:<desc|asc>` - Order of the results (if ommited, defaults to `desc`)\n' +
	' ● `by:<score|relevance|width|height|comments|random|wilson>` - Same as "Sort by" on the actual site\n' +
	' ● `as:link` - Returns the link of the search with the specified parameters instead of the first matching result',
	usage: ['safe,o:asc', 'safe,rd o:asc', 'ts by:random'],
	perm: 'everyone',
	action: args =>{
		if (!args.argArr.length)
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, util.reqparams(args.command)));

		let query = args.argStr,
			extra = '',
			inNSFW = args.channelID === Server.channelids.nsfw || args.isPM,
			orderTest = /\bo:(desc|asc)\b/i,
			sortbyTest = /\bby:(score|relevance|width|height|comments|random|wilson)\b/i,
			asLinkTest = /\bas:link\b/i, returnAsLink = false;
		if (inNSFW)
			extra += '&filter_id=56027';
		if (sortbyTest.test(query)){
			let sortby = query.match(sortbyTest);
			query = query.replace(sortbyTest, '').trim();
			extra += '&sf=' + sortby[1];
			if (!query.length && sortby[1] === 'random'){
				console.log('Derpi search for random image (without tags)');
				return unirest.get('https://derpibooru.org/images/random.json')
					.header("Accept", "application/json")
					.end(function(result){
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return Server.respond(args.channelID, util.replyTo(args.userID, 'Derpibooru random image search failed (HTTP ' + result.status + '). ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
						}

						let data = result.body;
						if (typeof data.id === 'undefined')
							return Server.respond(args.channelID, util.replyTo(args.userID, 'Failed to get random Derpibooru image ID'));

						unirest.get('https://derpibooru.org/images/' + data.id + '.json')
							.header("Accept", "application/json")
							.end(function(result){
								if (result.error || typeof result.body !== 'object'){
									console.log(result.error, result.body);
									return Server.respond(args.channelID, util.replyTo(args.userID, 'Derpibooru random image data retrieval failed (HTTP ' + result.status + '). ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
								}

								Server.respondWithDerpibooruImage(args, result.body);
							});
					});
			}
		}
		if (asLinkTest.test(query)){
			returnAsLink = true;
			query = query.replace(asLinkTest, '').trim();
		}

		if (orderTest.test(query)){
			let order = query.match(orderTest);
			query = query.replace(orderTest, '').trim();
			extra += '&sd=' + order[1];
		}
		query = query.replace(/,{2,}/g, ',').trim().replace(/(^,|,$)/, '');
		let url = 'https://derpibooru.org/search.json?q=' + encodeURIComponent(query) + extra;
		if (returnAsLink)
			return Server.respond(args.channelID, util.replyTo(args.userID, url.replace('/search.json', '/search')));
		Server.bot.simulateTyping(args.channelID);
		console.log('Derpi search for ' + chalk.blue(url));
		unirest.get(url)
			.header("Accept", "application/json")
			.end(function(result){
				if (result.error || typeof result.body !== 'object'){
					console.log(result.error, result.body);
					return Server.respond(args.channelID, util.replyTo(args.userID, 'Derpibooru search failed (HTTP ' + result.status + '). ' + Server.mentionOwner(args.userID) + ' should see what caused the issue in the logs.'));
				}

				let data = result.body;
				if (typeof data.search === 'undefined' || typeof data.search[0] === 'undefined')
					return Server.respond(args.channelID, util.replyTo(args.userID, 'Derpibooru search returned no results.' +
						(
							/(explicit|questionable|suggestive)/.test(query) && !inNSFW ?
								` Searching for system tags other than \`safe\` is likely to produce no results outside the <#${Server.channelids.nsfw}> channel.` : ''
						) + ' Don\'t forget that artist and OC tags need to be prefixed with `artist:` and `oc:` respectively.'
					));

				Server.respondWithDerpibooruImage(args, data.search[0]);
			});
	},
});
