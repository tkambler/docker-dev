'use strict';

const Promise = require('bluebird');

module.exports = (seconds) => {
    return new Promise((resolve, reject) => {
        return setTimeout(() => {
            return resolve();
        }, seconds * 1000);
    });
};
