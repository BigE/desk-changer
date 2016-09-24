AC_PREREQ(2.63)
# This file is processed by autoconf to create a configure script
AC_INIT([gnome-shell-extension-desk-changer],[10.0],[https://github.com/BigE/desk-changer/issues])

AC_CONFIG_MACRO_DIR([m4])
AC_CONFIG_AUX_DIR([config])

AM_INIT_AUTOMAKE([1.10 no-define foreign dist-xz no-dist-gzip])

m4_ifdef([AM_SILENT_RULES],[AM_SILENT_RULES([yes])])

GLIB_GSETTINGS

AC_PROG_CC
AM_PROG_VALAC([0.16])
PKG_CHECK_MODULES(gio, gio-2.0)
PKG_CHECK_MODULES(glib, glib-2.0)
AC_CONFIG_FILES([Makefile])

AC_OUTPUT