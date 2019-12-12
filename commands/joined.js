const
  moment = require('moment-timezone'),
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  Time = require('../classes/Time');

module.exports = new Command({
  name: 'joined',
  help: () => 'Displays when you joined the server',
  perm: 'everyone',
  usage: [true, '@Mention#1234'],
  allowPM: true,
  action: async args => {
    let id;
    if (typeof args.argArr[0] === 'string') {
      if (!(await Server.perm.isStaff.check(args.author.id)))
        return Server.reply(args.message, 'You must be staff to get join time for other users');

      const target = args.argArr[0];
      const targetUserData = await Server.getUserData(target, args);
      if (targetUserData === false)
        return;
      if (typeof targetUserData !== 'object')
        return Server.reply(args.message, 'Could not find the specified user');
      id = targetUserData.id;
    } else id = args.author.id;

    const
      member = await Server.findMember(id),
      date = member.joinedAt,
      age = moment(date).tz('UTC'),
      delta = Time.Remaining(new Date(), date),
      You = member.id === args.author.id ? 'You' : member.displayName || member.user.name;
    Server.reply(args.message, `${You} joined the server on ${age.format('Do MMMM, YYYY')} at ${age.format('HH:mm:ss z')} (${delta})`);
  },
});
