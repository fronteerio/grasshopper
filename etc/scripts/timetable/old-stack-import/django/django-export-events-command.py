"""
Copy this file to:
    app/django/timetables/management/commands/grasshopper_export_data.py

Change directory so your current working directory is:
    app/django

Execute:
    python manage.py grasshopper_export_data > data_dump.csv

Depending on your machine, this can take a couple of minutes. You should end up with a CSV file
that contains all the necessary data for each event to build up a tree.


Export all events in the system into CSV format. Events with dodgy
ancestors (invalid data) are skipped.
"""
import csv
import sys
import argparse

import pytz

from timetables.models import Event, NestedSubject
from timetables.utils import manage_commands
from timetables.utils.traversal import (
    EventTraverser,
    SeriesTraverser,
    ModuleTraverser,
    SubpartTraverser,
    PartTraverser,
    TriposTraverser,
    InvalidStructureException
)


class Command(manage_commands.ArgparseBaseCommand):

    def __init__(self):
        super(Command, self).__init__()

        self.parser = argparse.ArgumentParser(
            prog="grasshopper_export_events",
            description=__doc__,
            formatter_class=argparse.ArgumentDefaultsHelpFormatter
        )

    def handle(self, args):
        events = self.get_events()

        exporter = CsvExporter(
            self.get_columns(),
            [UnicodeEncodeRowFilter()],
            events
        )

        exporter.export_to_stream(sys.stdout)

    def get_columns(self):
        return [
            TriposIdColumnSpec(), TriposNameColumnSpec(),
            PartIdColumnSpec(), PartNameColumnSpec(),
            SubPartIdColumnSpec(), SubPartNameColumnSpec(),
            ModuleIdColumnSpec(), ModuleNameColumnSpec(),
            SeriesIdColumnSpec(), SeriesNameColumnSpec(),
            EventIdColumnSpec(), EventTitleColumnSpec(),
            EventTypeColumnSpec(),
            EventStartDateTimeColumnSpec(), EventEndDateTimeColumnSpec()
        ]

    def get_events(self):
        return (
            Event.objects
                .just_active()
                .prefetch_related("source__"  # EventSource (series)
                                  # m2m linking to module
                                  "eventsourcetag_set__"
                                  "thing__" # Module
                                  "parent__" # Subpart or part
                                  "parent__" # part or tripos
                                  "parent")) # tripos or nothing


class CsvExporter(object):
    def __init__(self, columns, filters, events):
        self.columns = columns
        self.filters = filters
        self.events = events

    def export_to_stream(self, dest):
        csv_writer = csv.writer(dest, delimiter=',', quotechar='"', quoting=csv.QUOTE_ALL)
        return self.export_to_csv_writer(csv_writer)

    def export_to_csv_writer(self, csv_writer):
        self.write_row(csv_writer, self.get_header_row())

        for event in self.events:
            try:
                self.write_row(csv_writer, self.get_row(event))
            except InvalidStructureException as e:
                print >> sys.stderr, "Skipping event", event.pk, e

    def get_header_row(self):
        return [spec.get_column_name() for spec in self.columns]

    def get_row(self, event):
        return [spec.extract_value(event) for spec in self.columns]

    def write_row(self, csv_writer, row):
        for f in self.filters:
            row = f.filter(row)

        csv_writer.writerow(row)


class UnicodeEncodeRowFilter(object):
    encoding = "utf-8"

    def encode_unicode(self, val):
        if isinstance(val, basestring):
            val = val.replace("\n", "")

        if isinstance(val, unicode):
            return val.encode(self.encoding)
        return val

    def filter(self, row):
        return [self.encode_unicode(val) for val in row]


class ColumnSpec(object):
    name = None

    def __init__(self, name=None):
        if name is not None:
            self.name = name
        if self.name is None:
            raise ValueError("no name value provided")

    def get_column_name(self):
        return self.name

    def extract_value(self, event):
        raise NotImplementedError()

    def get_series(self, event):
        return EventTraverser(event).step_up().get_value()

    def get_module(self, event):
        series = self.get_series(event)
        return SeriesTraverser(series).step_up().get_value()

    def get_subpart(self, event):
        module = self.get_module(event)
        traverser = ModuleTraverser(module).step_up()

        if traverser.name == SubpartTraverser.name:
            return traverser.get_value()
        return None

    def get_part(self, event):
        subpart = self.get_subpart(event)
        if subpart is not None:
            traverser = SubpartTraverser(subpart)
        else:
            traverser = ModuleTraverser(self.get_module(event))

        part_traverser = traverser.step_up()
        assert part_traverser.name == PartTraverser.name
        return part_traverser.get_value()

    def get_tripos(self, event):
        part = self.get_part(event)
        return PartTraverser(part).step_up().get_value()


class TriposIdColumnSpec(ColumnSpec):
    name = "Tripos Id"

    def extract_value(self, event):
        tripos = self.get_tripos(event)
        return tripos.id


class TriposNameColumnSpec(ColumnSpec):
    name = "Tripos Name"

    def extract_value(self, event):
        tripos = self.get_tripos(event)
        return tripos.fullname


class TriposShortNameColumnSpec(ColumnSpec):
    name = "Tripos Short Name"

    def extract_value(self, event):
        tripos = self.get_tripos(event)
        return tripos.name


class PartIdColumnSpec(ColumnSpec):
    name = "Part Id"

    def extract_value(self, event):
        part = self.get_part(event)
        return part.id

class PartNameColumnSpec(ColumnSpec):
    name = "Part Name"

    def extract_value(self, event):
        part = self.get_part(event)
        return part.fullname


class PartShortNameColumnSpec(ColumnSpec):
    name = "Part Short Name"

    def extract_value(self, event):
        part = self.get_part(event)
        return part.name


class SubPartIdColumnSpec(ColumnSpec):
    name = "Subpart Id"

    def extract_value(self, event):
        subpart = self.get_subpart(event)
        return None if subpart is None else subpart.id

class SubPartNameColumnSpec(ColumnSpec):
    name = "Subpart Name"

    def extract_value(self, event):
        subpart = self.get_subpart(event)
        return None if subpart is None else subpart.fullname


class SubPartShortNameColumnSpec(ColumnSpec):
    name = "Subpart Short Name"

    def extract_value(self, event):
        subpart = self.get_subpart(event)
        return None if subpart is None else subpart.name


class ModuleIdColumnSpec(ColumnSpec):
    name = "Module Id"

    def extract_value(self, event):
        module = self.get_module(event)
        return module.id


class ModuleNameColumnSpec(ColumnSpec):
    name = "Module Name"

    def extract_value(self, event):
        module = self.get_module(event)
        return module.fullname


class ModuleShortNameColumnSpec(ColumnSpec):
    name = "Module Short Name"

    def extract_value(self, event):
        module = self.get_module(event)
        return module.name


class SeriesIdColumnSpec(ColumnSpec):
    name = "Series Name"

    def extract_value(self, event):
        series = self.get_series(event)
        return series.id

class SeriesNameColumnSpec(ColumnSpec):
    name = "Series Name"

    def extract_value(self, event):
        series = self.get_series(event)
        return series.title


class EventAttrColumnSpec(ColumnSpec):
    attr_name = None

    def get_attr_name(self):
        assert self.attr_name is not None
        return self.attr_name

    def extract_value(self, event):
        return getattr(event, self.get_attr_name())


class EventIdColumnSpec(EventAttrColumnSpec):
    name = "Event ID"
    attr_name = "id"

class EventTitleColumnSpec(EventAttrColumnSpec):
    name = "Title"
    attr_name = "title"


class EventLocationColumnSpec(EventAttrColumnSpec):
    name = "Location"
    attr_name = "location"


class EventUidColumnSpec(ColumnSpec):
    name = "UID"

    def extract_value(self, event):
        return event.get_ical_uid()


class EventDateTimeColumnSpec(ColumnSpec):
    timezone = pytz.timezone("Europe/London")

    def get_datetime_utc(self, event):
        raise NotImplementedError()

    def extract_value(self, event):
        dt_utc = self.get_datetime_utc(event)
        return self.timezone.normalize(dt_utc.astimezone(self.timezone)).isoformat()


class EventStartDateTimeColumnSpec(EventDateTimeColumnSpec):
    name = "Start"

    def get_datetime_utc(self, event):
        return event.start


class EventEndDateTimeColumnSpec(EventDateTimeColumnSpec):
    name = "End"

    def get_datetime_utc(self, event):
        return event.end


class EventMetadataColumnSpec(ColumnSpec):
    metadata_path = None

    def get_metadata_path(self):
        if self.metadata_path is None:
            raise ValueError("no metadata_path value provided")
        return self.metadata_path

    def extract_value(self, event):
        metadata = event.metadata

        segments = self.get_metadata_path().split(".")
        for i, segment in enumerate(segments):
            if not isinstance(metadata, dict):
                return None
            if i == len(segments) - 1:
                return metadata.get(segment)
            metadata = metadata.get(segment)


class EventTypeColumnSpec(EventMetadataColumnSpec):
    name = "Type"
    metadata_path = "type"


class EventLecturerColumnSpec(EventMetadataColumnSpec):
    name = "People"
    metadata_path = "people"

    def extract_value(self, event):
        value = super(EventLecturerColumnSpec, self).extract_value(event)
        return None if value is None else ", ".join(value)
