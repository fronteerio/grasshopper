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

var Pattern = require('./pattern').Pattern;

/**
 * The full pattern model. Given a set of dates, this model is able
 * to generate a full "timetable serie pattern".
 */
var FullPattern = module.exports.FullPattern = function() {
    var that = {
        'patterns': []
    };

    /**
     * Add an event that should be included in the pattern
     *
     * @param  {Event}      event       The event to include in the pattern
     */
    that.add = function(event) {
        var pattern = new Pattern(event.start, event.end);
        that.patterns.push(pattern);
    };

    /**
     * Try and merge a pattern into a set of other patterns. If the pattern
     * could not be merged it will be appended to the set
     *
     * @param  {Pattern[]}      newPatterns     The set of patterns to try and merge in a new pattern
     * @param  {Pattern}        pattern         The pattern to try and merge into the set of patterns
     * @return {Boolean}                        `true` if the pattern was merged into the set, `false` if it was appended
     */
    that.merge = function(newPatterns, pattern) {
        for (var i = 0; i < newPatterns.length; i++) {
            if (newPatterns[i].merge(pattern)) {
                return true;
            }
        }

        newPatterns.push(pattern);
        return false;
    };

    /**
     * Try and merge all the patterns. Note that this will only do
     * one round of merging. It is possible that further merging is
     * possible. For example,
     *    - assume a set of patterns [A1, B1, B2]
     *    - B1 and B2 can merge together and form A2
     * When this function returns, the new set of patterns will be [A1, A2]
     *
     * @return {Boolean}        `true` if two or more patterns were merged
     */
    that.mergeAll = function() {
        // Will hold the new set of patterns
        var newPatterns = [];

        // Will keep track of whether two patterns were merged
        var hasMerged = false;

        // Iterate over each pattern and try and merge it with previous patterns
        for (var i = 0; i < that.patterns.length; i++) {
            // Try to merge the pattern with earlier seen patterns
            var res = that.merge(newPatterns, that.patterns[i]);
            hasMerged = hasMerged || res;
        }

        // Remember the new set of patterns
        that.patterns = newPatterns;

        // Return whether we were able to merge two or more patterns
        return hasMerged;
    };

    /**
     * Get the stringified pattern for all the events
     *
     * @return {String}     The stringified pattern for all the events
     */
    that.toString = function() {
        // As long as at least two patterns merged together, we keep trying
        // to merge the new set of patterns. Once no more merges take place
        // there's no further benefit at trying and the while loop can stop
        var hasMerged = true;
        while (hasMerged) {
            hasMerged = that.mergeAll();
        }

        // Sort the patterns on their first term week
        that.patterns = that.patterns.sort(function(patternA, patternB) {
            // Sort on the term first
            if (patternA.termWeeks[0].term.startDate.isBefore(patternB.termWeeks[0].term.startDate)) {
                return -1;
            } else if (patternA.termWeeks[0].term.startDate.isAfter(patternB.termWeeks[0].term.startDate)) {
                return 1;
            }

            // If the terms are the same, we have to sort on the week in the term
            return patternA.termWeeks[0].week - patternB.termWeeks[0].week;
        });

        // Stringify each pattern
        var s = _.map(that.patterns, function(pattern) {
            return pattern.toString();
        });

        // Concatenate the stringified patterns with a semi-colon
        return s.join('; ');
    };

    return that;
};
