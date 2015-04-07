grasshopper
===========

# Build status
[![Build Status](https://travis-ci.org/fronteerio/grasshopper.png?branch=master)](https://travis-ci.org/fronteerio/grasshopper)
[![Coverage Status](https://coveralls.io/repos/fronteerio/grasshopper/badge.png)](https://coveralls.io/r/fronteerio/grasshopper)

Grasshopper Event Engine

# Setup

This documentation assumes you're running OS X with homebrew.


## Install and Start Postgres
```
# Install postgres
brew install postgresql

# Start postgres
postgres -D /usr/local/var/postgres
```

## Initialize the Grasshopper databases

Run: `etc/postgres/init.sh`

Or you can do it manually:

```
# Create a database and user
psql template1
    template1=# CREATE USER grasshopper WITH PASSWORD 'grasshopper';
        CREATE ROLE
    template1=# CREATE DATABASE grasshopper;
        CREATE DATABASE
    template1=# CREATE DATABASE grasshoppertest;
        CREATE DATABASE
    template1=# GRANT ALL PRIVILEGES ON DATABASE grasshopper TO grasshopper;
        GRANT
    template1=# GRANT ALL PRIVILEGES ON DATABASE grasshoppertest TO grasshopper;
        GRANT
psql grasshopper
    grasshopper=# CREATE EXTENSION pg_trgm;
        CREATE EXTENSION
psql grasshoppertest
    grasshoppertest=# CREATE EXTENSION pg_trgm;
        CREATE EXTENSION
```

## Grasshopper
```
# Clone the application somewhere
git clone git://github.com/fronteerio/grasshopper

# Install the npm dependencies
npm install

# Install the grunt CLI (globally)
npm install -g grunt-cli

# Run the application
node app
```
