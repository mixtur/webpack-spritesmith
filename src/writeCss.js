const async = require('async');
const writeFileR = require('./writeFileR');
const spritesheetTemplater = require('spritesheet-templates');
const sendToPast = require('./sendToPast');

module.exports = async (sources, templaterData, shouldSendToPast) => {
    return await Promise.all(sources.map(async css => {
        const fileName = css[0];

        const code = spritesheetTemplater(templaterData, css[1]);

        await writeFileR(fileName, code);
        await sendToPast(fileName, !shouldSendToPast);

        return fileName;
    }));
};
