const fs = require('mz/fs');

module.exports = (fileName, bypass) => {
    if (!bypass) {
        return fs.utimes(
            fileName,
            new Date(Date.now() - 10000),
            new Date(Date.now() - 10000)
        );
    }
};
