const
  unirest = require('unirest'),
  util = require('../shared-utils'),
  Command = require('../classes/Command'),
  Server = require('../classes/Server');

module.exports = new Command({
  name: 'colorguide',
  help: () => "This command can be used to quickly link to an appearance using the site's \"I'm feeling lucky\" search. The query is sent to the website as-is and the first result's link is returned, if any.\nUse names/tags separated by spaces, or include `*` and `?` characters to perform a wildcard search. Include the term `human` to search the EQG guide.",
  usage: ['twilight sparkle', '*pommel*', 'human twilight'],
  perm: 'everyone',
  allowPM: true,
  action: args => {
    if (!args.argArr.length)
      return Server.reply(args.message, util.reqparams(args.command));

    let query = args.argStr,
      humanRegex = /\bhuman\b/g,
      eqg = humanRegex.test(query);
    if (eqg)
      query = query.replace(humanRegex, '');
    unirest.get(`${process.env.SITE_ABSPATH}cg${eqg ? '/eqg' : '/pony'}?btnl&json&q=${encodeURIComponent(query)}`)
      .header("Accept", "application/json")
      .end(function (result) {
        if (result.error || typeof result.body !== 'object') {
          console.error(result.error, result.body);
          return Server.reply(args.message, `Color Guide search failed (HTTP ${result.status}). ${Server.mentionOwner(args.authorID)} should see what caused the issue in the logs.`);
        }

        let data = result.body;
        if (!data.status)
          return Server.reply(args.message, data.message);

        Server.reply(args.message, process.env.SITE_ABSPATH + (data.goto.substring(1)));
      });
  }
});
