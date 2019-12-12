const
  Command = require('../classes/Command'),
  Server = require('../classes/Server'),
  moment = require('moment'),
  util = require('util'),
  {VM} = require('vm2'),
  wrapOutput = (output) => '```js\n' + output + '\n```',
  vmTimeout = 5000,
  vmSandbox = {
    process: {
      exit: function () {
        return {rawOutput: 'Nice try'}
      },
    },
    choice: function () {
      let items = [].slice.apply(arguments);
      return items[Math.floor(Math.random() * items.length)];
    },
    // Convert HEX to RGB
    hex2rgb: hexstr =>
      ({
        r: parseInt(hexstr.substring(1, 3), 16),
        g: parseInt(hexstr.substring(3, 5), 16),
        b: parseInt(hexstr.substring(5, 7), 16)
      }),
    // Convert RGB to HEX
    //jshint -W016
    rgb2hex: color => '#' + (
      16777216 +
      (parseInt(color.length ? color[0] : color.r, 10) << 16) +
      (parseInt(color.length ? color[1] : color.g, 10) << 8) +
      parseInt(color.length ? color[2] : color.b, 10)
    ).toString(16).toUpperCase().substring(1),
  },
  evalTimedOut = {};

module.exports = new Command({
  name: 'eval',
  help: () => 'Evaluates an arbitrary JavaScript expression using `safe-eval` (<https://www.npmjs.com/package/safe-eval>)',
  perm: 'everyone',
  usage: ['2+2', 'Math.random()', '"Te" + "xt"'],
  allowPM: false,
  action: args => {
    if (typeof evalTimedOut[args.authorID] !== 'undefined') {
      let now = moment();
      if (now.diff(evalTimedOut[args.authorID]) < 0) {
        let usein = evalTimedOut[args.authorID].add(2, 'minutes').from(now);
        return Server.reply(args.message, `You will be allowed to use the \`/eval\` command again ${usein} (contains a 2-minute penalty for attempting to use it again while being timed out).`);
      }
    }

    let code = args.argStr.replace(/^`(?:``(?:js)?\n)?/, '').replace(/`+$/, ''),
      output,
      vm = new VM({sandbox: vmSandbox, timeout: vmTimeout});
    try {
      output = vm.run(code);
      if (typeof output !== 'undefined' && typeof output.rawOutput !== 'undefined')
        output = output.rawOutput;
      else output = wrapOutput(util.inspect(output, {breakLength: 1}).replace(/([^\\])\\n/g, '$1\n'));
    } catch (e) {
      let estr = '' + e;
      output = wrapOutput(estr);
      console.error('Exception while evaling code:\n\n' + code + '\n\n' + e.stack + '\n===============');
      if (estr === 'Error: Script execution timed out.') {
        // noinspection JSDeprecatedSymbols
        evalTimedOut[args.authorID] = moment().add(5, 'minutes');
        output = 'Your script took longer than ' + (vmTimeout / 1000) + ' seconds to execute. Please refrain from running heavy operations _(e.g. infinite loops)_. You\'ll be able to use the `/eval` command again in 5 minutes.';
        console.info(`${Server.getIdent(args.authorID)} has been timed out for 5 minutes due to ptential eval misuse`);
      }
    }
    Server.reply(args.message, output);
  }
});
