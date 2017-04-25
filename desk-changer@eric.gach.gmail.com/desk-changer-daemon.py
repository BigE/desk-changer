#!/usr/bin/env python

import os
import os.path
import sys
from deskchanger.application import Daemon

if __name__ == '__main__':
    __daemon_path__ = os.path.abspath(os.path.dirname(__file__))
    os.environ['GSETTINGS_SCHEMA_DIR'] = os.path.join(__daemon_path__, 'schemas')
    daemon = Daemon()
    daemon.run(sys.argv)
