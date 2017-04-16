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

var _ = require('lodash');
var fs = require('fs');
var yargs = require('yargs');

var DB = require('gh-core/lib/db');
var GrassHopper = require('gh-core/lib/api');
var log = require('gh-core/lib/logger').logger('scripts/orgunit-import');

var config = require('../../../config');

/*
 * This script allows you to import a tree of courses, subjects,
 * parts and modules. The tree should be formatted in the following
 * manner:
 *
 * ```json
 * {
    "name": "Timetable",
    "type": "root",
    "nodes": {
        "5": {
            "id": "5",
            "name": "Natural Sciences Tripos",
            "type": "course",
            "nodes": {
                "117": {
                    "id": "117",
                    "name": "Biology of Cells",
                    "type": "subject",
                    "nodes": {
                        "106-31": {
                            "id": "106-31",
                            "name": "Part IA",
                            "type": "part",
                            "nodes": {
                                "487": {
                                    "id": "487",
                                    "name": "Practicals",
                                    "type": "module"
                                },
                                "488": {
                                    "id": "488",
                                    "name": "Lectures",
                                    "type": "module"
                                }
                            }
                        }
                    }
                },
                "118": {
    ...

 * ```
 *
 * This currently works by spinning up an application container, but
 * will eventually be migrated to use the REST apis
 */

var argv = yargs
    .usage('Import an organizational unit tree.\nUsage: $0')
    .example('$0 --file tree.json --app 19', 'Import the structure in tree.json for application 19')
    .demand('f')
    .alias('f', 'file')
    .describe('f', 'The JSON file that contains the tree')
    .demand('a')
    .alias('a', 'app')
    .describe('a', 'The id of the application for which the tree should be imported')

    .argv;

// Initialize the app server
GrassHopper.init(config, function(err) {
    if (err) {
        log().error({'err': err}, 'Failed to spin up application container');
        process.exit(1);
    }

    log().debug({'file': argv.file}, 'Reading file');
    fs.readFile(argv.file, function(err, tree) {
        if (err) {
            log().error({'err': err, 'file': argv.file}, 'Failed to read file');
            process.exit(1);
        }

        // Parse the tree
        log().debug('Parsing tree');
        tree = JSON.parse(tree);

        // Persist it
        log().info('Starting to persist the organizational tree');
        var courses = _.values(tree.nodes);
        createNodes(courses, null, function() {

            // All done, simply exit
            log().info('The organizational tree has been succesfully imported');
            process.exit(0);
        });
    });
});

/**
 * Recursively create the organizational units for a set of nodes.
 *
 * @param  {Node[]}     nodes           A set of nodes to create
 * @param  {String}     [parentId]      The id of the parent under which the nodes should be created
 * @param  {Function}   callback        Standard callback function
 */
var createNodes = function(nodes, parentId, callback) {
    if (_.isEmpty(nodes)) {
        return callback();
    }

    // Create the node
    var node = nodes.pop();
    createNode(node, parentId, function(orgunit) {
        // Create the child nodes, if any
        var childNodes = _.values(node.nodes);
        createNodes(childNodes, orgunit.id, function() {

            // All child nodes have been created, proceed
            // to the next sibling node, if any
            return createNodes(nodes, parentId, callback);
        });
    });
};

/**
 * Create an organizational unit
 *
 * @param  {Node}       node            The node to create
 * @param  {String}     [parentId]      The id of the parent under which the node should be created
 * @param  {Function}   callback        Standard callback function
 */
var createNode = function(node, parentId, callback) {
    var opts = {
        'displayName': node.name,
        'type': node.type,
        'sourceId': node.id,
        'AppId': argv.app
    };
    if (parentId) {
        opts.parentId = parentId;
    }
    DB.OrgUnit.create(opts).complete(function(err, orgunit) {
        if (err) {
            log().error({'err': err, 'opts': opts}, 'Failed to create orgunit');
            process.exit(1);
        }

        return callback(orgunit);
    });
};
