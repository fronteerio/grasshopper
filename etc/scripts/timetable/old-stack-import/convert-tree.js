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
 * This script will convert a regular tree into a structure that can be imported into Grasshopper
 */

// Always work in UTC
process.env.TZ = 'UTC';

var _ = require('lodash');
var fs = require('fs');
var util = require('util');
var yargs = require('yargs');

var argv = yargs
    .usage('Convert a generated tree into a an organisational unit tree that can be imported.\nUsage: $0')
    .example('$0 --input complete.json --output courses.json', 'Convert complete.json into courses.json')

    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path where the complete tree can be read')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the structure that can be imported should be persisted')
    .argv;

fs.readFile(argv.input, function(err, tree) {
    if (err) {
        console.log('Could not read the input file');
        process.exit(1);
    }

    // The tree is stored as stringified JSON
    tree = JSON.parse(tree);

    // Convert the nodes into proper courses
    var courses = _.map(tree.nodes, function(course, courseId) {
        return _convertOrgUnit(course);
    });

    fs.writeFile(argv.output, JSON.stringify(courses, null, 4), function(err) {
        if (err) {
            console.log('Could not save courses');
            process.exit(1);
        }
    });
});

/**
 * Map an organisational unit tree node structure into an importable organisational unit structure
 *
 * @param  {Object}     node        The node to convert to an organisational unit
 * @return {Object}                 An importable organisational unit structure
 * @api private
 */
var _convertOrgUnit = function(node) {
    var orgUnit = {
        'type': node.type,
        'displayName': node.name,
        'externalId': util.format('%s-%s', node.type, node.id),
        'metadata': node.data,
        'published': false,
        'children': [],
        'series': []
    };

    _.each(node.nodes, function(childNode, childNodeId) {
        // A child node could be a subject, part or series
        if (childNode.type === 'series') {
            orgUnit.series.push(_convertSeries(childNode));
        } else {
            orgUnit.children.push(_convertOrgUnit(childNode));
        }
    });

    return orgUnit;
};

/**
 * Map a series tree node structure into an importable series structure
 *
 * @param  {Object}     node        The node to convert to a series
 * @return {Object}                 An importable series structure
 * @api private
 */
var _convertSeries = function(node) {
    return {
        'displayName': node.name,
        'externalId': util.format('series-%s', node.id),
        'events': _.map(node.nodes, function(eventNode, eventNodeId) {
            return {
                'displayName': eventNode.name,
                'type': eventNode['event-type'],
                'externalId': util.format('event-%s', eventNode.id),
                'start': eventNode.start,
                'end': eventNode.end,
                'location': eventNode.location,
                'organisers': _.map(eventNode.people, function(person) {
                    var organiser = {};
                    if (_.isObject(person)) {
                        organiser.displayName = person.displayName;
                        organiser.shibbolethId = person.shibbolethId;
                    } else {
                        organiser.displayName = person;
                    }
                    return organiser;
                })
            };
        })
    };
};
