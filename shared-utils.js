/**
 * @return {string}
 */
function mentionUser(id){
	return `<@!${id}>`;
}
/**
 * @return {string}
 */
function mentionChannel(id){
	return `<#${id}>`;
}
/**
 * @return {string}
 */
function mentionRole(id){
	return `<@&${id}>`;
}
module.exports = {
	replyTo: (author, message) => `${mentionUser(author.id)} ${message}`,
	reqparams: cmd => `This command requires additional parameters. Use \`/help ${cmd}\` for more information.`,
	onserver: 'This command must be run from within a channel on our server.',
	root: __dirname.replace(/[\\\/]$/,''),
	mentionUser,
	mentionChannel,
	mentionRole,
};
