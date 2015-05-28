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

module.exports = function(grunt) {
    var _ = require('lodash');
    var path = require('path');
    var shell = require('shelljs');
    var util = require('util');
    var mocha_grep = process.env['MOCHA_GREP'] || undefined;

    // Timeout used to determine when a test has failed
    var MOCHA_TIMEOUT = 60000;

    var regexErrors = false;

    // Project configuration
    grunt.initConfig({
        'pkg': grunt.file.readJSON('package.json'),
        'jscs': {
            'files': [
                'app.js',
                'Gruntfile.js',
                'etc/scripts/**/*.js',
                'node_modules/gh-*/lib/**/*.js',
                'node_modules/gh-*/tests/**/*.js'
            ],
            'options': {
                'config': '.jscsrc'
            }
        },
        'jslint': {
            'files': [
                'Gruntfile.js',
                'node_modules/gh-*/lib/**/*.js',
                'node_modules/gh-*/tests/**/*.js'
            ]
        },
        'jshint': {
            'options': {
                'node': true,
                'sub': true,
                'indent': 4,
                'trailing': true,
                'quotmark': 'single',
                'curly': true,
                'white': false,
                'strict': false,
                'globals': {
                    'it': true,
                    'describe': true,
                    'before': true,
                    'beforeEach': true,
                    'after': true,
                    'afterEach': true
                }
            },
            'files': '<%= jslint.files %>'
        },
        'mocha-hack': {
            'all': {
                'src': ['node_modules/gh-tests/runner/beforeTests.js', 'node_modules/gh-*/tests/**/*.js'],
                'options': {
                    'timeout': MOCHA_TIMEOUT,
                    'ignoreLeaks': false,
                    'fullStackTrace': true,
                    'reporter': 'spec',
                    'grep': mocha_grep,
                    'bail': false,
                    'slow': 500,
                    'globals': ['tests']
                }
            }
        },
        'clean': ['target/'],
        'replace': {
            'check-style': {
                'src': ['node_modules/gh-*/**/*.js', '!node_modules/gh-*/node_modules/**/*.js'],
                'overwrite': true,
                'replacements': [
                    {
                        'from': /@param (\S|\s\s)/,
                        'to': function(matchedWord, index, fullText, regexMatches) {
                            var msg = '@param should be followed by 2 spaces';
                            return logMatch(msg, matchedWord, index, fullText, regexMatches);
                        }
                    },
                    {
                        'from': /@return \s/,
                        'to': function(matchedWord, index, fullText, regexMatches) {
                            var msg = '@return should be followed by 1 space';
                            return logMatch(msg, matchedWord, index, fullText, regexMatches);
                        }
                    },
                    {
                        'from': /@returns/,
                        'to': function(matchedWord, index, fullText, regexMatches) {
                            var msg = 'Use @return instead of @returns';
                            return logMatch(msg, matchedWord, index, fullText, regexMatches);
                        }
                    },
                    {
                        'from': /@throws \s/,
                        'to': function(matchedWord, index, fullText, regexMatches) {
                            var msg = '@throws should be followed by 1 space';
                            return logMatch(msg, matchedWord, index, fullText, regexMatches);
                        }
                    }
                ]
            }
        }
    });

    // Utility function for logging regex matches
    var logMatch = function(msg, matchedWord, index, fullText, regexMatches) {
        var lineNum = fullText.substring(0, index).match(/\n/g).length + 1;
        var line = fullText.split('\n')[lineNum - 1];
        grunt.log.writeln(msg.red + ': ' + lineNum + ': ' + line);
        regexErrors = true;
        return matchedWord;
    };

    // Task to run the regex task and fail if it matches anything
    grunt.registerTask('check-style', ['replace', 'jscs', 'jshint', 'checkRegexErrors']);
    grunt.registerTask('checkRegexErrors', function() {
        grunt.task.requires('replace');
        if (regexErrors) {
            grunt.warn('Style rule validation failed');
        }
    });

    // Override default test task to use mocha-hack
    grunt.registerTask('test', ['mocha-hack']);

    // Make a task for running tests on a single module
    grunt.registerTask('test-module', 'Test a single module', function(module) {
        var config = {
            'src': ['node_modules/gh-tests/runner/beforeTests.js', 'node_modules/' + module + '/tests/**/*.js'],
            'options': {
                'timeout': MOCHA_TIMEOUT,
                'ignoreLeaks': true,
                'reporter': 'spec',
                'grep': mocha_grep
            }
        };
        grunt.config.set('mocha-hack.' + module, config);
        grunt.task.run('mocha-hack:' + module);
    });

    // Runs the unit tests and dumps some coverage data
    grunt.registerTask('test-instrumented', function(report) {
        // If no report format was provided, we default to `lcov` which generates lcov and html
        report = report || 'lcov';

        // Get the modules that should be excluded
        var excludeDirectories = grunt.file.expand({'filter': 'isDirectory'}, 'node_modules/*', '!node_modules/gh-*', 'node_modules/gh-*/node_modules');
        var excludeDirectoriesParameters = _.map(excludeDirectories, function(module) {
            return util.format('-x %s/\\*\\*', module);
        });

        // Exclude the tests from the coverage reports
        var ghModules = grunt.file.expand({'filter': 'isDirectory'}, 'node_modules/gh-*');
        var testDirectories = _.map(ghModules, function(directory) {
            return util.format('-x %s/tests/\\*\\*', directory);
        });
        var testUtilDirectories = _.map(ghModules, function(directory) {
            return util.format('-x %s/lib/test/\\*\\*', directory);
        });

        // Exclude the config directories
        var configDirectories = _.map(ghModules, function(module) {
            return util.format('-x %s/config/\\*\\*', module);
        });

        // Build up one big set of exlusion filters
        var excludeFilters = _.union(excludeDirectoriesParameters, testDirectories, testUtilDirectories, configDirectories);
        excludeFilters.push('-x Gruntfile.js');

        var cmd = util.format('node_modules/.bin/istanbul cover --verbose --dir target --no-default-excludes %s --report %s ./node_modules/grunt-cli/bin/grunt', excludeFilters.join(' '), report);
        var code = shell.exec(cmd).code;
        if (code !== 0) {
            process.exit(code);
        }
    });

    // Sends a coverage report to coveralls.io
    grunt.registerTask('coveralls', function() {
        // This assumes we're executing within the context of Travis CI
        // If not, you'll have to add a .converalls.yml file with `repo_token: ...` in it
        shell.exec('cat ./target/lcov.info | ./node_modules/coveralls/bin/coveralls.js');
    });

    // Run test coverage and open the report
    grunt.registerTask('test-coverage', ['clean', 'test-instrumented', 'showFile:target/lcov-report/index.html']);

    // Run test coverage
    grunt.registerTask('test-coverage-coveralls', ['clean', 'test-instrumented:lcovonly', 'coveralls']);

    // Make a task to open the browser
    grunt.registerTask('showFile', 'Open a file with the OS default viewer', function(file) {
        var browser = shell.env['BROWSER'];
        if (!browser) {
            if (process.platform === 'linux') {
                browser = 'xdg-open';
            } else if (process.platform === 'darwin') {
                browser = 'open';
            } else if (process.platform === 'win32') {
                browser = 'explorer.exe';
            }
        }
        if (browser) {
            shell.exec(browser + ' '  + (file || 'target/coverage.html'));
        }
    });

    // Bring in tasks from npm
    // Temporary work around till https://github.com/yaymukund/grunt-simple-mocha/issues/16 lands.
    grunt.loadNpmTasks('grunt-mocha-hack');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-jscs');
    grunt.loadNpmTasks('grunt-text-replace');

    // Default task.
    grunt.registerTask('default', ['check-style', 'test']);
};
