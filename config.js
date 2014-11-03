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
 * The database related configuration
 *
 * @see https://github.com/sequelize/sequelize/wiki/API-Reference-Sequelize#new-sequelize
 */
config.db = {
    'database': 'grasshopper',
    'username': 'grasshopper',
    'password': 'grasshopper',
    'dialect': 'postgres',
    'port': 5432
};

// Pretty-print the logs to standard out
var prettyStdOut = new PrettyStream();
prettyStdOut.pipe(process.stdout);

/*!
 * The log related configuration
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
 */
config.cookie = {
    'secret': 'The only reason for time is so that everything doesn\'t happen at once.'
};

/*!
 * The servers related configuration
 */
config.servers = {
    'adminHostname': 'admin.grasshopper.com',
    'adminPort': 2000,
    'appsPort': 2001
};

/*!
 * The mixpanel related configuration
 */
config.mixpanel = {
    'enabled': false,
    'token': '564046938b572e5b562978febcba6cfb'
};
