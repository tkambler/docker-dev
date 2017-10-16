'use strict';

const Promise = require('bluebird');
const spawn = require('child_process').spawn;

module.exports = (cmd, args, options, verbose) => {
    return new Promise((resolve, reject) => {
        let spawned = spawn(cmd, args, options);
        let out = '';
        let err = '';
        spawned.stdout.on('data', (data) => {
            data = data.toString('utf8');
            out += data;
            if (verbose) console.log(data);
        });
        spawned.stderr.on('data', (data) => {
            data = data.toString('utf8');
            err += data;
            if (verbose) console.log(data);
        });
        spawned.on('close', (code) => {
            let data = {
                'out': out,
                'err': err,
                'code': code
            };
            if (code === 0) {
                return resolve(data);
            } else {
                return reject(data);
            }
        });
    });
};
