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

/*
 * Dump the organisational units, series and events data from an application to disk
 */

var _ = require('lodash');
var fs = require('fs');
var yargs = require('yargs');

var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('scripts/orgunit-import');
var OrgUnitDAO = require('gh-orgunit/lib/internal/dao');

var config = require('../../../config');

var argv = yargs
    .usage('Export all the organisational units, series and events data in an application.\nUsage: $0')
    .example('$0 --output tree.json --app 19', 'Export the structure to tree.json for application 19')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The JSON file to write the tree too')

    .demand('a')
    .alias('a', 'app')
    .describe('a', 'The id of the application for which the tree should be exported')

    .argv;

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        log().error({'err': err}, 'Failed to spin up the application container');
        process.exit(1);
    }

    log().info('Getting all the courses');
    getCourses(function(courses) {

        log().info('Exporting all the courses');
        exportCourses(courses, function(courses) {

            log().info('Flushing courses to disk');
            writeCourses(courses, function() {
                process.exit(0);
            });
        });
    });
});

/**
 * Get all the courses in the application
 */
var getCourses = function(callback) {
    OrgUnitDAO.getOrgUnits(argv.app, null, ['course'], null, function(err, orgUnits) {
        if (err) {
            log().error({'err': err}, 'Failed to get the root nodes');
            process.exit(1);
        }

        return callback(orgUnits);
    });
};

/**
 * Export the organisational units, event series and events under the courses
 */
var exportCourses = function(courses, callback, _exportedCourses) {
    _exportedCourses =  _exportedCourses || [];
    if (_.isEmpty(courses)) {
        return callback(_exportedCourses);
    }

    var course = courses.pop();
    log().info({'id': course.id}, 'Exporting %s', course.displayName);
    OrgUnitDAO.exportOrgUnit(course, 'json', function(err, exportedCourse) {
        if (err) {
            log().error({'err': err, 'course': course.id}, 'Failed to export a course');
            process.exit(1);
        }

        // Remove the id properties from the exported courses
        visitOrgUnit(exportedCourse);

        _exportedCourses.push(exportedCourse);
        exportCourses(courses, callback, _exportedCourses);
    });
};

/**
 * Remove the `id` and `ParentId` from every exported organisational unit
 */
var visitOrgUnit = function(orgUnit) {
    delete orgUnit.id;
    delete orgUnit.ParentId;

    _.each(orgUnit.children, visitOrgUnit);
    _.each(orgUnit.series, function(series) {
        delete series.id;
        _.each(series.events, function(event) {
            delete event.id;
        });
    });
};

/**
 * Write the courses to disk
 */
var writeCourses = function(courses, callback) {
    fs.writeFile(argv.output, JSON.stringify(courses, null, 4), function(err) {
        if (err) {
            log().error({'err': err}, 'Could not save the courses');
            process.exit(1);
        }

        return callback();
    });
};
