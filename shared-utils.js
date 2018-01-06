const Server = require('./classes/Server');
module.exports = {
	replyTo: (author, message) => `${Server.mention(author.id)} ${message}`,
	reqparams: cmd => `This command requires additional parameters. Use \`/help ${cmd}\` for more information.`,
	onserver: 'This command must be run from within a channel on our server.',
	root: __dirname.replace(/[\\\/]$/,''),
};
