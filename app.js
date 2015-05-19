#!/usr/bin/env node

/**
 * Copyright (c) 2015 "Fronteer LTD"
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

// Always run in UTC, no matter what
process.env.TZ = 'UTC';

var yargs = require('yargs');

var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('app');

var argv = yargs
    .usage('$0 [--config <path/to/config.js>]')
    .alias('c', 'config')
    .describe('c', 'Specify an alternative config file')
    .default('c', './config.js')
    .argv;

// If a relative path that starts with `./` has been provided,
// we turn it into an absolute path based on the current working directory
if (argv.config.match(/^\.\//)) {
    argv.config = process.cwd() + argv.config.substring(1);
// If a different non-absolute path has been provided, we turn
// it into an absolute path based on the current working directory
} else if (!argv.config.match(/^\//)) {
    argv.config = process.cwd() + '/' + argv.config;
}

var config = require(argv.config);

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (!err) {
        log().info('The server has started. Happy Hopping!');
    }
});
