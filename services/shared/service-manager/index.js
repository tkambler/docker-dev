'use strict';

exports = module.exports = function(config, docker, rekwire, log) {

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

            ['bringUp', 'build', 'pull', 'executeCommand', 'executeScripts', 'exportData', 'getServiceContainers', 'isRunning', 'up', 'scale'].forEach((method) => {
                this[method] = async(this[method]);
            });

        }

        stopExistingContainers(remove = false) {

            const existingContainers = await(this.getServiceContainers());

            const runningContainers = existingContainers.filter((container) => {
                return container.data.State.Status === 'running';
            });

            const nonRunningContainers = existingContainers.filter((container) => {
                return container.data.State.Status !== 'running';
            });

            if (remove) {
                nonRunningContainers.forEach((container) => {
                    return await(container.remove());
                });
            }

            if (runningContainers.length === 0) {
                return;
            }

            debug(`Found ${runningContainers.length} existing container(s) for service: ${this.serviceName}`);
            this.emit('stopping_containers', {
                'count': runningContainers.length
            });

            const scripts = _.get(this, 'devEntry.service-scripts.pre-down') || [];
            const [ container ] = runningContainers;

            scripts.forEach((cmd) => {
                await(
                    this.executeCommand(container, cmd)
                );
            });

            runningContainers.forEach((container) => {
                debug(`Stopping container: ${container.id}`);
                await(container.stop());
                if (remove) {
                    debug(`Removing container: ${container.id}`);
                    await(container.remove());
                }
            });

        }

        pull() {

            if (!this.composerEntry.image) {
                return;
            }

            this.emit('pulling_image', {
                'image': this.composerEntry.image
            });

            return new Promise((resolve, reject) => {
                let spawned = spawn('docker-compose', ['pull', this.serviceName], {
                    'cwd': config.get('projectFolder')
                });
                let out = '';
                let err = '';
                spawned.stdout.on('data', (data) => {
                    data = data.toString('utf8');
                    out = out + data;
                    log(data);
                });
                spawned.stderr.on('data', (data) => {
                    data = data.toString('utf8');
                    err = err + data;
                    log(data);
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
                        this.emit('skip_build');
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
                            data = data.toString('utf8');
                            out = out + data;
                            log(data);
                        });
                        spawned.stderr.on('data', (data) => {
                            data = data.toString('utf8');
                            err = err + data;
                            log(data);
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
                        if (!force) {
                            this.emit('skip_export');
                            return false;
                        } else {
                            fs.removeSync(dest);
                            return true;
                        }
                    }

                });

            if (devExports.length > 0) {
                this.emit('exporting_data');
                return await(docker.exportFromImage(this.composerEntry.image, devExports));
            }

        }

        bringUp(startDeps = true) {

            const existingContainers = await(this.getServiceContainers());
            const existingContainerIds = existingContainers.map((container) => {
                return container.id;
            });
//             console.log('CONTAINERS1', JSON.stringify(existingContainerIds, null, 4));

            const args = ['up', '-d', this.serviceName];

            if (!startDeps) {
                args.splice(1, 0, '--no-deps');
            }

            const launch = () => {

                return new Promise((resolve, reject) => {
                    this.emit('starting_service');
                    let spawned = spawn('docker-compose', args, {
                        'cwd': config.get('projectFolder')
                    });
                    let out = '';
                    let err = '';
                    spawned.stdout.on('data', (data) => {
                        data = data.toString('utf8');
                        out = out + data;
                        log(data);
                    });
                    spawned.stderr.on('data', (data) => {
                        data = data.toString('utf8');
                        err = err + data;
                        log(data);
                    });
                    spawned.on('close', (code) => {
                        if (code === 0) {
                            if (!this.devEntry.require_healthcheck) {
                                this.emit('service_started');
                            }
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

            };

            const healthCheckTimeout = parseInt(this.devEntry.healthcheck_timeout, 10) || 30; // seconds

            const waitForHealth = async(() => {

                this.emit('wait_healthcheck');

                const start = (new Date()).getTime();

                return new Promise((resolve, reject) => {

                    const intervalId = setInterval(() => {

                            this.getServiceContainers()
                                .filter((container) => {
                                    return container.data.State.Status === 'running';
                                })
                                .then((runningContainers) => {

                                    let pass = 0;
                                    const healthChecks = [];

                                    runningContainers.forEach((container) => {
                                        const health = _.get(container, 'data.State.Health');
//                                         console.log(JSON.stringify(health, null, 4));
                                        if (_.get(health, 'Status') === 'healthy') {
                                            pass++;
                                        }
                                        healthChecks.push(health);
                                    });

//                                     console.log(JSON.stringify(healthChecks, null, 4));

                                    if (pass === runningContainers.length) {
                                        clearInterval(intervalId);
                                        this.emit('service_started');
                                        return resolve();
                                    }

                                    const diff = Math.floor(((new Date()).getTime() - start) / 1000);
                                    if (diff > healthCheckTimeout) {
                                        this.emit('healthcheck_failed', {
                                            'healthchecks': healthChecks
                                        });
                                        return reject();
                                    }

                                });

                    }, 4000);

                });

            });

            await(launch());
            await(pause(3));

            const existingContainers2 = await(this.getServiceContainers());
            const existingContainerIds2 = existingContainers2.map((container) => {
                return container.id;
            });
//             console.log('CONTAINERS2', JSON.stringify(existingContainerIds2, null, 4));

            if (this.devEntry.require_healthcheck) {
                await(waitForHealth());
            }

            const newIds = _.difference(existingContainerIds2, existingContainerIds);

            return newIds;

        }

        executeCommand(container, cmd) {

            if (!container) {

                const runningContainers = await(this.getServiceContainers())
                    .filter((container) => {
                        return container.data.State.Status === 'running';
                    });

                if (runningContainers.length === 0) {
                    throw new Error(`Unable to execute service scripts. No running containers found for service: ${this.serviceName}`);
                }

                container = runningContainers[0];

            }

            const exec = await(
                container.execAsync({
                    'Cmd': cmd,
                    'AttachStdout': true,
                    'AttachStderr': true
                })
            );

            return new Promise((resolve, reject) => {

                this.emit('executing_command', cmd);

                exec.start({
                }, (err, stream) => {

                    if (err) {
                        return reject(err);
                    }

                    stream.on('data', (chunk) => {
                        log(chunk.toString('utf8'));
                    });

                    stream.on('error', (err) => {
                        console.log('err', err);
                        return reject(err);
                    });

                    stream.on('end', function() {
                        exec.inspect((err, data) => {
                            if (err) {
                                return reject(err);
                            }
                            if (data.ExitCode === 0) {
                                return resolve();
                            } else {
                                return reject(new Error(`Command exited with status code ${data.ExitCode}: ${cmd.join(' ')}`));
                            }
                        });
                    });

                });

            });

        }

        executeScripts() {

            const scripts = _.get(this, 'devEntry.service-scripts.post-up') || [];

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

            const hostScripts = _.get(this, 'devEntry.host-scripts.post-up') || [];

            hostScripts.forEach((cmd) => {
                this.emit('executing_host_command', cmd);
                await(
                    new Promise((resolve, reject) => {
                        let spawned = spawn(cmd[0], cmd.slice(1), {
                            'cwd': config.get('projectFolder')
                        });
                        let out = '';
                        let err = '';
                        spawned.stdout.on('data', (data) => {
                            data = data.toString('utf8');
                            out = out + data;
                            log(data);
                        });
                        spawned.stderr.on('data', (data) => {
                            data = data.toString('utf8');
                            err = err + data;
                            log(data);
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
                    })
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

        up(force = false) {

            const isRunning = await(this.isRunning());

            if (isRunning && !force) {
                this.emit('already_running');
                return;
            }

            debug(`Bringing up service`, this.serviceName);

            await(this.stopExistingContainers(force));
            // await(this.pull());
//             await(this.build(force));
            await(this.build(true));
            await(this.exportData(force));
            const newContainerIds = await(this.bringUp(false));
//             console.log('newContainerIds', newContainerIds);
            await(pause(3));
            await(this.verifyStatus());

            if (newContainerIds.length > 0) {
                await(this.executeScripts());
            }

        }

        down(force) {

            await(this.stopExistingContainers(force));

        }

        scale(scale) {

            if (!scale) {
                throw new Error(`A desired scale must be passed.`);
            }

        }

        getServiceContainers() {

            const res = await(docker.getProjectContainers())
                .map((container) => {
                    container.data = await(container.inspectAsync());
                    return container;
                })
                .filter((container) => {
                    return container.data.Config.Labels['com.docker.compose.service'] === this.serviceName;
                });

//             console.log('res', res);
            return res;

        }

        isRunning() {

            const runningContainers = await(this.getServiceContainers())
                .filter((container) => {
                    return container.data.State.Status === 'running';
                });

            return runningContainers.length > 0;

        }

    }

    return ServiceManager;

};

exports['@singleton'] = true;
exports['@require'] = ['config', 'docker', 'rekwire', 'log'];
