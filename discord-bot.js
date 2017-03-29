// jshint -W014
const
	config = require('./config'),
	util = require('util'),
	Discord = require('discord.io'),
	unirest = require('unirest'),
	moment = require('moment'),
	chalk = require('chalk'),
	{VM} = require('vm2'),
	fs = require('fs'),
	YouTubeAPI = require('youtube-api'),
	wrapOutput = (output) => '```js\n'+output+'\n```',
	vmTimeout = 5000,
	defineTimeLimit = 20000,
	vmSandbox = {
		process: {
			exit: function(){ return { rawOutput: 'Nice try' } },
		},
		choice: function(){
			let items = [].slice.apply(arguments);
			return items[Math.floor(Math.random()*items.length)];
		},
	},
	replyTo = (userID, message) => "<@"+userID+"> "+message,
	replyToIfNotPM = (isPM, userID, message) => (isPM ? message : replyTo(userID, message)),
	respond = function(channelID, message, callback){
		return bot.sendMessage({
			to: channelID,
			message: message,
		},function(err){
			if (typeof callback === 'function'){
				callback.apply(this,arguments);
				return;
			}
			if (err){
				console.log(err);
				bot.sendMessage({
					to: channelID,
					message: 'A message to this channel failed to send. (HTTP '+err.statusCode+')\n'+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.',
				});
			}
		});
	},
	exec = require('child_process').exec;
// This is needed so we don't hit the anonymous usage cap
YouTubeAPI.authenticate({
	type: "key",
	key: config.YT_API_KEY,
});
//noinspection ES6ConvertVarToLetConst
var bot = new Discord.Client({
		autorun: true,
		token: config.TOKEN,
	}),
	hasOwner = typeof config.OWNER_ID === 'string' && config.OWNER_ID.length,
	readline = require('readline').createInterface({
		input: process.stdin,
		output: process.stdout
	}),
	evalTimedOut = {},
	table = require('text-table'),
	defineCommandLastUsed;
Array.prototype.randomElement = function () {
    return this[Math.floor(Math.random() * this.length)]
};

if (config.LOCAL === true && /^https:/.test(config.SITE_ABSPATH))
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("console-stamp")(console, {
	formatter: function(){
		return moment().format('YYYY-MM-DD HH:MM:ss.SSS');
	},
	label: false,
});

bot.on('ready', ready);

function ready(){
	let i;

	bot.setPresence({ idle_since: null });
	console.log('Logged in as '+bot.username+' ('+bot.id+')');

	let serverIDs = Object.keys(bot.servers),
		getClientID = function(){
			if (typeof config.CLIENT_ID !== 'undefined')
				return config.CLIENT_ID;
			else readline.question('Enter app Client ID (or ^C to exit): ', function(answer){
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

		let openAuthPage = function(){
			let url = getAuthURL();
			if (config.LOCAL){
				console.log('Opening default browser to authorization URL ('+url+')');
				let browser = require('opener')(url);
				browser.unref();
				browser.stdin.unref();
				browser.stdout.unref();
				browser.stderr.unref();
			}
			else console.log('Open '+url+' in your favourite browser to continue.');
			readline.question('When you\'re done, press enter to re-run script (or ^C to exit)', function(){
				console.log('Reconnecting...\n');
				bot.disconnect();
				bot.connect();
				ready();
			});
		};

		openAuthPage();
		return;
	}

	let OurServer = bot.servers[config.SERVER_ID];
	if (typeof OurServer === 'undefined'){
		console.log('Could not find Our server, listing currently joined servers:\n');
		for (i=0; i<serverIDs.length; i++){
			let id = serverIDs[i];
			console.log('    '+id+' '+'('+bot.servers[id].name+')');
		}
		console.log('\nSet one of the IDs above as the SERVER_ID configuration option.\nTo join the bot to another server, visit '+getAuthURL());
		process.exit();
	}
	console.log('Found Our server ('+OurServer.name+')');

	let OurRoleIDs = {},
		OurChannelIDs = {},
		staffRoleID;
	for (i in OurServer.roles){
		if (!OurServer.roles.hasOwnProperty(i))
			continue;

		let role = OurServer.roles[i];
		OurRoleIDs[role.name] = role.id;
		if (typeof staffRoleID === 'undefined' && role.name === 'Staff')
			staffRoleID = role.id;
	}
	if (typeof staffRoleID === 'undefined')
		console.log('Staff role name must be set to enable admin-only functionality.');
	for (i in OurServer.channels){
		if (!OurServer.channels.hasOwnProperty(i))
			continue;

		let channel = OurServer.channels[i];
		OurChannelIDs[channel.name] = channel.id;
	}

	class Permission {
		constructor(name, checker){
			this.name = name;
			this.check = userID => checker(userID);
		}
	}

	let isOwner = new Permission('Bot Developer',function(userID){
			return userID === config.OWNER_ID;
		}),
		isStaff = new Permission('Staff',function(userID){
			return OurServer.members[userID].roles.indexOf(staffRoleID) !== -1;
		}),
		isMember = new Permission('Club Members',function(userID){
			return OurServer.members[userID].roles.indexOf(OurRoleIDs['Club Members']) !== -1;
		}),
		everyone = new Permission('Everyone',function(){ return true }),
		nicePerm = new Permission('Nice',function(){ return true }),
		nonmembers = new Permission('Non-members',function(userID){
			return !isStaff.check(userID) && !isMember.check(userID);
		}),
		myIDran = false,
		limitedFunc = ', functionality is limited.\nUse the /myid command to get your user ID';

	if (!hasOwner)
		console.log('Bot has no owner'+limitedFunc);
	else {
		if (!(config.OWNER_ID in bot.users)){
			hasOwner = false;
			console.log('The configured owner is not among the channel members'+limitedFunc);
		}
		else {
			let _owner = bot.users[config.OWNER_ID];
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
			let callback = function(msg){
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

	function getRules(){
		return fs.readFileSync('rules.txt', 'utf8').replace(/#([a-z_-]+)/g,(_,n)=>'<#'+OurChannelIDs[n]+'>').replace('@me',`<@${bot.id}>`);
	}

	let commandsArray = [
			{
				name: 'help',
				help:
					'Displays a list of available commands. Takes a command name as an additional parameter to provide detailed information on that specific command.\n'+
					'If a command is specified as the first parameter and the second parameter is `here` the help text will be output inside the current channel instead of being sent via a PM (the parameter does nothing when the command is called via PM).',
				perm: everyone,
				usage: [true,'google','cg','ver here'],
			},
			{
				name: 'channels',
				help: 'Returns available channels on our server (used for initial script setup)',
				perm: isOwner,
				usage: [true],
			},
			{
				name: 'myid',
				help: 'Returns your user ID (used for initial script setup)',
				perm: isOwner,
				usage: [true],
			},
			{
				name: 'roleids',
				help: 'Returns a list of role IDs on the server',
				perm: isOwner,
				usage: [true],
			},
			{
				name: 'version',
				help: 'Returns the bot\'s version number & when that version was created',
				perm: everyone,
				aliases: ['ver'],
				usage: [true],
			},
			{
				name: 'casual',
				help: 'Politely asks everyone in the room to move to the <#'+OurChannelIDs.casual+'> channel (does nothing in said channel)',
				perm: everyone,
				usage: [true],
			},
			{
				name: 'cg',
				help: 'This command can be used to quickly link to an appearance using the site\'s "I\'m feeling lucky" search. The query is sent to the website as-is and the first result\'s link is returned, if any.\nUse names/tags separated by spaces, or include `*` and `?` characters to perform a wildcard search. Include the term `human` to search the EQG guide.',
				usage: ['twilight sparkle','*pommel*','human twilight'],
				perm: everyone,
				aliases: ['guide'],
			},
			{
				name: 'google',
				help: 'Performs an "I\'m feeling lucky" Google search. If the search returned no obvious result, then the link to the search page is sent instead.',
				usage: ['meaning of life','procractination','vinyl scratch mlp wikia'],
				perm: everyone,
			},
			{
				name: 'kym',
				help: 'Find the first matching entry of Know Your Meme, a popular wiki of Internet memes',
				usage: ['here come dat boi','lenny face','pepe the frog'],
				perm: everyone,
			},
			{
				name: 'youtube',
				help: 'Returns the first result of a YouTube sarch. Results are based on US region & English language preferences.',
				usage: ['hillary clinton meme queen 2016','harambe','darude sandstorm'],
				perm: everyone,
				aliases: ['yt'],
			},
			{
				name: 'derpi',
				help:
					'This command can be used to return the first result of a Derpibooru search.\n'+
					'**Note:** Any rooms aside from <#'+OurChannelIDs.nsfw+'> will only show results accessible by the site\'s default filter. Using the command in a DM is the same as being in <#'+OurChannelIDs.nsfw+'>\n\n'+
					'__**Bot-secific search keywords:**__\n\n'+
					' ● `o:<desc|asc>` - Order of the results (if ommited, defaults to `desc`)\n'+
					' ● `by:<score|relevance|width|height|comments|random>` - Same as "Sort by" on the actual site\n'+
					' ● `as:link` - Returns the link of the search with the specified parameters instead of the first matching result',
				usage: ['safe,o:asc','safe,rd o:asc','ts by:random'],
				perm: everyone,
				aliases: ['db'],
			},
			{
				name: 'nsfw',
				help:
					'When ran without any arguments: sends a message to the current conversation warning participants to avoid discussing NSFW content in the current channel, and informs them about the existence of the <#'+OurChannelIDs.nsfw+'> channel\'s existance and how they can join it.\n'+
					'There\'s an __optional__ argument which can be one of the following:\n'+
					'\t● `join` - Allows the user running this command to join the <#'+OurChannelIDs.nsfw+'> channel at will\n'+
					'\t● `leave` - Allows the user running this command to leave the <#'+OurChannelIDs.nsfw+'> channel at will',
				usage: [true,'join','leave'],
				perm: everyone,
			},
			{
				name: 'define',
				help: 'This command can be used to get definitions, synonyms and example usages of English words, powered by WordsAPI.\n**Note:** The API is free to use for up to 2500 requests per day. If exceeded, it has additional costs on a per-request basis, and as such it is rate limited to one use every 20 seconds. Only use this command when appropriate.',
				usage: ['sleep','apple pie','horse'],
				perm: everyone,
				aliases: ['def'],
			},
			{
				name: 'rekt',
				help: 'Apply cold water to the burned area',
				perm: everyone,
				usage: [true],
			},
			{
				name: 'say',
				help: 'This command is a placeholder, it has no function other than giving you the ability to execute it without any error message about an unknown command if your message begins with a slash. Added for IRC "compatibility".',
				perm: everyone,
				usage: [true, '/r/mylittlepony'],
			},
			{
				name: 'avatar',
				help: 'This command can be used to change the bot\'s avatar by passing an image URL, or set it back to the default by passing `reset`.',
				perm: isStaff,
				usage: ['http://placehold.it/300x300/000000/ffffff.png?text=MLPVC-BOT', 'reset'],
			},
			{
				name: 'about',
				help: 'Retrieves information about a user',
				perm: isOwner,
				usage: ['me', 'MLPVC-RR'],
			},
			{
				name: 'fixnick',
				help: 'Changes your nickname to the format specified in the first argument (if you have one).\n\t- `brackets`: DiscordName (DAName)\n\t- `pipe`: DAName | DiscordName\n\t- `da`: DAName\nStaff can use a user\'s name as the last argument to change specific user\'s nick. Does not work on Staff members due to API limitations.',
				perm: everyone,
				usage: ['brackets','pipe me','da @Mention#1234'],
			},
			{
				name: 'verify',
				help: 'Verifies the club membership of the user running the command. If you want to verify your identity, you can get a token here: '+config.SITE_ABSPATH+'u#verify-discord-identity',
				perm: nonmembers,
				usage: ['<token>'],
			},
			{
				name: 'lewder',
				help: 'Signal that the conversation is not lewd enough.',
				perm: everyone,
				usage: [true],
			},
			{
				name: 'tutorials',
				help: 'Sends a link to the club\'s Tutorials folder to the channel.\nAn optional argument allows linking to a subfolder:\n\n'+
					'\t● `anim`/`animation`: Tutorials - Animation\n'+
					'\t● `ai`/`illustrator` : Tutorials - Illustrator\n'+
					'\t● `is`/`inkscape`: Tutorials - Inkscape\n'+
					'\t● `ps`/`photoshop`: Tutorials - Photoshop',
				perm: everyone,
				usage: [true,'ps','illustrator'],
				aliases: ['tut'],
			},
			{
				name: 'eval',
				help: 'Evaluates an arbitrary JavaScript expression using `safe-eval` (https://www.npmjs.com/package/safe-eval)',
				perm: everyone,
				usage: ['2+2','Math.random()','"Te" + "xt"'],
				aliases: ['e'],
			},
			{
				name: 'nice',
				help: 'Nice',
				perm: nicePerm,
				usage: [true],
				aliases: ['nice'],
			},
			{
				name: 'age',
				help: 'Return the age of the server',
				perm: everyone,
				usage: [true],
			},
			{
				name: 'welcomemsg',
				help: `Sends the welcome message to the <#${OurChannelIDs.welcome}> channel.`,
				perm: isStaff,
				usage: [true],
			},
			{
				name: 'roles',
				help: 'List the server rules',
				perm: everyone,
				usage: [true],
			},
		];
	let commands = (function(){
			let obj = {}, i;
			for (i=0; i<commandsArray.length; i++)
				obj[commandsArray[i].name] = commandsArray[i];
			return obj;
		})(),
		commandPermCheck = function(command, userID){
			return commands[command] ? commands[command].perm.check(userID) : false;
		},
		reqparams = function(cmd){
			return 'This command requires additional parameters. Use `/help '+cmd+'` for more information.';
		},
		onserver = 'This command must be run from within a channel on our server.';

	function getVersion(channelID, userID, callback){
		exec('git rev-parse --short=4 HEAD', function(_, version){
			let m, privateMsg = userID === channelID;
			if (_){
				console.log('Error getting version', _);
				m = 'Error while getting version number' + (hasOwner ? ' (<@' + config.OWNER_ID + '> Logs may contain more info)' : '');
				return respond(channelID, !privateMsg ? replyTo(userID, m): m);
			}
			exec('git log -1 --date=short --pretty=format:%ci', function(_, ts){
				if (_){
					console.log('Error getting creation time', _);
					m = 'Error while getting creation time' + (!privateMsg && hasOwner ? ' (<@' + config.OWNER_ID + '> Logs may contain more info)' : '');
					return respond(channelID, !privateMsg ? replyTo(userID, m): m);
				}

				return callback(version.trim(), ts);
			});
		});
	}

	function getUserData(targetUser, channelID, userID, isPM){
		let member,
			i,
			userIDregex = /^<@!?(\d+)>$/;
		if (typeof targetUser !== 'string' || targetUser.trim().length === 0)
			return respond(channelID, replyToIfNotPM(isPM, userID, 'The user identifier is missing'));
		if (targetUser === 'me')
			member = bot.users[userID];
		else {
			if (typeof targetUser !== 'string' || !userIDregex.test(targetUser)){
				for (i in bot.users){
					if (!bot.users.hasOwnProperty(i))
						continue;

					if (bot.users[i].username.toLowerCase() === targetUser.toLowerCase()){
						member = bot.users[i];
						break;
					}
				}
				if (typeof member === 'undefined')
					for (i in OurServer.members){
						if (!OurServer.members.hasOwnProperty(i) || typeof OurServer.members[i].nick === 'undefined')
							continue;

						if (OurServer.members[i].nick.toLowerCase().indexOf(targetUser.toLowerCase()) === 0){
							member = OurServer.members[i];
							break;
						}
					}
				if (typeof member === 'undefined')
					return respond(channelID, replyToIfNotPM(isPM, userID, 'The user identifier is missing or invalid (`'+targetUser+'`)'));
			}
			else member = bot.users[targetUser.replace(userIDregex,'$1')];
		}
		let data = {},
			membership = OurServer.members[member.id];
		data.id = member.id;
		data.username = member.username;
		data.discriminator = member.discriminator;
		data.nick = membership.nick;
		data.roles = [];
		for (i in membership.roles){
			if (!membership.roles.hasOwnProperty(i))
				continue;

			data.roles.push(OurServer.roles[membership.roles[i]].name);
		}

		return data;
	}

	function getIdent(userID){
		let user = bot.users[userID];
		return user.username+'#'+user.discriminator;
	}

	function callCommand(userID, channelID, message, event, userIdent, command, argStr, args){
		let isPM = !(channelID in bot.channels),
			respondWithDerpibooruImage = function(image){
				if (!image.is_rendered){
					let tries = typeof this.tries === 'undefined' ? 1 : this.tries;
					if (tries > 2)
						return respond(channelID, replyTo(userID, 'The requested image is not yet processed by Derpibooru, please try again in a bit'));
					return setTimeout(function(){
						callCommand.call({tries: tries + 1}, userID, channelID, message, event, userIdent, command, argStr, args);
					}, 1000);
				}

				respond(channelID, replyTo(userID, 'http://derpibooru.org/' + image.id));
			};
		command = command.toLowerCase();

		if (command === 'join' && argStr.trim().toLowerCase() === 'nsfw'){
			command = 'nsfw';
			argStr = 'join';
			args = [argStr];
		}

		switch (command){
			case "help": (function helpCommandHandler(){
				let cmd;
				if (typeof args[0] === 'string'){
					let tcmd = args[0],
						here = args[1] === 'here' && !isPM,
						targetChannel = here ? channelID : userID;
					if (!isPM && !here)
						wipeMessage(channelID, event.d.id);
					if (!(tcmd in commands) || (!commandPermCheck(tcmd, userID) && !isStaff.check(userID))){
						for (let i=0; i<commandsArray.length; i++){
							if (!commandsArray[i].aliases)
								continue;

							if (commandsArray[i].aliases.indexOf(tcmd) !== -1){
								args[0] = commandsArray[i].name;
								helpCommandHandler();
								return;
							}
						}
						return respond(targetChannel, 'The specified command (`'+tcmd+'`) does not exist'+(!isStaff.check(userID)?' or you don\'t have permission to use it':'')+'.');
					}

					cmd = commands[tcmd];
					if (typeof cmd.help !== 'string'){
						if (!isPM && !here)
							wipeMessage(channelID, event.d.id);
						respond(targetChannel, 'The specified command ('+cmd.name+') has no associated help text.');
					}

					let usage = [];
					if (cmd.usage){
						for (let j=0; j<cmd.usage.length; j++){
							usage.push('/'+cmd.name+(cmd.usage[j]===true?'':' '+cmd.usage[j]));
						}
					}
					return respond(targetChannel,
						'Showing help for command `'+cmd.name+'`'+(here?' (force-displayed)':'')+
						'\n__Usable by:__ '+cmd.perm.name+'\n'+
						'__Description:__\n'+(cmd.help.replace(/^(.)/gm,'\t\t$1'))+
						(cmd.aliases?'\n__Aliases:__ `'+(cmd.aliases.join('`, `'))+'`':'')+
						(usage.length?'\n__Usage, examples:__\n```\n'+(usage.join('\n'))+'\n```':'')
					);
				}
				let canrun = [], x, l=commandsArray.length;
				for (x=0; x<l; x++){
					cmd = commandsArray[x];
					if (cmd.perm.check(userID))
						canrun.push(cmd.name);
				}
				canrun = canrun.sort(function(a,b){
					return a.localeCompare(b);
				});
				let exampleCommand = canrun[Math.floor(Math.random()*canrun.length)],
					msg = 'Commands must be prefixed with `!` or `/` when sent in one of the channels, and all command names are case-insensitive (meaning `/'+exampleCommand
						+'` is the same as `/'+(exampleCommand.replace(/^(.)/,function(a){
							return a.toUpperCase();
						}))+'` or `/'+(exampleCommand.toUpperCase())+'`).\n'+
						'Here\'s a list of all commands __you__ can run:\n```\n',
					commandsTable = [],
					columns = 3;
				for (let ix=0; ix<canrun.length; ix+=columns)
					commandsTable.push(canrun.slice(ix,ix+columns));

				msg += table(commandsTable,{ hsep: '  ' });

				if (!isPM)
					wipeMessage(channelID, event.d.id);
				respond(userID, msg.trim()+'\n```\nIf you want to find out what a specific command does, simply run `/help commandname` (e.g. `/help '+exampleCommand+'`)');
			})(); break;
			case "channels": (function(){
				if (!commandPermCheck(command, userID))
					return respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				let ids = [];
				for (i in OurServer.channels){
					if (OurServer.channels.hasOwnProperty(i)){
						let channel = OurServer.channels[i];
						ids.push('├ '+(channel.type==='text'?'#':'')+channel.name+' ('+channel.id+')');
					}
				}
				ids.push(ids.pop().replace('├','└'));
				respond(channelID, replyTo(userID, "```"+OurServer.name+" ("+OurServer.id+")\n"+ids.join('\n')+'```'));
			})(); break;
			case "myid": (function(){
				if (!hasOwner){
					if (myIDran)
						return respond(channelID, replyToIfNotPM(isPM, userID, 'This command can only be executed once per server start-up until the owner\'s ID is set'));
					else myIDran = true;
				}
				else if (!commandPermCheck(command, userID))
					return respond(channelID, replyToIfNotPM(isPM, userID, 'You must be owner to use this command'));

				respond(channelID, replyTo(userID, 'Your user ID was sent to you in a private message'));
				respond(userID, 'Your user ID is `'+userID+'`');
			})(); break;
			case "roleids": (function(){
				if (!commandPermCheck(command, userID))
					respond(channelID, replyTo(userID, 'You must be owner to use this command'));

				let message = [],
					keys = Object.keys(OurRoleIDs);
				keys.forEach(function(key){
					message.push(OurRoleIDs[key]+' ('+key+')');
				});
				respond(channelID, replyTo(userID, 'List of available roles for server '+OurServer.name+':\n```\n'+message.join('\n')+'\n```'));
			})(); break;
			case "ver":
			case "version": (function(){
				bot.simulateTyping(channelID);

				getVersion(channelID,userID,function(ver,ts){
					respond(channelID, replyTo(userID, 'Bot is running version `'+ver+'` created '+(moment(ts).fromNow())+'\nView commit on GitHub: http://github.com/ponydevs/MLPVC-BOT/commit/'+ver));
				});
			})(); break;
			case "casual": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (channelID === OurChannelIDs.casual)
					return wipeMessage(channelID, event.d.id);

				let possible_images = [
						'mountain', // Original by DJDavid98
									// RIP IN PEPPERONI (Coco & Rarity by Pirill) ;_;7
						'abcm',     // Applebloom's new CM by Drakizora
						'abfall',   // Applebloom falling by Drakizora
						'abfloat',  // CMs floating around Applebloom by Drakizora
					],
					image_count = possible_images.length,
					data = args[0],
					k;

				if (!isNaN(data))
					k = Math.max(0,Math.min(image_count-1,parseInt(data, 10)-1));
				else {
					k = moment().minutes() % image_count;
				}

				wipeMessage(channelID, event.d.id, 'Please continue this discussion in <#'+OurChannelIDs.casual+'>\n'+config.SITE_ABSPATH+'img/discord/casual/'+possible_images[k]+'.png');
			})(); break;
			case "cg": (function(){
				if (!args.length)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				bot.simulateTyping(channelID);
				let query = argStr,
					humanRegex = /\bhuman\b/g,
					eqg = humanRegex.test(query);
				if (eqg)
					query = query.replace(humanRegex,'');
				unirest.get(config.SITE_ABSPATH+'cg'+(eqg?'/eqg':'')+'/1?js=true&q='+encodeURIComponent(query)+'&GOFAST=true')
					.header("Accept", "application/json")
					.end(function (result) {
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return respond(channelID, replyToIfNotPM(isPM, userID, 'Color Guide search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						let data = result.body;
						if (!data.status)
							return respond(channelID, replyToIfNotPM(isPM, userID, data.message));

						respond(channelID, replyToIfNotPM(isPM, userID, config.SITE_ABSPATH+(data.goto.substring(1))));
					});
			})(); break;
			case "kym": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (!args.length)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				bot.simulateTyping(channelID);
				let apiurl = 'http://rkgk.api.searchify.com/v1/indexes/kym_production/instantlinks?query='+encodeURIComponent(argStr)+'&field=name&fetch=url&function=10&len=1';
				unirest.get(apiurl)
					.header("Accept", "application/json")
					.end(function (result) {
						if (result.error || typeof result.body !== 'object' || [302, 200].indexOf(result.status) === -1){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'Know Your Meme search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						let data = result.body;
						if (!data.results.length || typeof data.results[0].text !== 'string')
							return respond(channelID, replyTo(userID, 'Know Your Meme search returned no results.'));

						respond(channelID, replyTo(userID, 'http://knowyourmeme.com'+data.results[0].text));
					});
			})(); break;
			case "google": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (!args.length)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				bot.simulateTyping(channelID);
				let searchUrl = 'https://google.com/search?q='+encodeURIComponent(argStr);
				unirest.get(searchUrl+'&btnI')
					.followRedirect(function(res){
						if (typeof res.headers.location !== 'string')
							return true;

						return /(www\.)google\.((co\.)?[a-z]+)/.test(require('url').parse(res.headers.location).host);
					})
					.end(function(result){
						if (result.error || [302, 200].indexOf(result.status) === -1){
							console.log(result.error, result.body, result.headers);
							return respond(channelID, replyTo(userID, 'Google search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						if (typeof result.headers.location !== 'string')
							return respond(channelID, replyTo(userID, 'No obvious first result. Link to search page: '+searchUrl));

						return respond(channelID, replyTo(userID, result.headers.location));
					});
			})(); break;
			case "youtube":
			case "yt": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (!args.length)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				bot.simulateTyping(channelID);

				YouTubeAPI.search.list({
					part: 'snippet',
					q: argStr,
					type: 'video',
					maxResults: 1,
					regionCode: 'US',
					relevanceLanguage: 'en',
					safeSearch: channelID === OurChannelIDs.nsfw ? 'none' : 'moderate',
				}, function(error, result) {
					if (error || typeof result.items === 'undefined'){
						console.log(error, result);
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
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				let query = argStr,
					extra = '',
					inNSFW = channelID === OurChannelIDs.nsfw || isPM,
					orderTest = /\bo:(desc|asc)\b/i,
					sortbyTest = /\bby:(score|relevance|width|height|comments|random)\b/i,
					asLinkTest = /\bas:link\b/i, returnAsLink = false;
				if (inNSFW)
					extra += '&filter_id=56027';
				if (sortbyTest.test(query)){
					let sortby = query.match(sortbyTest);
					query = query.replace(sortbyTest, '').trim();
					extra += '&sf='+sortby[1];
					if (!query.length && sortby[1] === 'random'){
						console.log('Derpi search for random image (without tags)');
						return unirest.get('https://derpibooru.org/images/random.json')
							.header("Accept", "application/json")
							.end(function(result){
								if (result.error || typeof result.body !== 'object'){
									console.log(result.error, result.body);
									return respond(channelID, replyTo(userID, 'Derpibooru random image search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
								}

								let data = result.body;
								if (typeof data.id === 'undefined')
									return respond(channelID, replyTo(userID, 'Failed to get random Derpibooru image ID'));

								unirest.get('https://derpibooru.org/images/'+data.id+'.json')
									.header("Accept", "application/json")
									.end(function(result){
									if (result.error || typeof result.body !== 'object'){
										console.log(result.error, result.body);
										return respond(channelID, replyTo(userID, 'Derpibooru random image data retrieval failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
									}

									respondWithDerpibooruImage(result.body);
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
					extra += '&sd='+order[1];
				}
				query = query.replace(/,{2,}/g,',').replace(/(^,|,$)/,'');
				let url = 'https://derpibooru.org/search.json?q='+encodeURIComponent(query)+extra;
				if (returnAsLink)
					return respond(channelID, replyTo(userID, url.replace('/search.json','/search')));
				bot.simulateTyping(channelID);
				console.log('Derpi search for '+chalk.blue(url));
				unirest.get(url)
					.header("Accept", "application/json")
					.end(function(result){
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'Derpibooru search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

					let data = result.body;
					if (typeof data.search === 'undefined' || typeof data.search[0] === 'undefined')
						return respond(channelID, replyTo(userID, 'Derpibooru search returned no results.'+
							(
								/(explicit|questionable|suggestive)/.test(query) && !inNSFW ?
								' Searching for system tags other than `safe` is likely to produce no results outside the <#'+OurChannelIDs.nsfw+'> channel.' :''
							)+' Don\'t forget that artist and OC tags need to be prefixed with `artist:` and `oc:` respectively.'
						));

					respondWithDerpibooruImage(data.search[0]);
				});
			})(); break;
			case "nsfw": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (channelID in OurServer.channels && OurServer.channels[channelID].name === 'nsfw' && args[0] !== 'leave')
					return;
				if (!args.length){
					let message = (
						channelID === OurChannelIDs.nsfw
						? null
						: (
							isStaff.check(userID)
							? 'Please avoid discussing anything NSFW '+(
								!isPM
								? 'in <#'+channelID+'>'
								:'outside <#'+OurChannelIDs.nsfw+'>'
							)+'.'
							:''
						)
					)+' We have a dedicated invite-only NSFW channel, send `/nsfw join` to join.\n'+config.SITE_ABSPATH+'img/discord/nsfw.gif';
					return isPM ? respond(channelID, message) : wipeMessage(channelID, event.d.id, message);
				}

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

								let response = err ? 'Failed to join <#'+OurChannelIDs.nsfw+'> channel' :'';

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

								let response = addErrorMessageToResponse(err, '');

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
				if (isPM)
					return respond(channelID, onserver);

				respond(channelID, '**REKT** https://www.youtube.com/watch?v=tfyqk26MqdE');
			break;
			case "def":
			case "define": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (!args.length)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));

				let delta;
				if (typeof defineCommandLastUsed === 'undefined')
					defineCommandLastUsed = Date.now();
				else if ((delta = Date.now() - defineCommandLastUsed) < defineTimeLimit && !isOwner.check(userID)){
					return wipeMessage(channelID, event.d.id, function(){
						respond(userID, 'The `define` command is limited to one use every '+(defineTimeLimit/1000)+' seconds due to monthly API request limits (which, after exceeded, cost money per each request). Try again in '+(Math.round((delta/100))/10)+'s');
					});
				}
				else defineCommandLastUsed = Date.now();

				if (channelID === OurChannelIDs['bot-sandbox'] && !isStaff.check(userID))
					return respond(channelID, replyTo(userID, 'This command can only be used by members of the Staff role in <#'+channelID+'>. Please only use this command when neccessary as it\'s number of requests per day is limited.'));

				unirest.get("https://wordsapiv1.p.mashape.com/words/"+encodeURIComponent(argStr))
					.header("X-Mashape-Key", config.MASHAPE_KEY)
					.header("Accept", "application/json")
					.end(function (result) {
						if ((result.error || typeof result.body !== 'object') && result.status !== 404){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'WordsAPI search failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						let data = result.body;
						if (result.status === 404 || !data.results || data.results.length === 0)
							return respond(channelID, replyTo(userID, 'WordsAPI search returned no results.'+(/s$/.test(argStr)?' Plural words can cause this issue. If you used a plural word, please use the singluar form instead.':'')));

						let defs = [];
						data.results.slice(0,4).forEach(function(def){
							defs.push(
								(data.results.length>1?(defs.length+1)+'. ':'')+def.partOfSpeech+' — '+def.definition+
								(def.examples&&def.examples.length?'\n\t\t__Examples:__ *“'+(def.examples.slice(0,2).join('”, “').replace(new RegExp('('+data.word+')','g'),'__$1__'))+'”*':'')+
								(def.synonyms&&def.synonyms.length?'\n\t\t__Synonyms:__ '+def.synonyms.slice(0,4).join(', '):''));
						});
						return respond(channelID, replyTo(userID, '\n**'+data.word+'** • /'+data.pronunciation.all+'/'+(data.syllables&&data.syllables.list&&data.syllables.list.length>1?' • *'+data.syllables.list.join('-')+'*':'')+'\n'+(defs.join('\n\n'))));
					});
			})(); break;
			case "avatar": (function(){
				if (!commandPermCheck(command, userID))
					return respond(channelID, replyToIfNotPM(isPM, userID, 'You do not have permission to use this command.'));

				let url = argStr.trim(),
					reset = url === 'reset',
					actioned = reset?'reset':'updated',
					setAvatar = function(avatarBase64){
						bot.editUserInfo({
							avatar: avatarBase64,
						}, function(err){
							if (err){
								console.log(err);
								return respond(channelID, replyToIfNotPM(isPM, userID, 'Setting avatar failed. ' + (hasOwner ? '<@' + config.OWNER_ID + '>' : 'The bot owner') + ' should see what caused the issue in the logs.'));
							}

							let outputChannel = OurChannelIDs.staffchat,
								staffChatExists = typeof OurChannelIDs.staffchat === 'string';
							if (!staffChatExists){
								if (isPM)
									console.log(chalk.blue('#staffchat')+' channel does not exist, could not send avatar update message');
								else outputChannel = channelID;
							}
							if (isPM)
								respond(channelID, 'The bot\'s avatar has been '+actioned+(staffChatExists?', and a notice was sent to the other staff members':'')+'.');
							else wipeMessage(channelID, event.d.id);
							respond(outputChannel, 'The bot\'s avatar has been '+actioned+' by <@' + userID + '>' + (isPM ? ' (via PM)':'')+(!reset?' to the following image: ' + url:''));
						});
					};
				if (reset)
					return setAvatar(fs.readFileSync('default_avatar.png', 'base64'));
				if (!/^https?:\/\/.*$/.test(url))
					respond(channelID, replyToIfNotPM(isPM, userID, 'The parameter must be a valid URL'));

				unirest.get(url)
					.encoding(null)
					.end(function(result){
						if ((result.error || !(result.body instanceof Buffer))){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'Could not download image (HTTP ' + result.status + '). ' + (hasOwner ? '<@' + config.OWNER_ID + '>' : 'The bot owner') + ' should see what caused the issue in the logs.'));
						}

						let avatarBase64 = new Buffer(result.body).toString('base64');

						setAvatar(avatarBase64, reset);
					});
			})(); break;
			case "about": (function(){
				if (!commandPermCheck(command, userID))
					return respond(channelID, replyToIfNotPM(isPM, userID, 'You must be owner to use this command'));

				let data = getUserData(args[0], channelID, userID, isPM);

				respond(channelID, replyToIfNotPM(isPM, userID, 'User details:\n```json\n'+JSON.stringify(data,null,'\t')+'\n```'));
			})(); break;
			case "fixnick": (function(){
				if (typeof args[0] !== 'string')
					return respond(channelID, replyToIfNotPM(isPM, userID, 'The first (format) parameter is mandatory'));
				let format;
				switch (args[0]){
					case "pipe": format = 'da | disc'; break;
					case "bracket": format = 'disc (da)'; break;
					case "da": format = 'da'; break;
				}
				let data = getUserData(isStaff.check(userID) ? (args[arguments.length-1]||'me') : 'me', channelID, userID, isPM);
				if (typeof data !== 'object')
					return;
				if (typeof data.nick !== 'string')
					return respond(channelID, replyToIfNotPM(isPM, userID, 'You do not have a nickname on our server.'));

				let originalNick = data.nick.replace(/^(?:.*\(([a-zA-Z\d-]{1,20})\)|([a-zA-Z\d-]{1,20})\s\|.*)$/,'$1$2'),
					nick = format.replace('da',originalNick).replace('disc',data.username);
				bot.editNickname({
					serverID: OurServer.id,
					userID: data.id,
					nick: nick,
				},function(err){
					if (err){
						if (err.response && err.response.message === 'Privilege is too low...')
							return respond(channelID, replyToIfNotPM(isPM, userID, 'Changing nick failed: Due to Discord API limitations the bot can only set the nicks of users whose roles are under the bot\'s in the hierarchy.'));
						console.log(err);
						return respond(channelID, replyToIfNotPM(isPM, userID, 'Changing nick failed.'+(err.response && err.response.message ? ' ('+err.response.message+')' : '')+'\n'+(hasOwner ? '<@' + config.OWNER_ID + '>' : 'The bot owner') + ' should see what caused the issue in the logs.'));
					}

					return respond(channelID, replyToIfNotPM(isPM, userID, 'The nickname of <@'+data.id+'> has been updated to `'+nick+'`'));
				});
			})(); break;
			case "verify": (function(){
				if (typeof OurRoleIDs['Club Members'] === 'undefined')
					return respond(channelID, replyToIfNotPM(isPM, userID, 'The Club Members role does not exist on this server'));
				if (!commandPermCheck(command, userID))
					return respond(channelID, replyToIfNotPM(isPM, userID, 'You mustn\'t be part of Club Members or Staff to use this command'));

				let token = args[0];
				if (typeof token === 'undefined' || token.length === 0)
					return respond(channelID, replyToIfNotPM(isPM, userID, reqparams(command)));
				if (/^[a-z\d]{10,}$/.test(token))
					return respond(channelID, replyToIfNotPM(isPM, userID, 'Invalid token'));

				bot.simulateTyping(channelID);

				unirest.post(config.SITE_ABSPATH+'u/discord-verify?token='+token)
					.header("Accept", "application/json")
					.end(function(result){
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'Verifyiing account failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						let data = result.body;
						if (!data.status)
							return respond(channelID, replyToIfNotPM(isPM, userID, 'Error: '+data.message));

						if (data.role !== 'member')
							return respond(channelID, replyToIfNotPM(isPM, userID, 'You are not a club member.'));

						bot.addToRole({
							serverID: OurServer.id,
							userID: userID,
							roleID: OurRoleIDs['Club Members'],
						},function(err){
							if (err){
								console.log(err);
								return respond(channelID, replyToIfNotPM(isPM, userID, 'Adding the Club Members role failed. ' + (hasOwner ? '<@' + config.OWNER_ID + '>' : 'The bot owner') + ' should see what caused the issue in the logs.'));
							}

							OurServer.members[userID].roles.push(OurRoleIDs['Club Members']);

							respond(channelID, replyToIfNotPM(isPM, userID, "You've been added to Club Members. Welcome to the Discord server!"));
							respond(OurChannelIDs.staffchat, '<@'+userID+'> was added to <@&'+OurRoleIDs['Club Members']+'> after verifying their identity.');
						});
					});
			})(); break;
			case "lewder": (function(){
				unirest.get('https://derpibooru.org/images/1308747.json')
					.header("Accept", "application/json")
					.end(function(result){
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return respond(channelID, replyTo(userID, 'Derpibooru image data retrieval failed (HTTP '+result.status+'). '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see what caused the issue in the logs.'));
						}

						respondWithDerpibooruImage(result.body);
					});
			})(); break;
			case "tut":
			case "tutorials": (function(){
				let url = 'http://mlp-vectorclub.deviantart.com/gallery/34905690/Tutorials';
				if (typeof args[0] === 'string'){
					switch (args[0]){
						case "ai":
						case "illustrator":
							url = 'http://mlp-vectorclub.deviantart.com/gallery/36301008/Tutorials-Illustrator';
						break;
						case "anim":
						case "animation":
							url = 'http://mlp-vectorclub.deviantart.com/gallery/40236819/Tutorials-Animation';
						break;
						case "is":
						case "inkscape":
							url = 'http://mlp-vectorclub.deviantart.com/gallery/36301003/Tutorials-Inkscape';
						break;
						case "ps":
						case "photoshop":
							url = 'http://mlp-vectorclub.deviantart.com/gallery/36301006/Tutorials-Photoshop';
						break;
					}
				}
				respond(channelID, replyToIfNotPM(isPM, userID, '<'+url+'>'));
			})(); break;
			case "e":
			case "eval": (function(){
				if (isPM)
					return respond(channelID, onserver);

				if (typeof evalTimedOut[userID] !== 'undefined'){
					let now = moment();
					if (now.diff(evalTimedOut[userID]) < 0){
						let usein = evalTimedOut[userID].add(2, 'minutes').from(now);
						return respond(channelID, replyToIfNotPM(isPM,userID,'You will be allowed to use the `/eval` command again '+usein+' (contains a 2-minute penalty for attempting to use it again before the timeout ends).'));
					}
				}

				let code = argStr.replace(/^`(?:``(?:js)?\n)?/, '').replace(/`+$/,''),
					output,
					vm = new VM({ sandbox: vmSandbox, timeout: vmTimeout });
				try {
					output = vm.run(code);
					if (typeof output !== 'undefined' && typeof output.rawOutput !== 'undefined')
						output = output.rawOutput;
					else output = wrapOutput(util.inspect(output,{breakLength:1}));
				}
				catch(e){
					let estr = ''+e;
					output = wrapOutput(estr);
					console.log('Exception while evaling code:\n\n'+code+'\n\n'+e.stack+'\n===============');
					if (estr === 'Error: Script execution timed out.'){
						evalTimedOut[userID] = moment().add(5, 'minutes');
						output = 'Your script took longer than '+(vmTimeout/1000)+' seconds to execute. Please refrain from running heavy operations _(e.g. infinite loops)_. You\'ll be able to use the `/eval` command again in 5 minutes.';
						console.log(getIdent(userID)+' has been timed out for 5 minutes due to ptential eval misuse');
					}
				}
				respond(channelID, replyToIfNotPM(isPM,userID,output));
			})(); break;
			case "nice":
				if (isPM)
					return respond(channelID, onserver);

				respond(channelID, replyTo(userID,'https://youtube.com/watch?v=ffQmb-cNFuk'));
			break;
			case "age":
				if (isPM)
					return respond(channelID, onserver);

				let age = moment(new Date((OurServer.id / 4194304) + 1420070400000)),
					delta = age.fromNow();
				respond(channelID, replyTo(userID,'The server was created on '+(age.format('Do MMMM, YYYY'))+' ('+delta+')'));
			break;
			case "welcomemsg": (function(){
				if (!isPM)
					wipeMessage(channelID, event.d.id);
				respond(OurChannelIDs.welcome,
					`__**Welcome to the MLP-VectorClub's Discord Server!**__\n\n`+
					getRules()+ // Always ends with a spare newline
					`\nPlease send the command \`/read\` to this channel to reveal the rest of the channels on our server and start chatting. You can always get this information again by running the \`/rules\` command.`
				);
			})(); break;
			case "rules": (function(){
				if (!isPM)
					wipeMessage(channelID, event.d.id);
				respond(userID, '__**Server rules:**__\n\n'+getRules());
			})(); break;
			// Ignore Discord's own commands
			case "gamerscape":
			case "xvidb":
			case "giphy":
			case "tenor":
			case "me":
			case "tableflip":
			case "unflip":
			case "shrug":
			case "nick":
			case "say": break;
			default:
				let notfound = `Command \`/${command}\` not found`;
				console.log(notfound);
				respond(channelID, replyToIfNotPM(isPM, userID, `${notfound}. Use \`/help\` to see a list of all available commands`));
		}
	}

	function processCommand(userID, channelID, message, event){
		let isPM = !(channelID in bot.channels),
			commandRegex = new RegExp('^\\s*'+(!isPM?'(?:<[@#]\\d+>)?\\s*':'')+'[!/](\\w+)(?:\\s+([ -~]+|`(?:``(?:js)\\n)?[\\S\\s]+`(?:``)?)?)?$'),
			userIdent = getIdent(userID);
		console.log(userIdent+' ran '+message+' from '+(isPM?'a PM':chalk.blue('#'+bot.channels[channelID].name)));
		if (!commandRegex.test(message)){
			let matchingCommand = message.match(/^([!/]?\S+)/);
			return bot.sendMessage({
				to: channelID,
				message: replyTo(userID, 'Invalid command'+(matchingCommand ? ': '+matchingCommand[1] : '')),
			});
		}
		let commandMatch = message.match(commandRegex);
		if (!commandMatch)
			return;
		let command = commandMatch[1],
			argStr = commandMatch[2] ? commandMatch[2].trim() : '',
			args = argStr ? argStr.split(/\s+/) : [];

		callCommand(userID, channelID, message, event, userIdent, command, argStr, args);
	}

	let interactions = {
		greetingsNoThere: ['Hello!','Hi!','Hey!'],
		greetings: ['Hey there!','Hello there!','Hi there!'],
		bestpony: ['What a silly question, obviously it\'s me!','I have to go with yours truly on that one.','Duh, of course it\'s me!','Me.'],
		bestprincess: ["I'd rather not start a flame war","Yes.","I don't have a strong opinion."],
		joke: ["I would if I knew any.","The guy who coded me was too lazy to add any jokes here, sorry.","Just go on imgur or something"],
		cgfound: ['Here you go:','Indeed, here:','Yep, right here:'],
		cgnotfound: ["I'm afraid there isn't one yet.","I'm pretty sure there isn't one, unless you mistyped the name.","Seems like there isn't one."],
		shyGreeting: ['_blushes_','Oh... h-h-hello ^^,','Hi ^^,','H-hi!'],
		thebest: ["I know, you don't have to remind me.","Was there ever any doubt?","Of course I am!","Can't argue with that."],
		insulted: ["I just don't know what went wrong","I'm not sure I deserved that","Please donQt be mean.","I thought we were friends :c","Well, that escalated quickly."],
	};
	function interact(userID, channelID, message){
		const
			userIdent = getIdent(userID),
			isPM = !(channelID in bot.channels),
			respondWithInteraction = (which)=>{
				let randomResponse = interactions[which].randomElement();
				console.log('Responded to '+userIdent+' with "'+randomResponse+'"');
				respond(channelID, replyToIfNotPM(isPM, userID, randomResponse));
			};
		if (isPM)
			console.log('PM interaction initiated by '+userIdent+', message: '+message);

		let normalized = message.toLowerCase(),
			normalizedParts = normalized.split(/\s+/);
		normalized = normalizedParts.join(' ');

		if (this.lax){
			let depth = 0,
				whois = () => {
					console.log(normalizedParts[depth]);
					switch(normalizedParts[depth++]){
						case "best":
							switch(normalizedParts[depth++]){
								case "pony":
								case "pony?":
									return respondWithInteraction('bestpony');
								break;
								case "princess":
								case "princess?":
									return respondWithInteraction('bestprincess');
								break;
							}
						break;
					}
				},
				youare = () => {
					console.log(normalizedParts[depth]);
					switch(normalizedParts[depth++]){
						case "the":
							switch(normalizedParts[depth++]){
								case "best":
									return respondWithInteraction('thebest');
								break;
							}
						break;
					}
				};

			switch(normalizedParts[depth++]){
				case "hi":
				case "hey":
				case "hello":
					if (/(cutie|qt|sweetie|sweetheart)$/.test(normalized))
						return respondWithInteraction('shyGreeting');
					if (/^there!?/.test(normalizedParts[depth]))
						return respondWithInteraction('greetingsNoThere');
					if (!normalizedParts[depth])
						return respondWithInteraction('greetings');
				break;
				case "hi!":
				case "hey!":
				case "hi?":
					return respondWithInteraction('greetings');
				break;
				case "who":
					switch(normalizedParts[depth++]){
						case "is":
							return whois();
						break;
					}
				break;
				case "who's":
					return whois(0);
				break;
				case "tell":
					switch(normalizedParts[depth++]){
						case "me":
							switch(normalizedParts[depth++]){
								case "a":
									switch(normalizedParts[depth++]){
										case "joke":
											return respondWithInteraction('joke');
										break;
									}
								break;
							}
						break;
					}
				break;
				case "you're":
					return youare();
				break;
				case "you":
					switch(normalizedParts[depth++]){
						case "are":
							return youare();
						break;
					}
				break;
				case "fuck":
					switch(normalizedParts[depth++]){
						case "you":
							return respondWithInteraction('insulted');
						break;
					}
				break;
			}
		}

		let cgtest = /^(?:is|si) t(?:he|eh)re a (?:colou?r ?)?guide for([\w\s]+)\??$/;
		if (cgtest.test(normalized)){
			bot.simulateTyping(channelID);
			let query = normalized.match(cgtest)[1].trim(),
				eqgTest = /\bhuman\b/,
				eqg = eqgTest.test(normalized);

				unirest.get(config.SITE_ABSPATH+'cg'+(eqg?'/eqg':'')+'/1?js=true&q='+encodeURIComponent(query)+'&GOFAST=true')
					.header("Accept", "application/json")
					.end(function (result) {
						if (result.error || typeof result.body !== 'object'){
							console.log(result.error, result.body);
							return respond(channelID, replyToIfNotPM(isPM, userID, 'I could not check it right now. '+(hasOwner?'<@'+config.OWNER_ID+'>':'The bot owner')+' should see why in the logs.'));
						}

						let data = result.body;
						if (!data.status)
							return respond(channelID, replyToIfNotPM(isPM, userID, interactions.cgnotfound.randomElement()));

						respond(channelID, replyToIfNotPM(isPM, userID, interactions.cgfound.randomElement()+' '+config.SITE_ABSPATH+(data.goto.substring(1))));
					});
		}
	}

	function onMessage(_, userID, channelID, message, event) {
		if (userID === bot.id)
			return;

		let isPM = !(channelID in OurServer.channels);

		let args = [].slice.call(arguments,1),
			callHandler = function(){
				if (channelID === OurChannelIDs.welcome){
					wipeMessage(channelID,event.d.id);
					if (message.trim().indexOf('/read') === 0){
						bot.addToRole({
							serverID: OurServer.id,
							userID: userID,
							roleID: OurRoleIDs['Informed'],
						},function(err){
							if (!err)
								console.log('Error while adding Informed role to '+userID);

							let response = err ? 'Failed to add Informed role' :'';

							response = addErrorMessageToResponse(err, response);

							if (response)
								return respond(channelID, response);

							OurServer.members[userID].roles.push(OurRoleIDs['Informed']);

							respond(OurChannelIDs.casual, `Please welcome <@${userID}> on our server!`);
						});
					}
					return;
				}
				let mentionAtStartRegex = /^\s*<[@#](\d+)>\s*/,
					mentionAtEndRegex = /\s*<[@#](\d+)>\s*$/,
					mentioned;
				if (mentionAtStartRegex.test(message)){
					mentioned = message.match(mentionAtStartRegex)[1];
					message = message.replace(mentionAtStartRegex,'');
					args[2] = message;
				}
				else if (mentionAtEndRegex.test(message)){
					mentioned = message.match(mentionAtEndRegex)[1];
					message = message.replace(mentionAtEndRegex,'');
					args[2] = message;
				}
				if (/^\s*[!/]\w+/.test(message))
					return processCommand.apply(this, args);
				interact.apply({ lax: isPM || mentioned === bot.id }, args);
			};

		if (!isPM)
			callHandler();
		else if (channelID in bot.directMessages){
			if (!(userID in OurServer.members))
				return respond(channelID, 'You must be a member of the '+OurServer.name+' Discord server to use this bot!');

			console.log('Received PM from #'+userID+' (@'+getIdent(userID)+'), contents: '+message);

			callHandler();
		}
	}
	bot.on('message', onMessage);

	bot.on('messageUpdate', function(_, newMsg, event){
		if (typeof newMsg.author === 'undefined')
			return;
		onMessage(null, newMsg.author.id, newMsg.channel_id, newMsg.content, event);
	});

	if (hasOwner)
		getVersion(config.OWNER_ID,config.OWNER_ID,function(ver){
			bot.setPresence({ game: { name: (config.LOCAL?'a local ':'')+'version'+(config.LOCAL?'':' '+ver) } });
		});

	bot.on('disconnect', function(errMsg, code){
		console.log('[DISCONNECT:'+code+'] '+errMsg);
		setTimeout(function(){
			process.exit();
		}, 5000);
	});

	process.on('SIGINT', function(){
		console.log('Goodbye cruel world.');
		idle();
		process.exit();
	});
	process.on('exit', idle);
	function idle(){
		bot.setPresence({ idle_since: Date.now() });
	}
}
