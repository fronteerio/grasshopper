/**
 * Copyright (c) 2014 "Fronteer LTD"
 * Grasshopper Event Engine
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var bunyan = require('bunyan');
var PrettyStream = require('bunyan-prettystream');

// The global config object
var config = module.exports = {};

/*!
 * The database related configuration. Although Sequelize supports multiple database systems,
 * Grasshopper only supports PostgreSQL.
 *
 * @property  {String}      database        The name of the database to connect to
 * @property  {String}      username        The name of the user to connect with
 * @property  {String}      password        The password to authenticate with
 * @property  {Number}      port            The port to connect to
 * @property  {Boolean}     dropOnStartup   Whether to drop all the data in the database and re-creating each table. This does *NOT* work when ran in the `production` environment
 * @see https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#new-sequelize
 */
config.db = {
    'database': 'grasshopper',
    'username': 'grasshopper',
    'password': 'grasshopper',
    'port': 5432,
    'dropOnStartup': false
};

// Pretty-print the logs to standard out
var prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

/*!
 * The log related configuration
 *
 * @property  {Object[]}    streams                 A set of streams where logging statemnts can be sent to
 * @property  {String}      streams[i].level        Statements of this level or higher will be sent to the `stream`. Possible levels in ascending order: `trace`, `debug`, `info`, `warn`, `error` or `fatal`
 * @property  {Stream}      streams[i].stream       The stream to send the log statements to
 * @property  {Object}      serializers             Defines how the JSON log statements should be formatted before being passed to a stream
 * @see https://github.com/trentm/node-bunyan#streams-introduction
 */
config.log = {
    'streams': [
        {
            'level': 'info',
            'stream': prettyStdOut
        }
    ],
    'serializers': {
        'err': bunyan.stdSerializers.err,
        'req': bunyan.stdSerializers.req,
        'res': bunyan.stdSerializers.res
    }
};

/*!
 * The cookie related configuration
 *
 * @property  {String}      secret                  The string that should be used to encrypt cookies with. It's vital to the security of the system that you change this in production
 */
config.cookie = {
    'secret': 'The only reason for time is so that everything doesn\'t happen at once.'
};

/*!
 * The servers related configuration
 *
 * @property  {String}      adminHostname           The hostname on which the admin UI will be made available
 * @property  {Number}      adminPort               The port on which the admin API endpoints will be made available
 * @property  {Number}      appsPort                The port on which the regular application API endpoints will be made available
 * @property  {String}      shibbolethSPHost        The hostname on which the Shibboleth Service Provider software will be made available
 */
config.servers = {
    'adminHostname': 'admin.grasshopper.com',
    'adminPort': 2000,
    'appsPort': 2001,
    'shibbolethSPHost': 'shib-sp.grasshopper.com'
};

/*!
 * The signing related configuration
 *
 * @property  {String}      key                     This key will be used to sign sensitive information. It's vital to the security of the system that you change this in production
 */
config.signing = {
    'key': 'The default signing key, please change me.'
};

/*!
 * The statsd related configuration
 *
 * @property  {Boolean}     enabled                 Whether the application should push telemetry data into statsd
 * @property  {String}      host                    The hostname on which statsd can be reached
 * @property  {Number}      port                    The port on which statsd can be reached
 * @property  {String}      scope                   The prefix that should be prepended to each stat
 */
config.statsd = {
    'enabled': false,
    'host': '127.0.0.1',
    'port': 8125,
    'scope': 'gh'
};
