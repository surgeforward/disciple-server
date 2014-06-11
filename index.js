var program = require('commander');
var disciple = require('./lib/server.js')();

program
    .version('0.0.1')
    .usage('[options] <file ...>')
    .option('-p, --port [port]', 'Set port to connect on for client or admin. Listening port for server.')
    .option('-m, --adminport [port]', 'Set port to connect on for client or admin. Listening port for server.')
    .parse(process.argv);

if (program.port) {

    process.nextTick(function () {
        disciple.init(program.port);
    });
    
    if (program.adminport) {
        process.nextTick(function () {
    	   disciple.admin(program.adminport);
        });
    }
    
    return;
}

program.help();