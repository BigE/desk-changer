# Contributing to DeskChanger
If you would like to contribute to DeskChanger, please read through this document.

## Development Requirements
To work on the project you will need the following software
 * `make` for running commands in the `Makefile`
 * `xgettext` for working with translations
 * `yarn` for package management and TypeScript compilation
 * `zip` for making the ZIP file of the extension

## Pull Requests
Pull requests are actively welcome for DeskChanger. If you would like to contribute you can take a look at any of the
existing
[help-wanted issues](https://github.com/BigE/desk-changer/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22help%20wanted%22)
that are available, or follow the [Translations](#translations) part of this document to improve the translations. All
pull requests will be subject to the
[Gnome Shell Extension Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html)
as that is what the extension will have to go through to be published on the
[extensions.gnome.org](https://extensions.gnome.org) website.

### For new features
 * Create a [new GitHub Issue](https://github.com/BigE/desk-changer/issues/new/choose) proposing the feature
 * Fork the repository and create a new branch from `master`
 * Make code changes
 * Ensure [translations are up to date]() (only required if calling `gettext`)
 * Test changes through both methods in [Testing](#testing)
 * Address any feedback in code review

### For bug fixes
 * Assign yourself to an exist issue
 * Fork the repository and create a new branch from `master`
 * Ensure [translations are up to date]() (only required if updates made to `gettext` calls)
 * Test changes through both methods in [Testing](#testing)
 * Address any feedback in code review

## Translations
Translations are supported through out the extension, its preferences and the background service as well. The
translations use xgettext, so you must have this installed to run any commands related to translations. If you would
like to contribute to a language you can start in the `po` folder. The existing translation file is under the `po`
folder as `po/desk-changer.pot` and should contain translations from the entire project.

After changes are completed to the translations, please look at [Testing](#testing) for more information about how to
test the changes.

### Create language folder
If the language you want to contribute to does not exist, just create the folder in `po` for it:

`mkdir po/fr`

Once you have created the folder, just copy the `po/desk-changer.pot` file into your language folder and continue to
[Updating the translation file](#updating-the-translation-file) to add your translations!

### Updating the translation file
To update the translations, simply look under the language folder you want to work with inside of the `po/<LANG>`
folder. There should be an existing file `desk-changer.po` that contains all of the translations for `<LANG>`. Just
simply update this file with your changes and make sure you've added your contributor information.

### Testing translations
To test translations specifically you will need to run the `Makefile` command `make update-translations`. This will
ensure that the extension is fully built and then, using `msgfmt` it will update all translations into the `dist`
folder. Once this completes, the extension is ready to test or package with your new translation changes.

### Update translations from code
This is **ONLY** neccissary when making code level changes that use the internal `gettext` translation function. This
also applies to UI changes under the `resources/ui` folder with the `translatable` flag. Updating the translations
from the code only updates the `po/desk-changer.pot` file. If you have added a new source code file or UI resource
file, it should be added to the file `po/xgettext.txt` before running the command.

`make pot`

This will run `xgettext` using the `po/xgettext.txt` file as the file list argument to parse through. Once completed,
the `po/desk-changer.pot` file will be updated with the most recent changes from the source.

## Testing
To test your changes you should be running a development version of the extension locally. To do that you can use the
`Makefile` commands provided to either [install](#install) or [symlink](#symlink-command) the project. Once the
extension is installed, you can either login/logout to test changes or run the provided `test.sh` script. The script
simply runs `gnome-shell --devkit` through the dbus-session-runner, which opens a window in your existing session.

`./test.sh`

### Symlink the project
Symlinking the project comes at a cost, if you break the extension it will not load on your next logout/login until you
fix it. However, this is the best way to test changes through the `gnome-shell` provided devkit command. This is also
the easiest way to test preference changes as each time they are opened, any changes to the source code are
automatically reflected.

#### Symlink Command
`make symlink`

To symlink the project you will use the `make symlink` command provided with the `Makefile`. This will ensure the `dist`
folder has been created by running some previous commands as well as the schemas/gschemas.compiled file is created. Once
this is complete, the extension will be ready to use. If you did not have the extension installed previously, you will
have to logout/login before it will become active.

##### Updating source with changes
`make clean; make symlink`

When testing the extension as a symlink, all code changes will need to be reflected by rebuilding the extension. First
running `make clean` will remove all files that will be generated. Once that is completed, running `make symlink` will
run the targets required to rebuild the extension inside the dist folder, then recreate the symlink. If you want to do
do this manually, you can run the following `Makefile` targets:

`make clean; make dist && make schemas/gschemas.compiled`

#### Remove Symlink
`make unsymlink`

To remove the symlink you can simply run `make unsymlink` which will **ONLY** remove a symlink and not remove an
existing directory of the extension or the extension itself from `gnome-shell`. If you wish to fully uninstall the
extension please see [Uninstall](#uninstall) for directions.

### Install the project
Installing the project is the best way to test the extension before sending any sort of pull request or packaging it up
for distribution. This method does not allow you to test any live code changes, but will test the full process that is
required by the packaging process. This should be as close to installing the extension in the official method as
possible as it uses `gnome-extensions` to install the packaged ZIP file that is created from the `dist` folder.

#### Install
`make install`

To install the project from a ZIP file use the `make install` command that is provided by the `Makefile`. This will fail
if the extension is already installed, even if it is not enabled.

#### Uninstall
`make uninstall`

To uninstall the extension you can use `make uninstall` which simply just calls the `gnome-extensions uninstall` command
automatically. This will completely remove the extension from `gnome-shell`.

## License
By contributing to DeskChanger, you agree that your contributions will be licensed under the `LICENSE` file in the root
directory of this git repo.
