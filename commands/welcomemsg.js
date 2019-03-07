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
  action: async args => {
    if (!args.isPM)
      Server.wipeMessage(args.message);

    const welcomeChannel = Server.findChannel('welcome');
    const oldMessages = await welcomeChannel.fetchMessages();

    try {
      // Post rules
      await Server.send(welcomeChannel, `__**Welcome to the MLP-VectorClub's Discord Server!**__`);
      const rulesText = `We have a few rules that you should keep in mind:\n\n${Server.getRules()}`;
      const slices = rulesText.split(/-----/g);
      while (slices.length){
        await Server.send(welcomeChannel, slices.splice(0, 1)[0]);
      }
      await Server.send(welcomeChannel, `Please send the command **/read** to this channel to reveal the rest of the channels on our server and start chatting. You can always get this information again by running the \`/rules\` command.`);

      // Scrub old messages
      oldMessages.forEach(async message => await message.delete());

      // Notify the staff channel
      Server.send(Server.findChannel('staffchat'), Server.mention(args.author) + ' updated the rules in ' + Server.mention(Server.findChannel('welcome')));
    } catch (err){
      console.log('fail', err);
      failure(err, args);
    }
  },
});
