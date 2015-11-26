module.exports = function (f) {
    var isCalled = false;
    var lastResult = null;
    return function () {
        if (isCalled) {
            return lastResult;
        }
        var args = new Array(arguments.length);
        for (var i = 0; i < arguments.length; i++) {
            args[i] = arguments[i];
        }
        isCalled = true;
        return lastResult = f.apply(this, args);
    }
};
