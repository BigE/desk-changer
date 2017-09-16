import gettext
import os.path

gettext.bindtextdomain('desk-changer-daemon', os.path.join(os.path.dirname(__file__), '..', 'locale'))
gettext.textdomain('desk-changer-daemon')
_ = gettext.gettext
__version__ = '2.4.1'
