const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

const failure = (err, args) => {
	console.log(err);
	Server.bot.sendMessage({
		to: args.channelID,
		message: `A message to <#${Server.channelids.casual}> failed to send. (HTTP ${err.statusCode})\n${Server.mentionOwner(args.userID)} should see what caused the issue in the logs.`,
	});
};

module.exports = new Command({
	name: 'welcome',
	help: `Welcomes the specified user as the bot`,
	perm: 'isStaff',
	usage: [Server.bot.username, Server.bot.username+'#'+Server.bot.discriminator, Server.bot.id],
	action: args => {
		if (!args.isPM)
			Server.wipeMessage(args.channelID, args.event.d.id);

		const user = Server.getUserData(args.argArr[0], args);
		if (user === false)
			return;

		Server.respond(Server.channelids.casual, `Please welcome <@${user.id}> to our server!`, function(err){
			if (err)
				failure(err, args);
		});
	}
});
