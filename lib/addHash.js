var crypto = require('crypto');

module.exports = function addHash(spritesmithResult) {
    var md5 = crypto.createHash('md5');
    md5.update(spritesmithResult.image);
    spritesmithResult.imageHash = md5.digest('hex');
    return spritesmithResult;
};
