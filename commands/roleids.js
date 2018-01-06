const
	Command = require('../classes/Command'),
	Server = require('../classes/Server');

module.exports = new Command({
	name: 'roleids',
	help: 'Returns a list of role IDs on the server',
	perm: 'isOwner',
	usage: [true],
	allowPM: true,
	action: args => {
		let message = [];
		Server.our.roles.array().forEach(function(role){
			message.push(`${role.id} (${role.name})`);
		});
		Server.reply(args.message, `List of available roles in ${Server.our.name}:\n\`\`\`\n${message.join('\n')}\n\`\`\``);
	}
});
