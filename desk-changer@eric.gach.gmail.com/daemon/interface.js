var DBusName = 'org.gnome.Shell.Extensions.DeskChanger.Daemon';
var DBusPath = '/org/gnome/Shell/Extensions/DeskChanger/Daemon';
var DBusInterface = `<node>\
    <interface name="${DBusName}">\
        <method name="LoadProfile">\
            <arg direction="in" name="profile" type="s" />\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <method name="Next">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Prev">\
            <arg direction="out" name="uri" type="s" />\
        </method>\
        <method name="Start">\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <method name="Stop">\
            <arg direction="out" name="success" type="b" />\
        </method>\
        <property name="history" type="as" access="read" />\
        <property name="running" type="b" access="read" />\
        <signal name="changed">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
        <signal name="toggled">\
            <arg direction="out" name="running" type="b" />\
        </signal>\
    </interface>\
</node>`;