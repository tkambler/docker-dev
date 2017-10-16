'use strict';

const path = require('path');
const findUp = require('find-up');
const fs = require('fs');

function validateDirectory(dir) {

    const devFile = path.resolve(dir, 'docker-dev.yml');
    const composerFile = path.resolve(dir, 'docker-compose.yml');

    let devStats;
    let composerStats;

    try {
        devStats = fs.statSync(devFile);
        composerStats = fs.statSync(composerFile);
    } catch(e) {
        return false;
    }

    return devStats.isFile() && composerStats.isFile();

}

module.exports = (project) => {

    if (project) {
        if (!path.isAbsolute(project)) {
            project = path.resolve(process.cwd(), project);
        }
        let stats;
        try {
            stats = fs.statSync(project);
        } catch(e) {
            return;
        }
        if (!stats.isDirectory()) {
            return;
        }
        if (validateDirectory(project)) {
            return project;
        }
    } else {
        const devFile = findUp.sync('docker-dev.yml');
        const composerFile = findUp.sync('docker-compose.yml');
        if (devFile && composerFile && path.dirname(devFile) === path.dirname(composerFile)) {
            return path.dirname(devFile);
        }
    }

};
