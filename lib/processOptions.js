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
        apiOptions: {
            generateSpriteName: function (fileName) {
                return path.parse(path.relative(mergedOptions.src.cwd, fileName)).name;
            },
            cssImageRef: rawOptions.target.image
        },
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

    processRetinaOptions(mergedOptions);

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

function processRetinaOptions(options) {
    if (!('retina' in options)) {
        return;
    }

    if (typeof options.retina === 'string') {
        var suffix = options.retina;
        var r = options.retina = {
            classifier: suffixToClassifier(suffix)
        };

        r.targetImage = r.targetImage || addSuffixToFileName(suffix, options.target.image);
        r.cssImageRef = r.cssImageRef || addSuffixToFileName(suffix, options.apiOptions.cssImageRef);
    } else {
        options.retina.classifier || fThrowExpectField('retina.classifier');
        options.retina.targetImage || fThrowExpectField('retina.targetImage');
        options.retina.cssImageRef || fThrowExpectField('retina.cssImageRef');
    }

    options.spritesheetTemplatesOptions.format += '_retina';
}

function suffixToClassifier(suffix) {
    return function (fileName) {
        var parsed = splitExt(fileName);
        if (hasSuffix(suffix, parsed.name)) {
            return {
                type: 'retina',
                retinaName: fileName,
                normalName: parsed.name.slice(0, -suffix.length) + parsed.ext
            };
        }
        return {
            type: 'normal',
            retinaName: parsed.name + suffix + parsed.ext,
            normalName: fileName
        };
    };
}

function hasSuffix(suffix, str) {
    return str.slice(-suffix.length) === suffix;
}

function splitExt(fileName) {
    var extInd = fileName.lastIndexOf('.');
    var ext = fileName.slice(extInd);
    var name = fileName.slice(0, extInd);
    return {
        name: name,
        ext: ext
    };
}

function addSuffixToFileName(suffix, fileName) {
    var parsed = path.parse(fileName);
    parsed.name += suffix;
    parsed.base = parsed.name + parsed.ext;
    return path.format(parsed);
}

