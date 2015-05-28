"""
Copy this file to:
    app/django/timetables/management/commands/grasshopper_export_structure.py

Change directory so your current working directory is:
    app/django

Execute:
    python manage.py grasshopper_export_structure > external-tree.json


Export the triposes, parts and subjects to a tree. The tree follows the same structure as GrassHopper's
import tree. i.e.,

- Course
  - Subject (optional)
    - Part

The parts will also contain the external_url data object
"""
import csv
import sys
import argparse
import json

import pytz

from collections import defaultdict

from timetables.models import Thing, Subjects
from timetables.utils import manage_commands


class Command(manage_commands.ArgparseBaseCommand):

    def __init__(self):
        super(Command, self).__init__()

        self.parser = argparse.ArgumentParser(
            prog="grasshopper_export_structure",
            description=__doc__,
            formatter_class=argparse.ArgumentDefaultsHelpFormatter
        )

    def handle(self, args):
        # Get the tree
        tree = self.get_tree()

        # Print the tree
        print json.dumps(tree, indent=4)

    def get_tree(self):

        root = {
            'id': 0,
            'name': 'Timetable',
            'type': 'root',
            'nodes': {}
        }

        for item in Subjects.all_subjects():
            tripos = item.get_tripos()
            part = item.get_part()
            subject = item.get_most_significant_thing()


            partData = None
            if part.data:
                partData = json.loads(part.data)
                if partData['external_website_url']:
                    partData['external'] = partData['external_website_url']
                    del partData['external_website_url']


            # Add the tripos/course into the tree
            if tripos.id not in root['nodes']:
                root['nodes'][tripos.id] = {
                    'id': tripos.id,
                    'name': tripos.fullname,
                    'type': 'course',
                    'nodes': {}
                }

            # If we're dealing with a subject, add it in
            if subject.id != part.id:
                if subject.id not in root['nodes'][tripos.id]['nodes']:
                    root['nodes'][tripos.id]['nodes'][subject.id] = {
                        'id': subject.id,
                        'name': subject.fullname,
                        'type': 'subject',
                        'nodes': {}
                    }

                root['nodes'][tripos.id]['nodes'][subject.id]['nodes'][part.id] = {
                    'id': part.id,
                    'name': part.fullname,
                    'data': partData,
                    'type': 'part',
                    'nodes': {}
                }
            else:
                root['nodes'][tripos.id]['nodes'][part.id] = {
                    'id': part.id,
                    'name': part.fullname,
                    'data': partData,
                    'type': 'part',
                    'nodes': {}
                }

        return root
