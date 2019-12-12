class Command {
  constructor(opts) {
    this.name = opts.name;
    this.perm = opts.perm;
    this.help = opts.help;
    this.aliases = opts.aliases;
    this.usage = opts.usage;
    this.action = opts.action;
    this.allowPM = opts.allowPM;
  }
}

module.exports = Command;
