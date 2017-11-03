'use strict';

const _ = require('lodash');
const fs = require('fs');
const os = require('os');

exports = module.exports = function(logFile) {

    return function log(...args) {

        args = args.map((arg) => {
            return _.isString(arg) ? arg : JSON.stringify(arg);
        }).join(' ').replace(/^\s+|\s+$/g, '') + os.EOL;

        return fs.writeFileSync(logFile, args);

    };

};

exports['@singleton'] = true;
exports['@require'] = ['logFile'];