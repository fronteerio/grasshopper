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
var csv = require('csv');
var fs = require('fs');
var jarowinkler = require('jaro-winkler');
var yargs = require('yargs');

var argv = yargs
    .usage('Augment the event organisers with their shibboleth ids.\nUsage: $0')
    .example('$0 --input tree.json --output tree-with-shibboleth-ids.json --users users.csv')

    .demand('i')
    .alias('i', 'input')
    .describe('i', 'The path where the JSON tree can be read')

    .demand('o')
    .alias('o', 'output')
    .describe('o', 'The path where the augmented JSON tree should be written to')

    .demand('u')
    .alias('u', 'users')
    .describe('u', 'The CSV file containing all the users. The expected columns are: dn, uid, cn, displayName, mail')
    .argv;

// Keep a cache of matched names to user records
var matched = {};

// The number of events that have been visited by the script
var visitedEvents = 0;

/**
 * Visit a node in the tree. If the node is an event, the organisers will be looked up in the set
 * of users. In case there's a match, the organiser will be replaced by an object referring to the
 * user. In case the node is not an event, its children will be visited.
 *
 * As this could potentially take a very long time, the entire tree will be flushed to disk every while
 *
 * @param  {Object}         node        The node to visit
 * @param  {Object[]}       users       The set of users to match the organisers with
 * @param  {Object}         tree        The full tree who will be modified in-place
 * @api private
 */
var visitNode = function(node, users, tree) {
    if (node.type === 'event') {
        if (!node.peopleSeen) {
            _.each(node.people, function(organiser, index) {
                var match = findMatch(organiser, users);
                if (match) {
                    node.people[index] = {
                        'shibbolethId': match.uid + '@cam.ac.uk',
                        'displayName': match.displayName,
                        'original': organiser
                    };
                }
            });
            node.peopleSeen = true;
        }
        visitedEvents++;
        if (visitedEvents % 25 === 0) {
            console.log('Handled %d events', visitedEvents);

            // Periodically write the tree to disk
            writeTree(tree);
        }
    } else {
        _.each(node.nodes, function(child) {
            visitNode(child, users, tree);
        });
    }
};

/**
 * Write the tree to disk
 *
 * @param  {Object}     tree    The tree that should be flushed to disk
 * @api private
 */
var writeTree = function(tree) {
    fs.writeFileSync(argv.output, JSON.stringify(tree, null, 4));
};

/**
 * Given a name, find the best matching user
 *
 * @param  {String}     name    The name to find a user for
 * @param  {Object}     users   The set of users
 * @return {Object}             The best matching user, or null if no user could be matched
 * @api private
 */
var findMatch = function(name, users) {
    var bestMatch = [];
    var max = Math.MAX_VALUE;

    // If we've already found a match for this name, we can avoid
    if (matched[name]) {
        return matched[name];
    }

    // Strip out titles and whitespace
    var preppedName = prep(name);

    // Compare the name to each user and retain the best match
    _.each(users, function(record) {
        var displayName = prep(record.displayName);
        var cn = prep(record.cn);
        var d = 0;

        if (displayName) {
            d = distance(preppedName, displayName);

            // If the distance is lower than the last best match we have a new best match
            if (d < max) {
                max = d;
                bestMatch = [record];

            // If it's the same we will have multiple matches to choose from
            } else if (d === max) {
                bestMatch.push(record);
            }
        }

        if (cn) {
            d = distance(preppedName, cn);

            // If the distance is lower than the last best match we have a new best match
            if (d < max) {
                max = d;
                bestMatch = [record];

            // If it's the same we will have multiple matches to choose from
            } else if (d == max) {
                bestMatch.push(record);
            }
        }
    });

    // We only return a user record if we have a single "best match". If there is more than one
    // "best match" we will return null as there's no way to determine algorithmically which one
    // is the "best" of the "best matches"
    if (bestMatch.length === 1) {
        // Cache the result for this name so subsequent calls can return the user record immediately
        matched[name] = bestMatch[0];
        return matched[name];
    }

    return null;
};

/**
 * Read the input tree
 *
 * @param  {Function}   callback        Invoked when the tree has been read
 * @param  {Object}     callback.tree   The input tree
 * @api private
 */
var getTree = function(callback) {
    console.log('Reading tree');
    fs.readFile(argv.input, function(err, tree) {
        if (err) {
            console.log('Failed to read input tree');
            console.log(err);
            process.exit(1);
        }

        // Parse the tree
        console.log('Parsing tree');
        tree = JSON.parse(tree);
        console.log('Parsed tree');
        return callback(tree);
    });
};

/**
 * Get the users from the CSV file
 *
 * @param  {Function}   callback        Invoked when the users habe been read
 * @param  {Object}     callback.tree   The users
 * @api private
 */
var getUsersFromCSV = function(callback) {
    console.log('Parsing CSV file');
    var parser = csv.parse({'columns': ['dn', 'uid', 'cn', 'displayName', 'mail']}, function(err, records) {
        if (err) {
            console.log('Failed to parse CSV file');
            console.log(err);
            process.exit(1);
        }

        // Shift off the headers
        records.shift();
        console.log('Parsed CSV file');

        return callback(records);
    });

    fs.createReadStream(argv.users).pipe(parser);
};

/**
 * Prepare a string so it can be better compared to another. This will remove titles such as
 * `Dr`, `Prof`, ... and trim off whitespace
 *
 * @param  {String}     s   The string to prepare
 * @return {String}         The prepared string
 * @api private
 */
var prep = function(s) {
    return s.replace(/(Dr\.)|(Prof\.?)|(Professor)/, '').trim();
};

/**
 * Calculate the distance between two strings. The smaller the number, the better the match
 *
 * @param  {String}     s1      The string to match against `s2`
 * @param  {String}     s2      The string to match against `s1`
 * @return {Number}             Expresses the difference between the two strings. A low number means a higher similarity
 * @api private
 */
var distance = function(s1, s2) {
    return jarowinkler(s1, s2) * -1;
};

// Read the input tree
getTree(function(tree) {

    // Parse the CSV file
    getUsersFromCSV(function(users) {

        // Start processing nodes
        visitNode(tree, users, tree);
    });
});
