Data import from the Django Timetables application
==================================================

The scripts in this folder allow you to generate the necessary data files to import data from the
Django application.


## 1. Generate a CSV file that contains all the data in the Django database.

Follow the instructions in the `django-export-events-command.py` file


## 2. Generate a JSON tree of the events CSV data

This can be done by executing:
```
node etc/scripts/timetable/old-stack-import/generate-tree --input path/to/csv --output events-tree.json
```
This script will also take care of date rollovers. Events that take place on Tuesday in week 3 of Lent
should take place on Tuesday in week 3 of Lent in the next academical year.

If you don't want certain modules, parts or subjects, you can easily remove them from the tree at this point


## 3. Augment the events with the Shibboleth identifiers of the organisers

If you've already imported a set of users into your system, you can link the imported events to
these users.

This can be done by executing
```
node etc/scripts/timetable/old-stack-import/augment-tree-with-user-shibboleth-ids.js --input events-tree.json --output tree-with-shib-ids.json --users users.csv
```

Depending on the amount of events and users this can take a few hours. The output tree will be
periodically flushed to disk and can be resumed at a later stage.


## 4. Generate a JSON tree for the parts with external data

Follow the instructions in the `django-export-external-command.py` file


## 5. Augment the tree with the parts who have an external URL

This can be done by executing:
```
node etc/scripts/timetable/old-stack-import/add-external-parts.js --events-tree tree-with-shib-ids.json --external-tree grasshopper_external_structure.json --output complete.json
```

## 6. Convert the tree to a structure that can be imported in grasshopper

This can be done by executing
```
node etc/scripts/timetable/old-stack-import/convert-tree.js --input complete.json --output courses.json
```


## 7. Import

This can be done by executing:
```
node etc/scripts/timetable/import.js --input courses.json --app 1
```

Depending on the data set and the server setup, this can easily take 30 minutes, so be patient.
