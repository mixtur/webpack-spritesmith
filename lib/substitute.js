var loaderUtils = require('loader-utils');
var path = require('path');

module.exports = function (fullName, spritesmithResult) {
    var parsed = path.parse(fullName);

    parsed.base = loaderUtils.interpolateName(
        {},
        parsed.base,
        {content: spritesmithResult.image}
    );

    return path.format(parsed);
};
