'use strict';

exports = module.exports = function(rekwire, config) {

    const Promise = require('bluebird');
    const Docker = require('dockerode');
    const debug = require('debug')('docker-dev');
    const spawn = rekwire('spawn');

    let docker = new Docker({
        'Promise': Promise,
        'socketPath': '/var/run/docker.sock'
    });

    docker = Promise.promisifyAll(docker);

    docker.exportFromImage = (img, imgExports) => {

        debug(`Exporting data from image`, {
            'img': img,
            'imgExports': imgExports
        });

        return docker.createContainerAsync({
            'Image': img
        })
            .then((container) => {
                return Promise.resolve(imgExports)
                    .each((src) => {
                        return spawn('docker', [
                                'cp',
                                '-L',
                                `${container.id}:${src.src}`,
                                src.dest
                            ], {
                            });
                    })
                    .then(() => {
                        return container.remove();
                    });
            });

    };

    docker.getProjectContainers = () => {
        return Promise.resolve()
            .then(() => {
                return docker.listContainersAsync({
                    'all': true
                });
            })
            .filter((container) => {
                return container.Labels['com.docker.compose.project'] === config.get('projectName');
            })
            .map((containerInfo) => {
                return Promise.promisifyAll(docker.getContainer(containerInfo.Id));
            });
    };

    return docker;

};

exports['@singleton'] = true;
exports['@require'] = ['rekwire', 'config'];
