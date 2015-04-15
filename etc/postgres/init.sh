#!/bin/sh

# Create the template1 database template
psql --file=etc/postgres/psql/template.psql template1

# Create the extensions in both the grasshopper and grasshopper test database
psql --file=etc/postgres/psql/extensions.psql grasshopper
psql --file=etc/postgres/psql/extensions.psql grasshoppertest
