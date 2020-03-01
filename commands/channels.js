const
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  treeify = require('treeify');

const channelToString = channel => `${channel.type === 'text' ? '#' : ''}${channel.name} (${channel.id})`;

module.exports = new Command({
  name: 'channels',
  help: () => 'Returns available channels on our server (used for initial script setup)',
  perm: 'isOwner',
  usage: [true],
  allowPM: true,
  action: args => {
    const top = Symbol.for('top');
    const ids = {};
    Server.guild.channels.cache.array().forEach(channel => {
      const parent = channel.parentID || top;
      if (typeof ids[parent] === 'undefined')
        ids[parent] = [];
      const {type, name, id} = channel;
      ids[parent].push({type, name, id});
    });

    const simplifiedTree = {};
    ids[top].forEach(topLevelChannel => {
      const topLevelChannelName = channelToString(topLevelChannel);
      simplifiedTree[topLevelChannelName] = {};
      if (Array.isArray(ids[topLevelChannel.id])) {
        ids[topLevelChannel.id].forEach(channel => {
          const channelName = channelToString(channel);
          simplifiedTree[topLevelChannelName][channelName] = null;
        })
      }
    });

    Server.reply(args.message, "```" + Server.guild.name + " (" + Server.guild.id + ")\n" + treeify.asTree(simplifiedTree) + '```');
  }
});
