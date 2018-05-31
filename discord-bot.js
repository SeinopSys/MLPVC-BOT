// jshint -W014
'use strict';
require("console-stamp")(console, {
	formatter: function(){
		return moment().format('YYYY-MM-DD HH:MM:ss.SSS');
	},
});

const
	moment = require('moment'),
	config = require('./config'),
	Server = require('./classes/Server');
Array.prototype.randomElement = function(){ return this[Math.floor(Math.random() * this.length)] };

if (config.LOCAL === true && /^https:/.test(config.SITE_ABSPATH))
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on('unhandledRejection', r => console.error(r));
process.on('SIGINT', () => {
	console.error('Interrupt signal received');
	Server.idle();
	setTimeout(function(){
		process.exit();
	}, 10);
});
process.on('exit', Server.idle);

Server.makeClient();
