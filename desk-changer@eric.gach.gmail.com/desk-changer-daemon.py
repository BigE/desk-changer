#!/usr/bin/env python

import os
import os.path
import sys
from deskchanger.application import Daemon

__daemon_path__ = os.path.abspath(os.curdir)

if __name__ == '__main__':
    os.environ['GSETTINGS_SCHEMA_DIR'] = os.path.join(__daemon_path__, 'schemas')
    daemon = Daemon()
    daemon.run(sys.argv)
