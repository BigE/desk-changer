const Me = imports.misc.extensionUtils.getCurrentExtension();

function debug(message) {
    let caller = getCaller();
    let output = '[' + Me.metadata.uuid + '/' + caller.split('/').pop() + '] ' + message
    log(output);
}

/**
 * Implemented the two functions below using tweaked code from:
 * http://stackoverflow.com/a/13227808
 */

function getCaller() {
    var stack = getStack();

    // Remove superfluous function calls on stack
    stack.shift(); // getCaller --> getStack
    stack.shift(); // debug --> getCaller

    // Return caller's caller
    return stack[0];
}

function getStack() {
    // Save original Error.prepareStackTrace
    var origPrepareStackTrace = Error.prepareStackTrace;

    // Override with function that just returns `stack`
    Error.prepareStackTrace = function (_, stack) {
        return stack;
    };

    // Create a new `Error`, which automatically gets `stack`
    var err = new Error();

    // Evaluate `err.stack`, which calls our new `Error.prepareStackTrace`
    var stack = err.stack.split("\n");

    // Restore original `Error.prepareStackTrace`
    Error.prepareStackTrace = origPrepareStackTrace;

    // Remove superfluous function call on stack
    stack.shift(); // getStack --> Error

    return stack
}