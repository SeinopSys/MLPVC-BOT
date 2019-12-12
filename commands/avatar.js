const
  Discord = require('discord.js'),
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'avatar',
  help: () => "This command can be used to change the bot's avatar by passing an image URL, or set it back to the default by passing `reset`.",
  perm: 'isStaff',
  usage: ['http://placehold.it/300x300/000000/ffffff.png?text=Penny%20Curve', 'reset'],
  allowPM: true,
  action: args => {
    let url = args.argStr.trim(),
      reset = url === 'reset',
      actioned = reset ? 'reset' : 'updated',
      setAvatar = function (avatarPath) {
        Server.client.user.setAvatar(avatarPath).then(() => {
          let
            outputChannel = Server.findChannel('staffchat'),
            staffChatExists = outputChannel instanceof Discord.Channel;
          if (!Server.channelExists('staffchat')) {
            if (args.isPM)
              console.warn('#staffchat channel does not exist, could not send avatar update message');
            else outputChannel = args.channel;
          }

          if (!args.isPM)
            Server.wipeMessage(args.message);
          else Server.send(args.channel, `The bot's avatar has been ${actioned}${staffChatExists ? ', and a notice was sent to the other staff members' : ''}.`);
          Server.send(outputChannel, `The bot's avatar has been ${actioned} by ${Server.mention(args.author)}${args.isPM ? ' (via PM)' : ''}${!reset ? ` to the following ximage: ${url}` : ''}`);
        }).catch(err => {
          console.error(err);
          return Server.reply(args.message, 'Setting avatar failed. ' + Server.mentionOwner(args.author.id) + ' should see what caused the issue in the logs.');
        });
      };
    if (reset)
      return setAvatar('./assets/default_avatar.png');

    if (!/^https?:\/\/.*$/.test(url))
      return Server.reply(args.message, 'The parameter must be a valid URL');
    setAvatar(url);
  },
});
