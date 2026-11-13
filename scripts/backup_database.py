"""Create a consistent SQLite snapshot; never overwrite an existing destination.

Usage: python scripts/backup_database.py SOURCE.sqlite NEW_BACKUP.sqlite
The source opens read-only. SQLite's backup API includes committed WAL data.
"""
import argparse
from pathlib import Path
import sqlite3

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path)
parser.add_argument('destination',type=Path)
args=parser.parse_args()
source=args.source.resolve(strict=True)
destination=args.destination.resolve()
if source==destination:
    parser.error('Source and destination must differ.')
destination.parent.mkdir(parents=True,exist_ok=True)
# Reserve the destination exclusively so an existing backup is never replaced.
with destination.open('xb'):
    pass
with sqlite3.connect(source.as_uri()+'?mode=ro',uri=True) as original:
    with sqlite3.connect(destination) as snapshot:
        original.backup(snapshot)
        if snapshot.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
            raise RuntimeError('Snapshot integrity check failed; preserve source and inspect backup.')
        if snapshot.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Snapshot has foreign-key inconsistencies; inspect before restore.')
print('Snapshot created and integrity checked:',destination)
