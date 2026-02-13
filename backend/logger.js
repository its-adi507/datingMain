const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '..', 'debug.log');

const log = (msg) => {
    return
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    } catch (e) { }
    console.log(msg);
};

module.exports = { log };