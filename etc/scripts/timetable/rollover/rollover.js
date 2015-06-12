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

// Always work in UTC
process.env.TZ = 'UTC';

var _ = require('lodash');
var fs = require('fs');
var moment = require('moment');
var yargs = require('yargs');

var Rollover = require('gh-series/lib/internal/patterns/cambridge/rollover');

var argv = yargs
    .usage('Roll over the dates from the input file.\nUsage: $0')
    .example('$0 --input 2014.json --output 2015.json --from 2014 --to 2015')

    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path of the file containing the input courses')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the rolled over courses should be stored')

    .demand('f')
    .alias('f', 'from')
    .describe('f', 'The academic year the input data is from')

    .demand('t')
    .alias('t', 'to')
    .describe('t', 'The academic year the output data should be in')
    .argv;

fs.readFile(argv.input, function(err, courses) {
    if (err) {
        console.error('Could not read the input file');
        process.exit(1);
    }

    courses = JSON.parse(courses);

    // Visit each course and roll over any data underneath it
    console.log('Rolling over dates for %d courses', courses.length);
    _.each(courses, function(course) {
        _visitOrgUnit(course);
    });

    // Write the courses back out
    fs.writeFile(argv.output, JSON.stringify(courses, null, 4), function(err) {
        if (err) {
            console.error('Could not write the rolled over courses to disk');
            console.error(err);
        }
    });
});

var _visitOrgUnit = function(orgUnit) {
    // Recursively deal with any subjects, parts or modules
    _.each(orgUnit.children, _visitOrgUnit);

    // Roll over the events in all the organisational unit's series
    _.each(orgUnit.series, function(series) {
        _.each(series.events, function(event) {
            event.start = Rollover.rollOverTimestamp(event.start, argv.from, argv.to);
            event.end = Rollover.rollOverTimestamp(event.end, argv.from, argv.to);
        });
    });
};
