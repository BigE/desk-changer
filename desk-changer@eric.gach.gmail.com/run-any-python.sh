#!/usr/bin/env bash

CODE_WRONG_USAGE=255
CODE_NO_PYTHON=254

# input params

if [ $# -eq 0 ]
  then
    echo "Runs the given script with the first found Python version"
    echo "Usage: $0 <PYTHON_SCRIPT>"
    exit $CODE_WRONG_USAGE
fi
SCRIPT=$1

# python version checker

PYTHON2='/usr/bin/env python'
PYTHON3='/usr/bin/env python3'

function check_python() {
    eval "$1 -V &> /dev/null"
    if [ $? -eq 0 ]; then
        true
    else
        false
    fi;
}

if check_python "$PYTHON2"; then
    eval "$PYTHON2 \"$SCRIPT\""
elif check_python "$PYTHON3"; then
    eval "$PYTHON3 \"$SCRIPT\""
else
    echo "NO PYTHON DETECTED!"
    exit $CODE_NO_PYTHON
fi;
