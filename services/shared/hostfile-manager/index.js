'use strict';

exports = module.exports = function(config, docker, rekwire, log) {

    const fs = rekwire('fs');
    const _ = require('lodash');
    const s = require('underscore.string');
    const hostsPath = require('hosts-path');
    const os = require('os');
    const isElevated = require('is-elevated');
    const sudo = require('sudo-prompt');
    const { async, await } = require('asyncawait');
    const path = require('path');
    const writeScript = path.resolve(__dirname, '../../../lib/write-hosts.js');

    class HostfileManager {

        constructor() {

            ['set', 'setHostnames'].forEach((method) => {
                this[method] = async(this[method]);
            });

        }

        get tmpFile() {

            return this._tmpFile ? this._tmpFile : this._tmpFile = path.resolve(os.tmpdir(), 'docker-dev-hosts.txt');

        }

        get hostsPath() {

            return this._hostsPath ? this._hostsPath : this._hostsPath = hostsPath();

        }

        set(hostnames = []) {

            const missingEntries = this.getMissing(hostnames);
            const extraneousEntries = this.getExtraneous(hostnames);
            const existingEntries = this.getExisting();

            if (!missingEntries.length && !extraneousEntries.length) {
                return;
            }

            this.setHostnames(hostnames);

        }

        getMissing(hostnames) {

            const existing = this.getExisting();
            return hostnames.filter((hostname) => {
                let match = _.find(existing, (line) => {
                    line = s.clean(line).split(' ');
                    return line[1] === hostname;
                });
                return match ? false : true;
            });

        }

        getExtraneous(hostnames) {

            if (this._extraneous) {
                return this._extraneous;
            }

            const existing = this.getExisting();
            const res = [];

            existing.forEach((line) => {
                line = s.clean(line).split(' ');
                const match = _.find(hostnames, (hostname) => {
                    return hostname === line[1];
                });
                if (!match) {
                    res.push(line.join(' '));
                }
            });

            this._extraneous = res;

            return res;

        }

        getExisting() {

            return s.lines(fs.readFileSync(this.hostsPath, 'utf8'))
                .filter((line) => {
                    return line.indexOf(`# docker-dev-id: ${config.get('projectName')}`) >= 0;
                });

        }

        setHostnames(hostnames = []) {

            const elevated = await(isElevated());

            const newLines = hostnames.map((host) => {
                return `127.0.0.1 ${host} # docker-dev-id: ${config.get('projectName')}`;
            });

            const lines = s.lines(fs.readFileSync(this.hostsPath, 'utf8'))
                .filter((line) => {
                    if (line.indexOf(`# docker-dev-id: ${config.get('projectName')}`) >= 0) {
                        return false;
                    } else {
                        return true;
                    }
                });

            lines.splice(lines.length, 0, ...newLines);

            const updated = lines.join(os.EOL);

            if (elevated) {
                fs.writeFileSync(this.hostsPath, updated);
            } else {
                fs.writeFileSync(this.tmpFile, updated);
                const res = await(this.sudo());
            }

        }

        sudo() {

            return new Promise((resolve, reject) => {

                return sudo.exec(`node ${writeScript}`, (err, stdout, stderr) => {

                    const res = {
                        'err': err,
                        'stdout': stdout,
                        'stderr': stderr
                    };

                    return err ? reject(res) : resolve(res);

                });

            });

        }

    }

    return new HostfileManager();

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'docker', 'rekwire', 'log'];
