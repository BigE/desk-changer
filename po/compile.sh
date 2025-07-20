#!/bin/sh

DEST=$1

for l in */
do
    echo "$l"
    mkdir -p "$DEST/$l/LC_MESSAGES"
    msgfmt "./$l/desk-changer.po" -o "$DEST/$l/LC_MESSAGES/desk-changer.mo"
done
