var Discord = require('discord.io'),
	config = require('./config'),
	bot = new Discord.Client({
		autorun: true,
		token: config.TOKEN,
	}),
	chalk = require('chalk'),
	replyTo = function(userID, message){
		return "<@"+userID+"> "+message;
	},
	respond = function(channelID, message){
		return bot.sendMessage({
			to: channelID,
			message: message,
		});
	},
	request = require('request'),
	readline = require('readline'),
	rl,
	getRl = function(){
		if (typeof rl === 'undefined')
			rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout
			});
		return rl;
	},
	moment = require('moment'),
	YouTube = require('youtube-node'),
	yt = new YouTube(),
	OurServer,
	exec;

yt.setKey(config.YT_API_KEY);

require("console-stamp")(console, {
	formatter: function(){
		return moment().format('YYYY-MM-DD HH:MM:ss.SSS');
	},
	label: false,
});

bot.on('ready', ready);

function ready(){
	var i;

	bot.setPresence({ idle_since: null });
	console.log('Logged in as '+bot.username);

	var serverIDs = Object.keys(bot.servers),
		getClientID = function(){
			if (typeof config.CLIENT_ID !== 'undefined')
				return config.CLIENT_ID;
			else getRl().question('Enter app Client ID (or ^C to exit): ', function(answer){
				if (/\D/.test(answer))
					return console.log('> ID must be numeric, try again (or ^C to exit): ');
				rl.close();
				return answer;
			});
		},
		getAuthURL = function(){
			return 'https://discordapp.com/oauth2/authorize?client_id='+getClientID()+'&scope=bot&permissions=0';
		};
	if (serverIDs.length === 0){
		console.log('Bot is not part of any server. To join the bot to a server, get your client ID from https://discordapp.com/developers/applications/me and enter it below.');

		var openAuthPage = function(clientID){
			var url = getAuthURL();
			if (config.LOCAL){
				console.log('Opening default browser to authorization URL ('+url+')');
				var browser = require('opener')(url);
				browser.unref();
				browser.stdin.unref();
				browser.stdout.unref();
				browser.stderr.unref();
			}
			else console.log('Open '+url+' in your favourite browser to continue.');
			getRl().question('When you\'re done, press enter to re-run script (or ^C to exit)', function(){
				console.log('Reconnecting...\n');
				bot.disconnect();
				bot.connect();
				ready();
			});
		};

		openAuthPage();
		return;
	}

	OurServer = bot.servers[config.SERVER_ID];
	if (typeof OurServer === 'undefined'){
		console.log('Could not find Our server, listing currently joined servers:\n');
		for (i=0; i<serverIDs.length; i++){
			var id = serverIDs[i];
			console.log('    '+id+' '+'('+bot.servers[id].name+')');
		}
		console.log('\nSet one of the IDs above as the SERVER_ID configuration option.\nTo join the bot to another server, visit '+getAuthURL());
		process.exit();
	}
	console.log('Found Our server ('+OurServer.name+')');

	var OurRoleIDs = {},
		OurChannelIDs = {},
		staffRoleID;
	for (i in OurServer.roles){
		if (!OurServer.roles.hasOwnProperty(i))
			continue;

		var role = OurServer.roles[i];
		OurRoleIDs[role.name] = role.id;
		if (typeof staffRoleID === 'undefined' && role.name === config.STAFFROLE_NAME)
			staffRoleID = role.id;
	}
	if (typeof staffRoleID === 'undefined')
		console.log('Staff role name must be set to enable admin-only functionality.');
	for (i in OurServer.channels){
		if (!OurServer.channels.hasOwnProperty(i))
			continue;

		var channel = OurServer.channels[i];
		OurChannelIDs[channel.name] = channel.id;
	}

	var isOwner = function(userID){
			return userID === config.OWNER_ID;
		},
		isStaff = function(userID){
			return OurServer.members[userID].roles.indexOf(staffRoleID) !== -1;
		},
		hasOwner = typeof config.OWNER_ID === 'string' && config.OWNER_ID.length,
		myIDran = false,
		limitedFunc = ', functionality is limited.\nUse the /myid command to get your ID';

	if (!hasOwner)
		console.log('Bot has no owner'+limitedFunc);
	else {
		if (typeof bot.users[config.OWNER_ID] === 'undefined'){
			hasOwner = false;
			console.log('The configured owner is not among the channel members'+limitedFunc);
		}
		else {
			var _owner = bot.users[config.OWNER_ID];
			console.log('Owner is '+_owner.username+' ('+_owner.id+')');
		}
	}

	console.log('And now, we wait...\n');

	function addErrorMessageToResponse(err, response){
		if (err)
			response += '\n('+(hasOwner?'<@'+config.OWNER_ID+'> ':'')+err.message+(err.response?': '+err.response.message:'')+')';
		return response;
	}

	function wipeMessage(channelID, messageID, response, userID){
		bot.deleteMessage({
			channelID: channelID,
			messageID: messageID,
		},function(err){
			var callback = function(msg){
				if (!msg)
					return;
				respond(channelID, userID ? replyTo(userID, msg) : msg);
			};
			if (typeof response === 'function'){
				callback = response;
				response = '';
			}
			response = addErrorMessageToResponse(err, response);
			callback(response, Boolean(err));
		});
	}

	var everyone = function(){ return true },
		commands = [
			{
				name: 'channels',
				desc: 'Returns available channels on Our server (used for initial script setup)',
				perm: isOwner,
			},
			{
				name: 'myid',
				desc: 'Returns your user ID (used for initial script setup)',
				perm: isOwner,
			},
			{
				name: 'ver',
				desc: 'Returns the bot\'s version number & when that version was created',
				perm: everyone,
			},
			{
				name: 'casual',
				desc: 'Politely asks everyone in the room to move to the <#'+OurChannelIDs.casual+'> channel (does nothing in #casual)',
				perm: everyone,
			},
			{
				name: 'cg',
				desc: 'Can be used to search the Vector Club\'s official Color Guide',
				perm: everyone,
			},
			{
				name: 'google',
				desc: 'Perform an "I\'m feeling lucky" google search and return the result',
				perm: everyone,
			},
			{
				name: 'kym',
				desc: 'Search entries of Know Your Meme, a popular wiki of Internet memes',
				perm: everyone,
			},
			{
				name: 'youtube',
				desc: 'Search for YouTube videos - results are based on US region & English language',
				perm: everyone,
				aliases: ['yt'],
			},
			{
				name: 'derpi',
				desc: 'Returns the first result of a Derpibooru search',
				perm: everyone,
				aliases: ['db'],
			},
			{
				name: 'nsfw',
				desc: 'Lets everyone know to keep saucy mesages out of regular rooms (does nothing in #nsfw)\n\tThe optional parameter allows any user to join/leave the NSFW channel at will',
				perm: everyone,
			},
		];

	function CallCommand(userID, channelID, message, event, userIdent, command, argStr, args){
		var i,l;
		switch (command.toLowerCase()){
			case "help": (function(){
				var msg = 'Here\'s a list of commands __you__ can run:\n\n';
				for (i=0,l=commands.length; i<l; i++){
					var cmd = commands[i];
					if (cmd.perm(userID))
						msg += ' ● `'+cmd.name+'`'+(cmd.desc?' - '+cmd.desc:'')+(cmd.aliases?' (Aliases: `'+(cmd.aliases.join('`, `'))+'`)':'')+'\n';
				}
				wipeMessage(channelID, event.d.id);
				respond(userID, msg.trim()+'\nMost commands have an explanation which you can access by sending the command without any arguments.');
			})(); break;
			case "channels": (function(){
				if (!isOwner(userID))
					respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				var ids = [];
				for (i in OurServer.channels){
					if (OurServer.channels.hasOwnProperty(i)){
						var channel = OurServer.channels[i];
						ids.push(channel.id+' ('+(channel.type==='text'?'#':'')+channel.name+')');
					}
				}
				respond(channelID, replyTo(userID, "Channels on this server:\n```"+ids.join('\n')+'```'));
			})(); break;
			case "myid": (function(){
				if (!hasOwner){
					if (myIDran)
						return respond(channelID, replyTo(userID, 'This command can only be executed once per server start-up until the owner\'s ID is set'));
					else myIDran = true;
				}
				else if (!isOwner(userID))
					return respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				respond(channelID, replyTo(userID, 'Your user ID was sent to you in a private message'));
				respond(userID, 'Your user ID is `'+userID+'`');
			})(); break;
			case "ver": (function(){
				bot.simulateTyping(channelID);

				exec = exec || require('child_process').exec;
				exec('git rev-parse --short=4 HEAD', function(_, version) {
					if (_){
						console.log('Error getting version', _);
						return respond(channelID, replyTo(userID, 'Error while getting version number'+(hasOwner?' (<@'+config.OWNER_ID+'> Logs may contain more info)':'')));
					}
					exec('git log -1 --date=short --pretty=format:%ci', function(_, ts) {
						if (_){
							console.log('Error getting creation time', _);
							return respond(channelID, replyTo(userID, 'Error while getting creation time'+(hasOwner?' (<@'+config.OWNER_ID+'> Logs may contain more info)':'')));
						}

						var ver = version.trim();
						respond(channelID, replyTo(userID, 'Bot is running version `'+ver+'` created '+(moment(ts).fromNow())+'\nView commit on GitHub: http://github.com/ponydevs/MLPVC-BOT/commit/'+ver));
					});
				});
			})(); break;
			case "casual": (function(){
				if (channelID === OurChannelIDs.casual)
					return wipeMessage(channelID, event.d.id);

				var possible_images = [
						'http://i.imgur.com/C7T0npq.png', // Original by DJDavid98
						'http://i.imgur.com/RwnT8EX.png', // Coco & Rarity by Pirill
						'http://i.imgur.com/qg9Y1LN.png', // Applebloom's new CM by Drakizora
						'http://i.imgur.com/cxCzsB8.png', // Applebloom falling by Drakizora
						'http://i.imgur.com/iUZe3O2.png', // CMs floating around Applebloom by Drakizora
					],
					image_count = possible_images.length,
					data = args[0],
					k;

				if (!isNaN(data))
					k = Math.max(0,Math.min(image_count-1,parseInt(data, 10)-1));
				else {
					k = moment().minutes() % image_count;
				}

				wipeMessage(channelID, event.d.id, 'Please continue this discussion in <#'+OurChannelIDs.casual+'>\n'+possible_images[k]);
			})(); break;
			case "cg": (function(){
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to quickly link to an appearance using the site\'s  "I\'m feeling lucky" search'));

				bot.simulateTyping(channelID);
				request.get('https://mlpvc-rr.ml/cg/1?js=true&q='+encodeURIComponent(argStr)+'&GOFAST=true', function(error, res, body){
					if (error || typeof body !== 'string'){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Color Guide search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					var data = JSON.parse(body);
					if (!data.status)
						return respond(channelID, replyTo(userID, data.message));

					respond(channelID, replyTo(userID, 'https://mlpvc-rr.ml'+data.goto));
				});
			})(); break;
			case "kym": (function(){
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to find the Know Your Meme entry for a meme.'));
				bot.simulateTyping(channelID);
				var apiurl = 'http://rkgk.api.searchify.com/v1/indexes/kym_production/instantlinks?query='+encodeURIComponent(argStr)+'&field=name&fetch=url&function=10&len=1';
				request.get(apiurl, function(error, res, body){
					if (error || typeof body !== 'string' || [302, 200].indexOf(res.statusCode) === -1){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Know Your Meme search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					var data;
					try {
						data = JSON.parse(body);
					}
					catch(e){
						console.log('JSON body: '+body);
						return respond(channelID, replyTo(userID, 'Know Your Meme search returned invalid data. '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					if (!data.results.length || typeof data.results[0].url !== 'string')
						return respond(channelID, replyTo(userID, 'Know Your Meme search returned no results.'));

					respond(channelID, replyTo(userID, 'http://knowyourmeme.com'+data.results[0].url));
				});
			})(); break;
			case "google": (function(){
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to perform an "I\'m feeling lucky" Google search and return the first result.'));
				bot.simulateTyping(channelID);
				var searchUrl = 'https://google.com/search?q='+encodeURIComponent(argStr);
				request.head(searchUrl+'&btnI', {followRedirect:function(res){
					if (typeof res.headers.location !== 'string')
						return true;

					return /(www\.)google\.((co\.)?[a-z]+)/.test(require('url').parse(res.headers.location).host);
				}}, function(error, res, body){
					if (error || typeof body !== 'string' || [302, 200].indexOf(res.statusCode) === -1){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Google search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					if (typeof res.headers.location === 'string')
						return respond(channelID, replyTo(userID, res.headers.location));

					respond(channelID, replyTo(userID, 'No obvious first result. Link to search page: '+searchUrl));
				});
			})(); break;
			case "youtube":
			case "yt": (function(){
				if (!args.length)
					return respond(channelID, replyTo(userID, 'This command can be used to return the first result of a YouTube search'));
				bot.simulateTyping(channelID);
				yt.addParam('type', 'video');
				yt.addParam('regionCode', 'US');
				yt.addParam('relevanceLanguage', 'en');
				yt.search(argStr, 1, function(error, result) {
					if (error || typeof result.items === 'undefined'){
						console.log(error, result.items);
						return respond(channelID, replyTo(userID, 'YouTube search failed. '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					if (typeof result.items[0] === 'undefined' || typeof result.items[0].id.videoId === 'undefined')
						return respond(channelID, replyTo(userID, 'YouTube search returned no results.'));

					respond(channelID, replyTo(userID, 'https://youtube.com/watch?v='+result.items[0].id.videoId));
				});
			})(); break;
			case "db":
			case "derpi": (function(){
				if (!args.length)
					return respond(channelID, replyTo(userID,
						'This command can be used to return the first result of a Derpibooru search.\n'+
						'**Note:** Any rooms aside from <#'+OurChannelIDs.nsfw+'> will only show results accessible by the site\'s default filter\n\n'+
						'__**Bot-secific search keywords:**__\n\n'+
						' ● `o:<desc|asc>` - Order of the results (if ommited, defaults to `desc`)\n'+
						' ● `by:<score|relevance|width|height|comments|random>` - Same as "Sort by" on the actual site\n\n'+
						'*Examples:* `/derpi safe,o:asc`, `/derpi safe,rd o:asc`, `/derpi ts by:random`'
					));

				bot.simulateTyping(channelID);
				var query = argStr,
					extra = '',
					inNSFW = channelID === OurChannelIDs.nsfw,
					orderTest = /\bo:(desc|asc)\b/i,
					sortbyTest = /\bby:(score|relevance|width|height|comments|random)\b/i,
					respondWithImage = function(image){
						if (!image.is_rendered){
							var tries = typeof this.tries === 'undefined' ? 1 : this.tries;
							if (tries > 2)
								return respond(channelID, replyTo(userID, 'The requested image is not yet processed by Derpibooru, please try again in a bit'));
							return setTimeout(function(){
								CallCommand.call({ tries: tries+1}, userID, channelID, message, event, userIdent, command, argStr, args);
							}, 1000);
						}

						respond(channelID, replyTo(userID, 'http://derpibooru.org/'+image.id+'\nhttps:'+(image.image.replace(/__[^.]+(.\w+)$/,'$1'))));
					};
				if (inNSFW)
					extra += '&filter_id=56027';
				if (sortbyTest.test(query)){
					var sortby = query.match(sortbyTest);
					query = query.replace(sortbyTest, '').trim();
					extra += '&sf='+sortby[1];
					if (!query.length && sortby[1] === 'random'){
						console.log('Derpi search for random image (without tags)');
						return request.get('https://derpibooru.org/images/random.json',function(error, res, body){
							if (error || typeof body !== 'string'){
								console.log(error, body);
								return respond(channelID, replyTo(userID, 'Derpibooru random image search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
							}

							var data = JSON.parse(body);
							if (typeof data.id === 'undefined')
								return respond(channelID, replyTo(userID, 'Failed to get random Derpibooru image ID'));

							request('https://derpibooru.org/images/'+data.id+'.json',function(error, res, body){
								if (error || typeof body !== 'string'){
									console.log(error, body);
									return respond(channelID, replyTo(userID, 'Derpibooru random image data retrieval failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
								}

								respondWithImage(JSON.parse(body));
							});
						});
					}
				}

				if (orderTest.test(query)){
					var order = query.match(orderTest);
					query = query.replace(orderTest, '').trim();
					extra += '&sd='+order[1];
				}
				query = query.replace(/,{2,}/g,',').replace(/(^,|,$)/,'');
				var url = 'https://derpibooru.org/search.json?q='+encodeURIComponent(query)+extra;
				console.log('Derpi search for '+chalk.blue(url));
				request.get(url, function(error, res, body){
					if (error || typeof body !== 'string'){
						console.log(error, body);
						return respond(channelID, replyTo(userID, 'Derpibooru search failed (HTTP '+res.statusCode+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
					}

					var data = JSON.parse(body);
					if (typeof data.search === 'undefined' || typeof data.search[0] === 'undefined')
						return respond(channelID, replyTo(userID, 'Derpibooru search returned no results.'+
							(
								/(explicit|questionable|suggestive)/.test(query) && !inNSFW ?
								' Searching for system tags other than `safe` is likely to produce no results outside the <#'+OurChannelIDs.nsfw+'> channel.' :''
							)+' Don\'t forget that artist and OC tags need to be prefixed with `artist:` and `oc:` respectively.'
						));

					respondWithImage(data.search[0]);
				});
			})(); break;
			case "nsfw": (function(){
				if (typeof OurServer.channels[channelID] !== 'undefined' && OurServer.channels[channelID].name === 'nsfw' && args[0] !== 'leave')
					return;
				if (!args.length)
					return wipeMessage(channelID, event.d.id, channelID === OurChannelIDs.nsfw ? null : 'Please avoid discussing anything NSFW in <#'+channelID+'>. We have a dedicated invite-only NSFW channel, send `/nsfw join` to join. http://i.imgur.com/jaNBZ09.gif');

				switch (args[0]){
					case "join":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) !== -1)
								return respond(userID, 'You are already a member of the #nsfw channel. To leave, send `/nsfw leave` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

							bot.addToRole({
								serverID: OurServer.id,
								userID: userID,
								roleID: OurRoleIDs['Pony Sauce'],
							},function(err){
								if (!err && error)
									console.log('Error while adding Pony Sauce role to '+userIdent+error);

								var response = err ? 'Failed to join <#'+OurChannelIDs.nsfw+'> channel' :'';

								response = addErrorMessageToResponse(err, response);

								if (response)
									return respond(channelID, response);

								OurServer.members[userID].roles.push(OurRoleIDs['Pony Sauce']);

								respond(OurChannelIDs.nsfw, replyTo(userID, 'Welcome aboard. If at any point you wish to leave the channel, use `/nsfw leave`'));
							});
						});
					break;
					case "leave":
						wipeMessage(channelID, event.d.id,function(msg, error){
							if (OurServer.members[userID].roles.indexOf(staffRoleID) !== -1)
								return respond(userID, 'Because you have the Staff role you will see the <#'+OurChannelIDs.nsfw+'> channel no matter what.\nIf you don\'t wand to be notified of new messages, right-click the channel and click `Mute #nsfw`');
							else if (OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']) === -1)
								return respond(userID, 'You are not a member of the #nsfw channel. To join, send `/nsfw join` in any channel.\n(**Notice:** Messages sent in PMs are ignored!)');

							bot.removeFromRole({
								serverID: OurServer.id,
								userID: userID,
								roleID: OurRoleIDs['Pony Sauce'],
							},function(err){
								if (!err && error)
									console.log('Error while removing Pony Sauce role from '+userIdent+error);

								var response = addErrorMessageToResponse(err, '');

								if (response)
									return respond(channelID, replyTo(userID, response));

								OurServer.members[userID].roles.splice(OurServer.members[userID].roles.indexOf(OurRoleIDs['Pony Sauce']), 1);

								respond(OurChannelIDs.nsfw, replyTo(userID, 'left the channel'));
							});
						});
					break;
				}
			})(); break;
			case "rekt":
				respond(channelID, '**REKT** https://www.youtube.com/watch?v=tfyqk26MqdE');
			break;
			case "update":
				wipeMessage(channelID, event.d.id);

				if (!isStaff(userID))
					respond(userID, 'This command can only be run by the Staff');

				if (config.LOCAL)
					respond(userID, 'This command cannot be run on the local version');

				respond(userID, 'Restarting bot...');
				idle();
				exec = exec || require('child_process').exec;
				exec(require('path').resolve(__dirname, 'start.sh'),function (error) {
				    if (error !== null)
				      return respond(userID, 'Update failed:\n```\n'+error+'\n```');

				    process.exit();
				});
			break;
			default:
				var isProfanity = ProfanityFilter(userID, channelID, message, event);
				if (!isProfanity){
					var notfound = 'Command /'+command+' not found';
					console.log(notfound);
					bot.sendMessage({
						to: channelID,
						message: replyTo(userID, notfound),
					});
				}
		}
	}

	function ProcessCommand(userID, channelID, message, event){
		var commandRegex = /^[!/](\w+)(?:\s+([ -~]+)?)?$/,
			user = bot.users[userID],
			userIdent = user.username+'#'+user.discriminator;
		console.log(userIdent+' ran '+message+' from '+chalk.blue('#'+bot.channels[channelID].name));
		if (!commandRegex.test(message))
			bot.sendMessage({
				to: channelID,
				message: replyTo(userID, 'Invalid command: '+(message.replace(/^([!/]\S+).*/,''))),
			});
		var commandMatch = message.match(commandRegex),
			command = commandMatch[1],
			argStr = commandMatch[2] ? commandMatch[2].trim() : '',
			args = argStr ? argStr.split(/\s+/) : [];

		CallCommand(userID, channelID, message, event, userIdent, command, argStr, args);
	}

	function ProfanityFilter(userID, channelID, message, event){
		if (userID === bot.id || isStaff(userID))
			return;

		var matching = /\b(f+[u4a]+[Ссc]+k+(?:tard|[1i]ng)?|[Ссc]un[7t]|a[5$s]{2,}(?:h[0o]+l[3e]+)|(?:d[1i]+|[Ссc][0o])[Ссc]k(?:h[3e][4a]*d)?|b[1ie3a4]+t[Ссc]h)\b/ig,
			user = bot.users[userID],
			ident = user.username+'#'+user.discriminator;

		if (!matching.test(message))
			return false;

		console.log(ident+' triggered profanity filter in channel '+chalk.blue('#'+bot.channels[channelID].name)+' with message: '+(message.replace(matching,function(str){
			return chalk.red(str);
		})));

		if (channelID === OurChannelIDs.nsfw){
			console.log(ident+' wasn\'t warned because they cursed in the NSFW channel');
			return false;
		}

		wipeMessage(channelID, event.d.id, function(msg){
			msg = 'Please avoid using swear words.\nYour message (shown below) in <#'+channelID+'> contained inapproperiate language and it was promptly removed.'+msg+'\n\n**Original message:**\n'+(message.replace(matching,'__*$1*__'));
			respond(userID, msg);
		});
		return true;
	}

	function onMessage(_, userID, channelID, message, event) {
		if (typeof OurServer.channels[event.d.channel_id] === 'undefined')
			return;

		var args = [].slice.call(arguments,1);
		if (/^[!/]/.test(message))
			return ProcessCommand.apply(this, args);

		ProfanityFilter.apply(this, args);
	}
	bot.on('message', onMessage);

	bot.on('messageUpdate', function(_, newMsg, event){
		if (typeof newMsg.author === 'undefined')
			return;
		onMessage(null, newMsg.author.id, newMsg.channel_id, newMsg.content, event);
	});

	bot.on('disconnect', function(errMsg, code){
		console.log('[DISCONNECT:'+code+'] '+errMsg);
		process.exit();
	});

	process.on('SIGINT', function(){
		idle();
		process.exit();
	});
	process.on('exit', idle);
	function idle(){
		bot.setPresence({ idle_since: Date.now() });
	}
}
