'use strict';
require('console-stamp')(console, {
  format: ':date(yyyy-mm-dd HH:MM:ss.l) :label'
});

require('dotenv').config();

const Server = require('./classes/Server');

if (process.env.LOCAL === 'true' && /^https:/.test(process.env.SITE_ABSPATH))
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

process.on('unhandledRejection', r => console.error(r));
process.on('SIGINT', () => {
  console.error('Interrupt signal received');
  Server.idle();
  setTimeout(function () {
    process.exit();
  }, 10);
});
process.on('exit', Server.idle);

Server.makeClient();
