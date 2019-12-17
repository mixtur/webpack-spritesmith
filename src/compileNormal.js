const path = require('path');
const Spritesmith = require('spritesmith');
const _ = require('lodash');

const substitute = require('./substitute');
const writeCss = require('./writeCss');
const {sendToPast, promiseCall, writeFileR} = require('./utils');

module.exports = async (options, metaOutput, isInitial, srcFiles) => {
    const spritesmithResult = await promiseCall(Spritesmith.run.bind(Spritesmith), {
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
                source_image: fileName
            })
        );

        const imageRefWithSubstitutions = substitute(options.apiOptions.cssImageRef, spritesmithResult);
        const spritesheet = {
            image: imageRefWithSubstitutions,
            ...spritesmithResult.properties
        };

        const spritesheet_info = options.apiOptions.spritesheet_info || {
            name:'spritesheet'
        }

        return {sprites, spritesheet ,spritesheet_info};
    }
};
