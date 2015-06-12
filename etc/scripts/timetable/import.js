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
var SeriesDAO = require('gh-series/lib/internal/dao');

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

                        // Take a deep copy of the courses before we import them. The import
                        // operation might make in-place modifications (such as deleting series)
                        // which would trip up the borrowing process later
                        var copyCourses = _.cloneDeep(courses);
                        log().info('Importing the tree under each course');
                        _importCourses(ctx, courses.slice(), function() {

                            // Export each imported course so we have the ids of any created
                            // organisational units or series. This will allow us to borrow the
                            // correct series under other modules later
                            log().info('Exporting the tree under each course');
                            _exportCourses(ctx, copyCourses.slice(), function() {

                                // Take another pass and take care of borrowed series
                                log().info('Borrowing series where appropriate');
                                _handleBorrowing(ctx, copyCourses, function() {

                                    log().info('All courses have been imported');
                                    process.exit(0);
                                });
                            });
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
            return _createCourses(ctx, courses, callback);
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

    log().info({'id': course.orgUnitId}, 'Importing %s, %d remaining', course.displayName, courses.length);
    var options = {
        'deleteMissing': false,
        'checkExternalId': false
    };
    OrgUnitImport.importOrgUnit(ctx, course.orgUnitId, course, options, function(err) {
        if (err) {
            log().error({'err': err}, 'Failed to import a course');
        }

        // Move on to the next course
        return _importCourses(ctx, courses, callback);
    });
};

/**
 * Export a set of courses. This method will add an `exportedCourse` on each course
 * holding the entire tree for that course
 *
 * @param  {Context}    ctx         Standard context object containing the current user and the current application
 * @param  {Object[]}   courses     The courses to export
 * @param  {Function}   callback    Standard callback function
 * @api private
 */
var _exportCourses = function(ctx, courses, callback) {
    if (_.isEmpty(courses)) {
        return callback();
    }

    var course = courses.pop();

    // Export the course so the new ids can be used for the borrowing stage
    log().info({'id': course.orgUnitId}, 'Exporting %s, %d remaining', course.displayName, courses.length);
    OrgUnitAPI.exportOrgUnit(ctx, course.orgUnitId, 'json', function(err, exportedCourse) {
        if (err) {
            log().error({'err': err}, 'Failed to export a course');
            process.exit(1);
        }

        course.exportedCourse = exportedCourse;

        // Move on to the next course
        return _exportCourses(ctx, courses, callback);
    });
};

/**
 * Borrow series under a module where appropriate
 *
 * @param  {Context}    ctx         Standard context object containing the current user and the current application
 * @param  {Object[]}   courses     The courses to check for borrowing
 * @param  {Function}   callback    Standard callback function
 * @api private
 */
var _handleBorrowing = function(ctx, courses, callback) {
    // Get all the organisational units with borrowed series
    var orgunitsWithBorrowedSeries = _.map(function(course) {
        return _getOrgUnitsWithBorrowedSeries(course);
    });
    orgunitsWithBorrowedSeries = _.compact(orgunitsWithBorrowedSeries);

    // If there is not a single organisational unit with a series, we're done
    if (_.isEmpty(orgunitsWithBorrowedSeries)) {
        return callback();
    }

    // Otherwise, we need to process them
    return _handleOrgUnitsWithBorrowedSeries(ctx, courses, orgunitsWithBorrowedSeries, callback);
};

/**
 * Get the organisational units (modules) who contain series that are borrowed from
 * other modules
 *
 * @param  {OrgUnit}        orgUnit                         The organisational unit to check
 * @return {OrgUnit[]}                                      The organisational units that contain borrowed series
 */
var _getOrgUnitsWithBorrowedSeries = function(orgUnit, _orgunitsWithBorrowedSeries) {
    _orgunitsWithBorrowedSeries = _orgunitsWithBorrowedSeries || [];
    if (!_.isEmpty(orgUnit.borrowedSeries)) {
        _orgunitsWithBorrowedSeries.push(orgUnit);
    }

    // Visit any child organisational units
    _.each(orgUnit.children, function(childOrgUnit) {
        _getOrgUnitsWithBorrowedSeries(childOrgUnit, _orgunitsWithBorrowedSeries);
    });
    return _orgunitsWithBorrowedSeries;
};

/**
 * Borrow series for a set of organisational units known to contain borrowed series
 *
 * @param  {Context}    ctx                             Standard context object containing the current user and the current application
 * @param  {Object[]}   courses                         The courses to check for borrowing
 * @param  {OrgUnit[]}  orgunitsWithBorrowedSeries      The organisational units that contain borrowed series
 * @param  {Function}   callback                        Standard callback function
 * @api private
 */
var _handleOrgUnitsWithBorrowedSeries = function(ctx, courses, orgunitsWithBorrowedSeries, callback) {
    if (_.isEmpty(orgunitsWithBorrowedSeries)) {
        return callback();
    }

    // Deal with an organisational unit's borrowed series
    var orgUnitWithBorrowedSeries = orgunitsWithBorrowedSeries.pop();
    _handleOrgUnitWithBorrowedSeries(ctx, courses, orgUnitWithBorrowedSeries, function() {

        // Move on to the next organisational unit with one or more borrowed series
        return _handleOrgUnitsWithBorrowedSeries(ctx, courses, orgunitsWithBorrowedSeries, callback);
    });
};

/**
 * Borrow series for an organisational unit known to contain borrowed series
 *
 * @param  {Context}    ctx                             Standard context object containing the current user and the current application
 * @param  {Object[]}   courses                         The courses to check for borrowing
 * @param  {OrgUnit}    orgUnitWithBorrowedSeries       The organisational unit that contains borrowed series
 * @param  {Function}   callback                        Standard callback function
 * @api private
 */
var _handleOrgUnitWithBorrowedSeries = function(ctx, courses, orgUnitWithBorrowedSeries, callback) {
    // If this organisational unit has no further borrowed series, we're done
    if (_.isEmpty(orgUnitWithBorrowedSeries.borrowedSeries)) {
        return callback();
    }

    var borrowedSeries = orgUnitWithBorrowedSeries.borrowedSeries.pop();

    // We need the *exported* organisational unit under which the series will be borrowed
    // as we need its id to do any database operations
    var parent = false;
    for (var i = 0; i < courses.length && !parent; i++) {
        parent = _findOrgUnit(courses[i].exportedCourse, orgUnitWithBorrowedSeries.metadata.exportedId);
    }

    // Find the *exported* series so we can borrow it under the organisational unit
    var series = false;
    for (i = 0; i < courses.length && !series; i++) {
        series = _findSeries(courses[i].exportedCourse, borrowedSeries.metadata.exportedId);
    }

    // If the parent or series couldn't be found, there is something wrong with the input data
    if (!parent || !series) {
        log().warn({
            'orgUnit': _.omit(orgUnitWithBorrowedSeries, 'series', 'borrowedSeries'),
            'series': _.omit(borrowedSeries, 'events')
        }, 'Could not borrow a series under a module');
        return callback();
    }

    // Get module and series instances
    OrgUnitDAO.getOrgUnit(parent.id, false, function(err, orgUnit) {
        if (err) {
            log().error({'err': err}, 'Could not get the parent module when borrowing a series');
            process.exit(1);
        }

        SeriesDAO.getSerie(series.id, false, function(err, series) {
            if (err) {
                log().error({'err': err}, 'Could not get the series when borrowing a series');
                process.exit(1);
            }

            // Borrow the series under the organisational unit
            OrgUnitDAO.addOrgUnitSeries(orgUnit, series, function(err) {
                if (err) {
                    log().error({
                        'err': err,
                        'parent': parent.id,
                        'series': series.id
                    }, 'Could not borrow the series under the organisational unit');
                    process.exit(1);
                }

                // Move on to the next borrowed series in this organisational unit
                return _handleOrgUnitWithBorrowedSeries(ctx, courses, orgUnitWithBorrowedSeries, callback);
            });
        });
    });
};

/**
 * Find an organisational unit by its exported id. This function will recursively search through
 * the given organisational unit's children until it finds an organisational unit whose `exportedId`
 * matches the given `id`.
 *
 * @param  {OrgUnit}    orgUnit     The tree of organisational units to search through
 * @param  {Number}     id          The old id of the organisational unit to look for
 * @return {OrgUnit}                The matching organisational unit (or false if none could be found)
 * @api private
 */
var _findOrgUnit = function(orgUnit, id) {
    if (_.get(orgUnit, 'metadata.exportedId') === id) {
        return orgUnit;
    }

    var match = false;
    for (var i = 0; i < orgUnit.children.length && !match; i++) {
        match = _findOrgUnit(orgUnit.children[i], id);
    }
    return match;
};

/**
 * Find a series by its exported id. This function will recursively search through
 * the given organisational unit's children until it finds a series whose `exportedId`
 * matches the given `id`.
 *
 * @param  {OrgUnit}    orgUnit     The tree of organisational units to search through
 * @param  {Number}     id          The old id of the series to look for
 * @return {Series}                 The matching series (or false if none could be found)
 * @api private
 */
var _findSeries = function(orgUnit, id) {
    // Try to find the series in the organisational unit
    var series = _.find(orgUnit.series, function(series) {
        return (_.get(series, 'metadata.exportedId') === id);
    });
    if (series) {
        return series;
    }

    // If we couldn't find the series in the organisational unit, we try its children's series
    var match = false;
    for (i = 0; i < orgUnit.children.length && !match; i++) {
        match = _findSeries(orgUnit.children[i], id);
    }
    return match;
};
