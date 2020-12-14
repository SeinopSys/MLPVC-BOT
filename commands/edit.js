const
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  util = require('../shared-utils'),
  channelNames = require('../channel-names');

module.exports = new Command({
  name: 'edit',
  help: () => 'Allows editing messages posted by the bot in the current channel. The first parameter is a message ID, which you can get by turning on Developer mode in Discord settings, then right-clicking a message and selecting "Copy ID", and the second parameter is a replacement command, where the first character is a separator, followed by a pattern, the separator, the replacement string and the separator again, optionally followed by flags.\nFlags are identical to the ones shown here: <https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#Parameters>\nThe only exception is the `g` flag, which is enabled by default even if it\'s not specified. Passing an uppercase `G` in the flags will disable the automatic `g` flag.',
  perm: 'isStaff',
  usage: ['98713564826483 |this|that|', '92384962349237 |first occurrence|1st occurrence|G'],
  allowPM: false,
  action: args => {
    // Don't post responses in the #welcome channel
    const inWelcome = args.channel.name === channelNames.WELCOME;
    const notify = inWelcome ? args.author : args.channel;

    if (args.argArr.length < 2)
      return Server.send(notify, util.replyTo(args.author.id, util.reqparams(args.command)));

    const messageID = args.argArr[0];
    if (/\D/.test(messageID))
      return Server.reply(args.message, 'Message ID can only contain numbers');

    const
      repl = args.argStr.replace(messageID, '').trim(),
      separator = repl[0];
    if (!/^(\S).*[^\\]\1.*\1([imuyG]+)?$/.test(repl))
      return Server.reply(args.message, 'Replacement command is invalid');

    let [pattern, replacement, flags] = repl.split(separator).slice(1, 4);
    // Force global flag, disable with G
    if (flags.indexOf('G') === -1)
      flags = (flags || '') + 'g';
    else flags = flags.replace('G', '');

    args.channel.messages.fetch(messageID).then(message => {
      const newContent = message.content.replace(new RegExp(pattern, flags), replacement);

      if (newContent === message.content)
        return Server.reply(args.message, 'Your replacement made no changes to the message');

      message.edit(newContent).then(() => {
        Server.reply(args.message, `Message${inWelcome ? ` ${message.id} in ${Server.mention(message.channel)}` : ''} updated`);
      }).catch(e => {
        if (e.code === 50005)
          return Server.reply(args.message, e.message);
        console.error(e);
        return Server.reply(args.message, `Message could not be edited. ${Server.mentionOwner(args.authorID)} should see what caused this in the logs.`);
      });
    }).catch(e => {
      console.error(e);
      return Server.reply(args.message, `Failed to get message text from Discord. ${Server.mentionOwner(args.authorID)} should see what caused this in the logs.`);
    });
  },
});
