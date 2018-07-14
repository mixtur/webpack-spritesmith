const path = require('path');
const Spritesmith = require('spritesmith');
const _ = require('lodash');

const substitute = require('./substitute');
const writeFileR = require('./writeFileR');
const writeCss = require('./writeCss');
const sendToPast = require('./sendToPast');
const promiseCall = require('./promiseCall');

module.exports = async (options, metaOutput, isInitial, srcFiles) => {
    const spritesmithResult = promiseCall(Spritesmith, {
        ...options.spritesmithOptions,
        src: srcFiles.map(fileName => path.resolve(options.src.cwd, fileName))
    });

    const imageNameWithSubstitutions = substitute(options.target.image, spritesmithResult);
    const willWriteCss = writeCss(options.target.css, toSpritesheetTemplatesFormat(spritesmithResult), isInitial);

    await writeFileR(imageNameWithSubstitutions, spritesmithResult.image, 'binary');
    await sendToPast(imageNameWithSubstitutions, !isInitial);

    return {
        css: await willWriteCss,
        images: [imageNameWithSubstitutions]
    };

    function toSpritesheetTemplatesFormat(spritesmithResult) {
        const generateSpriteName = options.apiOptions.generateSpriteName;
        const sprites = _.map(
            spritesmithResult.coordinates,
            (oneSourceInfo, fileName) => ({
                ...oneSourceInfo,
                name: generateSpriteName(fileName),
            })
        );

        const imageRefWithSubstitutions = substitute(options.apiOptions.cssImageRef, spritesmithResult);
        const spritesheet = {
            image: imageRefWithSubstitutions,
            ...spritesmithResult.properties
        };

        return {sprites, spritesheet};
    }
};
