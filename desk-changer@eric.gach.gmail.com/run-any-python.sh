#!/usr/bin/env bash

CODE_WRONG_USAGE=255
CODE_NO_PYTHON=254

# input params

if [ $# -lt 1 ]; then
    echo "Runs the given script with the first found Python version"
    echo "Usage: $0 <PYTHON_SCRIPT>"
    exit $CODE_WRONG_USAGE
fi
SCRIPT="$1"

PYTHONS=(python python3 python2)

function check_python() {
    # check if python executable is there and if GObject can be used
    if $1 -c "import gi" &> /dev/null; then
        true
    else
        false
    fi;
}

for P in "${PYTHONS[@]}"; do
    PYTHON="/usr/bin/env $P"
    if check_python "$PYTHON"; then
        echo "Running: $PYTHON \"$SCRIPT\""
        $PYTHON "$SCRIPT"
        exit $?
    fi;
done

echo "NO PYTHON DETECTED!"
exit $CODE_NO_PYTHON
