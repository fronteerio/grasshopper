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
 * This script will read in courses, subjects, parts, modules, series and events from a CSV file as
 * outputted by the `django-export-csv-command`. It will then build up a basic tree that can be
 * ingested into the system
 */

var _ = require('lodash');
var csv = require('csv');
var fs = require('fs');
var moment = require('moment');
var yargs = require('yargs');

var argv = yargs
    .usage('Convert a timetable-django CSV export into a an organisational unit tree.\nUsage: $0')
    .example('$0 --input events.csv --output tree.json --from 2014 --to 2015', 'Convert events.csv into tree.json')

    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path where the CSV file can be read')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the JSON file should be written to')

    .alias('d', 'debug')
    .describe('d', 'Print the tree to standard out')
    .argv;

// Parse the CSV file
var options = {
    'columns': ['TriposId', 'TriposName', 'PartId', 'PartName', 'SubPartId', 'SubPartName', 'ModuleId', 'ModuleName', 'SerieId', 'SerieName', 'EventId', 'EventTitle', 'EventType', 'EventStartDateTime', 'EventEndDateTime', 'EventLocation', 'EventPeople']
};
var parser = csv.parse(options, function(err, records) {
    // Shift out the headers
    records.shift();

    // Generate the entire tree
    var tree = generateTree(records);

    // Make another pass and merge subjects
    mergeSubjects(tree);

    // Write the tree to disk
    writeTree(tree);

    // Print it to standard out if the debug flag was specified
    if (argv.d) {
        printTree(tree);
    }
});

// Pipe the CSV file to the parser
fs.createReadStream(argv.input).pipe(parser);

/**
 * Given an array of courses, modules, parts, subjects and events,
 * generate an organizational unit tree
 *
 * @param  {Object[]}   records     A set of CSV records. Each record maps to a single event
 * @api private
 */
var generateTree = function(records) {
    var tree = {
        'name': 'Timetable',
        'type': 'root',
        'nodes': {}
    };

    var prevCourse = null;
    var prevSubject = null;
    var prevPart = null;
    var partCounter = 0;

    _.each(records, function(record) {
        tree.nodes[record.TriposId] = tree.nodes[record.TriposId] || {
            'id': record.TriposId,
            'name': record.TriposName,
            'type': 'course',
            'nodes': {}
        };

        var node = tree.nodes[record.TriposId];

        // A subpart maps to a subject, but is not always present
        if (record.SubPartId && record.SubPartName) {
            tree.nodes[record.TriposId].nodes[record.SubPartId] = tree.nodes[record.TriposId].nodes[record.SubPartId] || {
                'id': record.SubPartId,
                'name': record.SubPartName,
                'type': 'subject',
                'nodes': {}
            };
            node = tree.nodes[record.TriposId].nodes[record.SubPartId];
        }

        /*
         * The next bit is somewhat tricky. In the old stack the tree looks like this:
         * Course
         *    Part
         *       Subject
         *          Module
         *
         * We'd like our tree to be formatted like this:
         * Course
         *     Subject
         *        Part
         *           Module
         *
         * This means that we cannot simply use PartId as the identifier of our part
         * or we would be re-using it for all our subjects.
         */
        var part = _.find(_.values(node.nodes), {'name': record.PartName});
        var partId = null;
        if (!part) {
            partCounter++;
            partId = record.PartId + '-' + partCounter;
            node.nodes[partId] = {
                'id': partId,
                'name': record.PartName,
                'type': 'part',
                'nodes': {}
            };
        } else {
            partId = part.id;
        }

        // Module
        node.nodes[partId].nodes[record.ModuleId] = node.nodes[partId].nodes[record.ModuleId] || {
            'id': record.ModuleId,
            'name': record.ModuleName,
            'type': 'module',
            'nodes': {}
        };

        // Series
        node.nodes[partId].nodes[record.ModuleId].nodes[record.SerieId] = node.nodes[partId].nodes[record.ModuleId].nodes[record.SerieId] || {
            'id': record.SerieId,
            'name': record.SerieName,
            'type': 'series',
            'nodes': {}
        };

        // The set of organisers will be concatenated by a `#` character by the django command. However,
        // it seems that there were quite a few people who annotated their own data by using a `/` or
        // simply by using ` and `. We try to catch some of these use-cases
        var people = _.chain(record.EventPeople.split('#'))
            .map(function(person) {
                // Split again on / as lots of administrators seem to use this
                return person.split('/');
            })
            .flatten()

            .map(function(person) {
                // Split again on ' and '
                return person.split(' and ');
            })
            .flatten()

            // Trim off leading and trailing whitespace
            .map(function(person) {
                return person.trim().replace(/,/g, '');
            })
            .compact()
            .value();

        // Event
        node.nodes[partId].nodes[record.ModuleId].nodes[record.SerieId].nodes[record.EventId] = node.nodes[partId].nodes[record.ModuleId].nodes[record.SerieId].nodes[record.EventId] || {
            'id': record.EventId,
            'name': record.EventTitle,
            'type': 'event',
            'event-type': record.EventType,
            'start': record.EventStartDateTime,
            'end': record.EventEndDateTime,
            'location': record.EventLocation,
            'people': people
        };

        prevCourse = record.TriposId;
        prevSubject = record.SubPartId;
        prevPart = partId;
    });

    return tree;
};

/**
 * Merge the subjects with the same name into a single subject node. The modifications
 * will be made in-place
 *
 * @param  {Object}     tree    The tree to merge subjects in
 * @api private
 */
var mergeSubjects = function(tree) {
    _.each(tree.nodes, function(course, courseId) {
        var subjectNodes = _.find(course.nodes, function(subjectOrPart) {
            return (subjectOrPart.type === 'subject');
        });
        var hasSubjects = (subjectNodes !== undefined);

        if (hasSubjects) {

            // Merge the subjects
            var subjectsByName = {};
            _.each(course.nodes, function(subject, subjectId) {
                subjectsByName[subject.name] = subjectsByName[subject.name] || [];
                subjectsByName[subject.name].push(subject);
            });

            course.nodes = {};
            _.each(subjectsByName, function(subjects, subjectName) {
                course.nodes[subjectName] = {
                    'id': subjectName,
                    'type': 'subject',
                    'name': subjectName,
                    'nodes': {}
                };

                _.each(subjects, function(subject) {
                    _.each(subject.nodes, function(node, nodeId) {
                        course.nodes[subjectName].nodes[nodeId] = node;
                    });
                });
            });
        }
    });
};

/*
 * Write the tree to the output file
 *
 * @param  {Object}     tree    The tree to write to disk
 * @api private
 */
var writeTree = function(tree) {
    fs.writeFile(argv.output, JSON.stringify(tree, null, 4), function(err) {
        if (err) {
            console.log('Could not save tree');
            process.exit(1);
        }
    });
};

/*
 * Print the entire tree to standard out
 *
 * @param  {Object}     tree    The tree to print
 * @api private
 */
var printTree = function(tree) {
    printNode(tree, 0);
};

/*
 * Print a node (and all its child nodes) to standard out. This function will
 * print a line per node containing the displayName and type of the node. When the node is a series,
 * the events under it will be aggregated into a Cambridge date pattern will be added
 *
 * @param  {Object}     node    The node to print
 * @param  {Number}     level   The level the node is at
 * @api private
 */
var printNode = function(node, level) {
    // Don't print individual events
    if (node.type === 'event') {
        return;
    }

    // Indent the line
    var spaces = '';
    for (var i = 0; i < level * 3; i++) {
        spaces += ' ';
    }

    var extra = '';
    if (node.type === 'series') {
        // We generate a pattern that allows us to quickly verify whether
        // the converted timestamps are correctly rolled over
        var fp = new FullPattern();
        _.each(node.nodes, function(node, nodeId) {
            fp.add(node);
        });
        extra = ' ' + fp.toString();
    }

    // Print the node to standard out
    console.log('%s%s (%s)%s', spaces, node.name, node.type[0], extra);

    // Process its child nodes, if any
    _.each(node.nodes, function(node, nodeId) {
        printNode(node, level + 1);
    });
};
