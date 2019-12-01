const DBusName = 'org.gnome.Shell.Extensions.DeskChanger.Daemon';
const DBusPath = '/org/gnome/Shell/Extensions/DeskChanger/Daemon';
const DBusInterface = `<node>\
    <interface name="${DaemonDBusName}">\
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
        <signal name="changed">\
            <arg direction="out" name="uri" type="s" />\
        </signal>\
    </interface>\
</node>`;