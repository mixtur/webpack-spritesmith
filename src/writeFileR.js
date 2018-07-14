const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('mz/fs');
const promiseCall = require('./promiseCall');

module.exports = async (...args) => {
    const fileName = args[0];
    await promiseCall(mkdirp, path.dirname(fileName));
    return fs.writeFile(...args);
};
