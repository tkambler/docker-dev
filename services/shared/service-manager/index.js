'use strict';

exports = module.exports = function(config, docker, rekwire) {

    const Promise = require('bluebird');
    const EventEmitter2 = require('eventemitter2').EventEmitter2;
    const { async, await } = require('asyncawait');
    const spawn = require('child_process').spawn;
    const path = require('path');
    const fs = rekwire('fs');
    const pause = rekwire('pause');
    const debug = require('debug')('docker-dev');
    const _ = require('lodash');

    class ServiceManager extends EventEmitter2 {


        constructor(serviceName) {

            super();

            this.serviceName = serviceName;
            this.composerEntry = config.get(`composer:services:${serviceName}`);
            this.devEntry = config.get(`dev:services:${serviceName}`);

            ['build', 'executeScripts', 'exportData', 'getServiceContainers', 'up', 'scale'].forEach((method) => {
                this[method] = async(this[method]);
            });

        }

        stopAndRemoveExistingContainers(force) {

            const existingContainers = await(this.getServiceContainers());

            const runningContainers = existingContainers.filter((container) => {
                return container.data.State.Status === 'running';
            });

            const nonRunningContainers = existingContainers.filter((container) => {
                return container.data.State.Status !== 'running';
            });

            nonRunningContainers.forEach((container) => {
                return await(container.remove());
            });

            if (runningContainers.length > 0) {
                if (!force) {
                    return;
                }
                debug(`Found ${runningContainers.length} existing container(s) for service: ${this.serviceName}`);
                this.emit('stopping_containers', {
                    'count': runningContainers.length
                });
            }

            runningContainers.forEach((container) => {
                debug(`Stopping container: ${container.id}`);
                await(container.stop());
                debug(`Removing container: ${container.id}`);
                await(container.remove());
            });

        }

        build(force) {

            if (!this.composerEntry.build) {
                return;
            }

            const srcImg = Promise.promisifyAll(docker.getImage(this.composerEntry.image));

            return srcImg.inspectAsync()
                .catch((err) => {
                    return null;
                })
                .then((srcImgData) => {
                    if (srcImgData && !force) {
                        debug(`Image already exists for service: ${this.serviceName}`);
                        return;
                    }
                    debug(`Building image for service: ${this.serviceName}`);
                    this.emit('building_image', {
                        'image': this.composerEntry.image
                    });
                    return new Promise((resolve, reject) => {
                        let spawned = spawn('docker-compose', ['build', this.serviceName], {
                            'cwd': config.get('projectFolder')
                        });
                        let out = '';
                        let err = '';
                        spawned.stdout.on('data', (data) => {
                            out = out + data.toString('utf8');
                        });
                        spawned.stderr.on('data', (data) => {
                            err = err + data.toString('utf8');
                        });
                        spawned.on('close', (code) => {
                            if (code === 0) {
                                return resolve();
                            } else {
                                return reject({
                                    'out': out,
                                    'err': err,
                                    'code': code
                                });
                            }
                        });
                    });
                });

        }

        exportData(force) {

            let devExports = _.get(this, 'devEntry.export') || [];

            devExports = devExports.map((devExport) => {
                let [src, dest] = devExport.split(':');
                if (!path.isAbsolute(src)) {
                    throw new Error(`When specifying a service export folder, the source must be an absolute path.`);
                }
                if (!path.isAbsolute(dest)) {
                    dest = path.resolve(config.get('projectFolder'), dest);
                }
                if (!this.composerEntry.image) {
                    throw new Error(`Service does not specify an image in docker-compose.yml: ${this.serviceName}`);
                }
                return {
                    'src': src,
                    'dest': dest
                };
            })
                .filter(({ src, dest }) => {

                    let stats;

                    try {
                        stats = fs.statSync(dest);
                    } catch(e) {
                    }

                    if (!stats) {
                        return true;
                    } else {
                        return force;
                    }

                });

            if (devExports.length > 0) {
                this.emit('exporting_data');
                return await(docker.exportFromImage(this.composerEntry.image, devExports));
            }

        }

        bringUp() {

            return new Promise((resolve, reject) => {
                this.emit('starting_service');
                let spawned = spawn('docker-compose', ['up', '-d', this.serviceName], {
                    'cwd': config.get('projectFolder')
                });
                let out = '';
                let err = '';
                spawned.stdout.on('data', (data) => {
                    out = out + data.toString('utf8');
                });
                spawned.stderr.on('data', (data) => {
                    err = err + data.toString('utf8');
                });
                spawned.on('close', (code) => {
                    if (code === 0) {
                        return resolve();
                    } else {
                        return reject({
                            'out': out,
                            'err': err,
                            'code': code
                        });
                    }
                });
            });

        }

        executeCommand(container, cmd) {

            return container.execAsync({
                'Cmd': cmd,
                'AttachStdout': true,
                'AttachStderr': true
            })
                .then((exec) => {

                    return new Promise((resolve, reject) => {

                        exec.start((err, stream) => {

                            if (err) {
                                return reject(err);
                            }

                            stream.on('data', (chunk) => {
//                                 console.log(chunk.toString());
                            });
                            stream.on('error', (err) => {
                                return reject(err);
                            });
                            stream.on('end', () => {
                                return resolve();
                            });

                        });

                    });

                });

        }

        executeScripts() {

            const scripts = this.devEntry['service-scripts']['post-up'];

            const runningContainers = await(this.getServiceContainers())
                .filter((container) => {
                    return container.data.State.Status === 'running';
                });

            if (runningContainers.length === 0) {
                throw new Error(`Unable to execute service scripts. No running containers found for service: ${this.serviceName}`);
            }

            const [ container ] = runningContainers;

            scripts.forEach((cmd) => {
                await(
                    this.executeCommand(container, cmd)
                );
            });

        }

        verifyStatus() {

            const runningContainers = await(this.getServiceContainers())
                .filter((container) => {
                    return container.data.State.Status === 'running';
                });

            if (runningContainers.length === 0) {
                throw new Error(`Failed to start service: ${this.serviceName}`);
            }

        }

        up({ force = false }) {

            debug(`Bringing up service`, this.serviceName);

            await(this.stopAndRemoveExistingContainers(force));
            await(this.build(force));
            await(this.exportData(force));
            await(this.bringUp(force));
            await(pause(3));
            await(this.verifyStatus());
            await(this.executeScripts());

        }

        scale(scale) {

            if (!scale) {
                throw new Error(`A desired scale must be passed.`);
            }

        }

        getServiceContainers() {

            return await(docker.getProjectContainers())
                .map((container) => {
                    container.data = await(container.inspectAsync());
                    return container;
                })
                .filter((container) => {
                    return container.data.Config.Labels['com.docker.compose.service'] === this.serviceName;
                });

        }

    }

    return ServiceManager;

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'docker', 'rekwire'];
