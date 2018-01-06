const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

const failure = (err, args) => {
	console.error(err);
	args.channel.send(`A message to ${Server.mention(Server.findChannel('casual'))} failed to send. (HTTP ${err.statusCode})\n${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
};

module.exports = new Command({
	name: 'welcome',
	help: `Welcomes the specified user as the bot`,
	perm: 'isStaff',
	usage: [Server.client.user.username, '@'+Server.getIdent(), Server.client.user.id],
	allowPM: true,
	action: args => {
		if (!args.isPM)
			Server.wipeMessage(args.message);

		const user = Server.getUserData(args.argArr[0], args);
		if (user === false)
			return;

		Server.send(Server.findChannel('casual'), `Please welcome ${Server.mentionUser(user.id)} to our server!`, function(err){
			if (err)
				failure(err, args);
		});
	}
});
