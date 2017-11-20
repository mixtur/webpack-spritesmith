var fs = require('fs');

module.exports = function (fileName, bypass, callback) {
    if (bypass) {
        callback()
    } else {
        fs.utimes(
            fileName,
            new Date(Date.now() - 10000),
            new Date(Date.now() - 10000),
            callback
        );
    }
};
