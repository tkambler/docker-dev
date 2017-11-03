'use strict';

exports = module.exports = function(yml, projectFolder, projectName, logFile) {

    const Promise = require('bluebird');
    const path = require('path');
    const confit = Promise.promisifyAll(require('confit')());
    return confit.createAsync()
        .tap((config) => {

            yml.dev.repositories = yml.dev.repositories.map((repo) => {
                repo.dest = path.isAbsolute(repo.dest) ? repo.dest : path.resolve(projectFolder, repo.dest);
                return repo;
            });

            config.use(yml);
            config.set('projectFolder', projectFolder);
            config.set('projectName', projectName);
            config.set('logFile', logFile);

        });

};

exports['@singleton'] = true;
exports['@require'] = ['yml', 'projectFolder', 'projectName', 'logFile'];
