const
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'channels',
  help: () => 'Returns available channels on our server (used for initial script setup)',
  perm: 'isOwner',
  usage: [true],
  allowPM: true,
  action: args => {
    let ids = [];
    Server.guild.channels.array().forEach(channel => {
      ids.push(`├ ${channel.type === 'text' ? '#' : ' '}${channel.name} (${channel.id})`);
    });
    ids.push(ids.pop().replace('├', '└'));
    Server.reply(args.message, "```" + Server.guild.name + " (" + Server.guild.id + ")\n" + ids.join('\n') + '```');
  }
});
