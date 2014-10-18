grasshopper
===========

Grasshopper Event Engine

# Setup

This documentation assumes you're running OS X with homebrew.


##  Postgres
```
# Install postgres
brew install postgresql

# Start postgres
postgres -D /usr/local/var/postgres

# Create a database and user
psql template1
    template1=# CREATE USER grasshopper WITH PASSWORD 'grasshopper';
        CREATE ROLE
    template1=# CREATE DATABASE grasshopper;
        CREATE DATABASE
    template1=# GRANT ALL PRIVILEGES ON DATABASE grasshopper TO grasshopper
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
