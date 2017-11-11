const
	unirest = require('unirest'),
	config = require('../config'),
	Command = require('../classes/Command'),
	Server = require('../classes/Server'),
	util = require('../shared-utils'),
	defineTimeLimit = 20000;

let defineCommandLastUsed;

module.exports = new Command({
	name: 'define',
	help: 'This command can be used to get definitions, synonyms and example usages of English words, powered by WordsAPI.\n**Note:** The API is free to use for up to 2500 requests per day. If exceeded, it has additional costs on a per-request basis, and as such it is rate limited to one use every 20 seconds. Only use this command when appropriate.',
	usage: ['sleep', 'apple pie', 'horse'],
	perm: 'everyone',
	action: args => {
		if (args.isPM)
			return Server.respond(args.channelID, util.onserver);

		if (!args.argArr.length)
			return Server.respond(args.channelID, util.replyToIfNotPM(args.isPM, args.userID, util.reqparams(args.command)));

		let delta;
		if (typeof defineCommandLastUsed === 'undefined')
			defineCommandLastUsed = Date.now();
		else if ((delta = Date.now() - defineCommandLastUsed) < defineTimeLimit && !Server.perm.isOwner.check(args.userID)){
			return Server.wipeMessage(args.channelID, args.event.d.id, function(){
				Server.respond(args.userID, 'The `define` command is limited to one use every '+(defineTimeLimit/1000)+' seconds due to monthly API request limits (which, after exceeded, cost money per each request). Try again in '+(Math.round((delta/100))/10)+'s');
			});
		}
		else defineCommandLastUsed = Date.now();

		if (args.channelID === Server.channelids['bot-sandbox'] && !Server.perm.isStaff.check(args.userID))
			return Server.respond(args.channelID, util.replyTo(args.userID, 'This command can only be used by members of the Staff role in <#'+args.channelID+'>. Please only use this command when neccessary as it\'s number of requests per day is limited.'));

		unirest.get("https://wordsapiv1.p.mashape.com/words/"+encodeURIComponent(args.argStr))
			.header("X-Mashape-Key", config.MASHAPE_KEY)
			.header("Accept", "application/json")
			.end(function (result) {
				if ((result.error || typeof result.body !== 'object') && result.status !== 404){
					console.log(result.error, result.body);
					return Server.respond(args.channelID, util.replyTo(args.userID, 'WordsAPI search failed (HTTP '+result.status+'). '+Server.mentionOwner(args.userID)+' should see what caused the issue in the logs.'));
				}

				let data = result.body;
				if (result.status === 404 || !data.results || data.results.length === 0)
					return Server.respond(args.channelID, util.replyTo(args.userID, 'WordsAPI search returned no results.'+(/s$/.test(args.argStr)?' Plural words can cause this issue. If you used a plural word, please use the singluar form instead.':'')));

				let defs = [];
				data.results.slice(0,4).forEach(function(def){
					defs.push(
						(data.results.length>1?(defs.length+1)+'. ':'')+def.partOfSpeech+' — '+def.definition+
						(def.examples&&def.examples.length?'\n\t\t__Examples:__ *“'+(def.examples.slice(0,2).join('”, “').replace(new RegExp('('+data.word+')','g'),'__$1__'))+'”*':'')+
						(def.synonyms&&def.synonyms.length?'\n\t\t__Synonyms:__ '+def.synonyms.slice(0,4).join(', '):''));
				});
				return Server.respond(args.channelID, util.replyTo(args.userID, '\n**'+data.word+'** • /'+data.pronunciation.all+'/'+(data.syllables&&data.syllables.list&&data.syllables.list.length>1?' • *'+data.syllables.list.join('-')+'*':'')+'\n'+(defs.join('\n\n'))));
			});
	},
});
