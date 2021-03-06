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

var GrassHopper = require('gh-core/lib/api');
var repl = require('repl');

var config = require('./config');

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        console.error(err);
        console.error('Failed to start up a repl');
        process.exit();
        return;
    }

    var replServer = repl.start({
        'prompt': 'gh > '
    });

    replServer.context.DB = require('gh-core/lib/db');
});
