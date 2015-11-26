var _ = require('lodash');
var path = require('path');

function fThrowExpectField(f) { throw 'Expected field"' + f + '" in options of SpritesmithPlugin' }

module.exports = function (rawOptions) {
    rawOptions.src || fThrowExpectField('src');
    rawOptions.src.cwd || fThrowExpectField('src.cwd');
    rawOptions.src.glob || fThrowExpectField('src.glob');
    rawOptions.target || fThrowExpectField('target');
    rawOptions.target.css || fThrowExpectField('target.css');
    rawOptions.target.image || fThrowExpectField('target.image');

    var mergedOptions = _.merge({}, {
        apiOptions: {},
        spritesmithOptions: {},
        spritesheetTemplatesOptions: {
            format: extractFormatFromCSSFilename(rawOptions.target.css)
        }
    }, rawOptions);

    if (!mergedOptions.spritesheetTemplatesOptions.format) {
        throw 'SpritesmithPlugin was unable to derive ' +
        'css format from extension "' + path.parse(rawOptions.target.css).ext + '" ' +
        'in "target.css" and "spritesheetTemplatesOptions.format" was not specified. ' +
        'Recognized extensions are: ' + _.keys(extensionToCssFormat).join(', ') + '; ' +
        'to get a list of known formats read documentation of spritesheet-templates ' +
        'https://github.com/twolfson/spritesheet-templates';
    }

    return mergedOptions;
};

var extensionToCssFormat = {
    '.stylus': 'stylus',
    '.styl': 'stylus',
    '.sass': 'sass',
    '.scss': 'scss',
    '.less': 'less',
    '.json': 'json',
    '.css': 'css'
};

function extractFormatFromCSSFilename(cssFileName) {
    return extensionToCssFormat[path.parse(cssFileName).ext];
}
