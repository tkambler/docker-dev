'use strict';

const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

module.exports = (projectFolder) => {

    const devFile = path.resolve(projectFolder, 'docker-dev.yml');
    const composerFile = path.resolve(projectFolder, 'docker-compose.yml');
    const devContents = fs.readFileSync(devFile, 'utf8');
    const composerContents = fs.readFileSync(composerFile, 'utf8');

    let devDoc;
    let composerDoc;

    try {
        devDoc = yaml.safeLoad(devContents);
    } catch(e) {
        throw new Error(`Error parsing: ${devFile}`);
    }

    try {
        composerDoc = yaml.safeLoad(composerContents);
    } catch(e) {
        throw new Error(`Error parsing: ${composerFile}`);
    }

    const res = {
        'dev': devDoc,
        'composer': composerDoc
    };

     // Ensure that sane defaults are set here.

     _.defaultsDeep(res, {
        'dev': {
            'repositories': [],
            'services': {},
            'hostnames': [],
            'open': []
        },
        'composer': {
            'services': {}
        }
     });

     let onlyCount = 0;

     Object.keys(res.dev.services).forEach((service) => {
        res.dev.services[service] = res.dev.services[service] || {};
        _.defaults(res.dev.services[service], {
            'ignore': false,
            'only': false,
            'require_healthcheck': false
        });
        if (res.dev.services[service].only) {
            onlyCount++;
        }
        if (res.dev.services[service].ignore) {
            delete res.dev.services[service];
        }
     });

     if (onlyCount > 0) {
         Object.keys(res.dev.services).forEach((service) => {
            if (!res.dev.services[service].only) {
                delete res.dev.services[service];
            }
         });
     }

//      console.log(JSON.stringify(res.dev.services, null, 4));
//      process.exit();

     _.each(res.dev.services, (service) => {
        _.defaultsDeep(service, {
            'service-scripts': {
                'post-up': []
            },
            'host-scripts': {
                'pre-up': [],
                'post-up': []
            }
        });
     });

    return res;

};
