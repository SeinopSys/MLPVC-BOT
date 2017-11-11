const replyTo = (userID, message) => "<@" + userID + "> " + message;
const replyToIfNotPM = (isPM, userID, message) => (isPM ? message : replyTo(userID, message));
const reqparams = cmd => 'This command requires additional parameters. Use `/help ' + cmd + '` for more information.';
const onserver = 'This command must be run from within a channel on our server.';

module.exports = {
	replyTo,
	replyToIfNotPM,
	reqparams,
	onserver,
	root: __dirname.replace(/[\\\/]$/,''),
};
