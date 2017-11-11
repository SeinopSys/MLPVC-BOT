const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

const failure = (err, args) => {
	console.log(err);
	Server.bot.sendMessage({
		to: args.channelID,
		message: `A message to <#${Server.channelids.welcome}> failed to send. (HTTP ${err.statusCode})\n${Server.mentionOwner(args.userID)} should see what caused the issue in the logs.`,
	});
};

module.exports = new Command({
	name: 'welcomemsg',
	help: `Sends the welcome message to the <#welcome> channel.`,
	perm: 'isStaff',
	usage: [true],
	action: args => {
		if (!args.isPM)
			Server.wipeMessage(args.channelID, args.event.d.id);

		Server.respond(Server.channelids.welcome, `__**Welcome to the MLP-VectorClub's Discord Server!**__`, function(err){
			if (err)
				return failure(err, args);

			Server.respond(Server.channelids.welcome, 'We have a few rules that you should keep in mind:\n\n'+Server.getRules(), function(err){
				if (err)
					return failure(err, args);

				Server.respond(Server.channelids.welcome, `Please send the command **/read** to this channel to reveal the rest of the channels on our server and start chatting. You can always get this information again by running the \`/rules\` command.`, function(err){
					if (err)
						return failure(err, args);
				});
			});
		});
	}
});
