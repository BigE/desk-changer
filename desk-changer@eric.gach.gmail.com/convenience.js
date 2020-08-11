'use strict';

const Config = imports.misc.config;

function checkShellVersion(version, comparison) {
    let shell_version = Config.PACKAGE_VERSION,
        shell_version_major = shell_version.split('.')[0],
        shell_version_minor = shell_version.split('.')[1],
        compare_version_major = version.split('.')[0],
        compare_version_minor = version.split('.')[1];

    switch (comparison) {
        case '>':
            return shell_version_major > compare_version_major && shell_version_minor > compare_version_minor;
        case '<':
            return shell_version_major < compare_version_major && shell_version_minor < compare_version_minor;
        case '<=':
            return shell_version_major <= compare_version_major && shell_version_minor <= compare_version_minor;
        case '>=':
            return shell_version_major >= compare_version_major && shell_version_minor >= compare_version_minor;
        case '!=':
            return shell_version_major != compare_version_major && shell_version_minor != compare_version_minor;
        case '!==':
            return shell_version_major !== compare_version_major && shell_version_minor !== compare_version_minor;
        case '===':
            return shell_version_major === compare_version_major && shell_version_minor === compare_version_minor;
        case '==':
        default:
            return shell_version_major == compare_version_major && shell_version_minor == compare_version_minor;
    }
}
