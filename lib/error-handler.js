'use strict';

const chalk = require('chalk');

module.exports = (err) => {
    console.log(chalk.red(`Error: ${err.message}`));
    process.exit(1);
};
