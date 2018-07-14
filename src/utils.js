const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('mz/fs');

const sendToPast = (fileName, bypass) => {
    if (bypass) return Promise.resolve();
    return fs.utimes(
        fileName,
        new Date(Date.now() - 10000),
        new Date(Date.now() - 10000)
    );
};

const promiseCall = (fn, ...args) =>
    new Promise((resolve, reject) =>
        fn(...args, (err, result) =>
            err ? reject(err) : resolve(result)));

const writeFileR = async (...args) => {
    const fileName = args[0];
    await promiseCall(mkdirp, path.dirname(fileName));
    return fs.writeFile(...args);
};

module.exports = {
    sendToPast,
    promiseCall,
    writeFileR
};
