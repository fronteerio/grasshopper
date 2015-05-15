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

var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var yargs = require('yargs');

var AdminsDAO = require('gh-admins/lib/internal/dao');
var AppsAPI = require('gh-apps');
var Context = require('gh-context').Context;
var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('scripts/orgunit-import');
var OrgUnitImport = require('gh-orgunit/lib/internal/import');
var OrgUnitAPI = require('gh-orgunit');
var OrgUnitDAO = require('gh-orgunit/lib/internal/dao');

var config = require('../../../config');

/*
 * This script allows you to import a set of courses, subjects, parts, modules, series and events.
 *
 * It expects the input file to contain an array of course objects. Essentially, each course object
 * will be created if it doesn't exist already. The tree underneath the course will be imported
 * through the OrgUnitAPI's import logic.
 */
var argv = yargs
    .usage('Import a set of courses.\nUsage: $0')
    .example('$0 --input courses.json --app 19', 'Import the structure in courses.json for application 19')
    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The JSON file that contains the courses')

    .demand('a')
    .alias('a', 'app')
    .describe('a', 'The id of the application for which the courses should be imported')

    .argv;

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        log().error({'err': err}, 'Failed to spin up the application container');
        process.exit(1);
    }

    // Get a global administrator
    AdminsDAO.getGlobalAdminByUsername('administrator', function(err, globalAdmin) {
        if (err) {
            log().error({'err': err}, 'Failed to get the global administrator');
            process.exit(1);
        }

        // Get the app
        var ctx = new Context(null, globalAdmin);
        AppsAPI.getApp(ctx, argv.app, function(err, app) {
            if (err) {
                log().error({'err': err}, 'Failed to get the provided app');
                process.exit(1);
            }

            ctx = new Context(app, globalAdmin);

            log().info({'input': argv.input}, 'Reading the input file');
            fs.readFile(argv.input, function(err, courses) {
                if (err) {
                    log().error({'err': err, 'input': argv.input}, 'Failed to read the input file');
                    process.exit(1);
                }

                log().info('Parsing courses');
                courses = JSON.parse(courses);

                log().info('Checking whether some courses already exist');
                _checkIfCoursesExist(courses, function() {

                    log().info('Creating courses');
                    _createCourses(ctx, courses.slice(), function() {

                        log().info('Importing the tree under each course');
                        _importCourses(ctx, courses, function() {

                            log().info('All courses have been imported');
                            process.exit(0);
                        });
                    });
                });
            });
        });
    });
});

/**
 * Given a set of courses, check which ones already exist. If a match could be found, the `id` from
 * the organisational unit will be added on the course object
 *
 * @param  {Object[]}   courses     The courses to check
 * @param  {Function}   callback    Standard callback function
 * @api private
 */
var _checkIfCoursesExist = function(courses, callback) {
    // Get the courses that already exist
    var externalIds = _.pluck(courses, 'externalId');
    OrgUnitDAO.getOrgUnitsByExternalId(argv.app, externalIds, function(err, orgUnits) {
        if (err) {
            log().error({'err': err}, 'Could not get organisational units by their external id');
            process.exit(1);
        }

        // Augment the existing courses with an id
        _.each(orgUnits, function(orgUnit) {
            var course = _.find(courses, {'externalId': orgUnit.externalId});
            course.orgUnitId = orgUnit.id;
        });

        return callback();
    });
};

/**
 * Create the root `course` organisational units for a set of courses. If a course already exists
 * a new record will not be created
 *
 * @param  {Context}    ctx         Standard context object containing the current user and the current application
 * @param  {Object[]}   courses     The courses to create
 * @param  {Function}   callback    Standard callback function
 * @api private
 */
var _createCourses = function(ctx, courses, callback) {
    if (_.isEmpty(courses)) {
        return callback();
    }

    var course = courses.pop();

    // If the course has an orgUnitId, it means the course was created in a previous run
    if (course.orgUnitId) {
        return _createCourses(ctx, courses, callback);
    }

    // Create the course
    log().info({'course': course.displayName}, 'Creating course');
    OrgUnitAPI.createOrgUnit(ctx, argv.app, course.displayName.substring(0, 255), 'course', null, {}, false, null, null, function(err, orgUnit) {
        if (err) {
            log().error({'err': err, 'course': course.displayName}, 'Failed to create organisational unit');
            process.exit(1);
        }

        OrgUnitDAO.updateOrgUnit(orgUnit, {'externalId': course.externalId}, function(err) {
            if (err) {
                log().error({'err': err}, 'Failed to persist the external id');
                process.exit(1);
            }

            // Persist the id of the created organisational object on the course. This will allow us
            // to import the rest of the tree under the course
            course.orgUnitId = orgUnit.id;

            // Move on to the next course
            _createCourses(ctx, courses, callback);
        });
    });
};

/**
 * Import a set of courses
 *
 * @param  {Context}    ctx         Standard context object containing the current user and the current application
 * @param  {Object[]}   courses     The courses to import
 * @param  {Function}   callback    Standard callback function
 * @api private
 */
var _importCourses = function(ctx, courses, callback) {
    if (_.isEmpty(courses)) {
        return callback();
    }

    var course = courses.pop();
    log().info({'id': course.orgUnitId}, 'Importing %s', course.displayName);
    OrgUnitImport.importOrgUnit(ctx, course.orgUnitId, course, false, function(err) {
        if (err) {
            log().error({'err': err}, 'Failed to import a course');
            process.exit();
        }

        // Move on to the next course
        _importCourses(ctx, courses, callback);
    });
};
