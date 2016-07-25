module.exports = function (str, spritesmithResult) {
    return str.replace('[hash]', spritesmithResult.imageHash);
};
