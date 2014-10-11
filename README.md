grasshopper
===========

Grasshopper Event Engine

# Setup

1. Install postgres
```
brew install postgresql
```

2. Create a database and user in postgres

```
psql template1
template1=# CREATE USER grasshopper WITH PASSWORD 'grasshopper';
CREATE ROLE
template1=# CREATE DATABASE grasshopper;
CREATE DATABASE
template1=# GRANT ALL PRIVILEGES ON DATABASE grasshopper TO grasshopper
```

3. Install the dependencies
```
npm install
```

4. Run the app server
```
node app
```

