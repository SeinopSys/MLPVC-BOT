const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

const failure = (err, args) => {
	console.error(err);
	args.channel.send(`A message to ${Server.mention(Server.findChannel('welcome'))} failed to send. (HTTP ${err.statusCode})\n${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
};

module.exports = new Command({
	name: 'welcomemsg',
	help: `Sends the welcome message to the ${Server.mention(Server.findChannel('welcome'))} channel.`,
	perm: 'isStaff',
	usage: [true],
	allowPM: true,
	action: args => {
		if (!args.isPM)
			Server.wipeMessage(args.message);

		const welcomeChannel = Server.findChannel('welcome');

		Server.send(welcomeChannel, `__**Welcome to the MLP-VectorClub's Discord Server!**__`).then(() => {
			Server.send(welcomeChannel, `We have a few rules that you should keep in mind:\n\n${Server.getRules()}`).then(() => {
				Server.send(welcomeChannel, `Please send the command **/read** to this channel to reveal the rest of the channels on our server and start chatting. You can always get this information again by running the \`/rules\` command.`).then(() => {
					Server.send(Server.findChannel('staffchat'), Server.mention(args.author)+' updated the rules in '+Server.mention(Server.findChannel('welcome')));
				}).catch(err => {
					failure(err, args);
				});
			}).catch(function(err){
				failure(err, args);
			});
		}).catch(function(err){
			failure(err, args);
		});
	}
});
