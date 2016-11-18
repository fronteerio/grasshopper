var csv = require('csv');
var fs = require('fs');

if (!process.argv[2]) {
    console.error('Missing path to CSV file');
    process.exit(1);
}

var parser = csv.parse({'trim': true}, function(err, userRows) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    // Remove the headers
    userRows.splice(0, 1)

    var properUsers = userRows
        // Filter out any non-relevant rows
        // A user row looks like:
        //  - full object name
        //  - displayName
        //  - email
        //  - uid
        .filter(function(user) {
            var name = user[1];
            return (name.indexOf('Course Identifier') === -1 &&
                    name.indexOf('Temporary Identifier') === -1 &&
                    name.indexOf('Identifier Course') === -1 &&
                    name.indexOf('Course-King') === -1 &&
                    name.indexOf('Identifier - Classics Visitor') === -1 &&
                    name.indexOf('Short Course ID Education') === -1 &&
                    name.indexOf('ECDL course identifier') === -1 &&
                    name.indexOf('Identifier - Education Visitor') === -1 &&
                    name.indexOf('PWF. Identifier') === -1 &&
                    name.indexOf('Identifier - Physics Visitor') === -1 &&
                    user[1] && user[2] && user[3])
        })

        // Return just the displayName, email & uid
        .map(function(user) {
            return [user[1], user[2], user[3] + '@cam.ac.uk'];
        });

    csv.stringify(properUsers, function(err, output) {
        if (err) {
            console.error(err);
            process.exit(1);
        }

        fs.writeFileSync('clean_users.csv', output);
        console.log('Generated clean_users.csv with %d users in it', properUsers.length);
        process.exit(0);
    });


});

fs.createReadStream(process.argv[2]).pipe(parser);
