const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'roleids',
  help: () => 'Returns a list of role IDs on the server',
  perm: 'isOwner',
  usage: [true],
  allowPM: true,
  action: args => {
    let message = [];
    Server.guild.roles.cache.array().forEach(function (role) {
      message.push(`${role.id} (${role.name})`);
    });
    Server.reply(args.message, `List of available roles in ${Server.guild.name}:\n\`\`\`\n${message.join('\n')}\n\`\`\``);
  }
});
