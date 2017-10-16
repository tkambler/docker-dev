'use strict';

exports = module.exports = function() {

    const path = require('path');

    return (mod) => {
        return require(path.resolve(__dirname, '../../../lib', mod));
    };

};

exports['@singleton'] = true;
exports['@require'] = [];
