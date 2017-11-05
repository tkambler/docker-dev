'use strict';

const _ = require('lodash');
const fs = require('fs');
const os = require('os');
const moment = require('moment');

exports = module.exports = function(logFile) {

    return function log(...args) {

        args = moment().format('MM-DD-YYYY HH:mm:ss a') + ' :: ' + args.map((arg) => {
            return _.isString(arg) ? arg : JSON.stringify(arg);
        }).join(' ').replace(/^\s+|\s+$/g, '') + os.EOL;

        return fs.appendFileSync(logFile, args);

    };

};

exports['@singleton'] = true;
exports['@require'] = ['logFile'];
