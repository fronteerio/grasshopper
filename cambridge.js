#!/usr/bin/env node

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

var DB = require('gh-core/lib/db');
var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('cambridge');

var config = require('./config');

// Example script that sets up a Cambridge tenant and a timetable app

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        console.error(err);
        console.error('Failed to start up');
        process.exit();
        return;
    }

    // Create a tenant
    DB.Tenant.create({'displayName': 'Cambridge University'}).complete(function(err, tenant) {
        log().info('Created tenant: %s', tenant.displayName);

        // Create a timetable app
        DB.App.create({
            'displayName': 'Cambridge TimeTable',
            'hostname': 'timetable.cam.grasshopper.com',
            'type': 'timetable'
        })
        .complete(function(err, app) {
            log().info('Created an app: %s', app.displayName);

            tenant.setApps([app]).complete(function(err) {
                log().info('Made %s part of %s', app.displayName, tenant.displayName);

            });
        });
    });
});
