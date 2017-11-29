'use strict';

const os = require('os');
const path = require('path');
const fs = require('./fs');
const hostsPath = require('hosts-path')();
const tmpFile = path.resolve(os.tmpdir(), 'docker-dev-hosts.txt');
const contents = fs.readFileSync(tmpFile, 'utf8');

fs.writeFileSync(hostsPath, contents);

console.log(`Updated hosts file (${hostsPath}) with contents:`);
console.log(contents);
