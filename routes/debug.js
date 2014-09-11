var fs = require('fs');
var express = require('express');
var spawn = require('child_process').spawn;
var router = express.Router();
var globals = require('../lib/globals');


var cmdfile = "/tmp/rarop.cmd";
var title = "raROP debug";


function dbgFileGdb(chain) {

    var type;
    var content;
    var width =  globals.info.bin.bits/8;

    switch (globals.info.bin.bits) {
        case 32:
            type = "int";
            break;
        case 64:
            type = "double";
            break;
        default:
            return 1;
            break;
    }

    /* Set breakpoint at entry  & run*/
    content = 'break *0x' + globals.entry.toString(16) + '\n';
    content += 'r\n';

    /* Prepare the stack */
    for (var x=0; x<chain.length; x++) {
        var offset = (x*width).toString(16);

        content += 'set *(' + type + ' *)($sp+' + offset + ') = ' +
            '(' + type + ' *)0x' + chain[x].hexoffset + '\n';
    }

    /* Set IP to some ret & continue */
    content += 'set $pc = 0x' + globals.retaddr.toString(16) + '\n';

    /* Remove breakpoints */
    content += 'del\n';

    /* Print ready message */
    content += 'echo \\n\\nYour rop chain is ready. use "ni" to debug it\\n\\n\n';


    fs.writeFileSync(cmdfile, content);

    return 0;
}


function dbgFileR2(chain) {

    var content = "";
    var width =  globals.info.bin.bits/8;


    /* Prepare the stack */
    for (var x=0; x<chain.length; x++) {
        var offset = (x*width).toString(16);
        content += 'wv 0x' + chain[x].hexoffset + ' @ `dr?sp`+0x' + offset + '\n';
    }

    /* Set IP to some ret & continue */
    content += 'dr pc=0x' + globals.retaddr.toString(16) + '\n';

    /* Create step macro */
    content += '(step, ds, pd 1 @ `dr?pc`)\n';
    content += '$step=.(step)\n';

    /* Display message */
    content += 'echo ------------------------------------------------------------\n';
    content += 'echo - Your rop chain is ready. use "ds" or "$step" to debug it -\n';
    content += 'echo ------------------------------------------------------------\n';


    fs.writeFileSync(cmdfile, content);

    return 0;
}



router.post('/', function(req, res) {

    var fields = ['chain', 'debugger', 'term' ];
    var result = 1;
    var args = [];


    /* Check for parameter sanity */
    for (var x=0; x++; x<fields.length) {
        if ( (typeof req.body[fields[x]] === 'undefined') || (req.body[fields[x]] === "") ) {
            res.send({result: "error"});
            return;
        }
    }

    var term = req.body.term;
    var dbg = req.body.debugger;


    switch (dbg) {
        case 'gdb':
            result = dbgFileGdb(req.body.chain);
            args = ['gdb', globals.binary, '-x', cmdfile];
            break;
        case 'r2':
            result = dbgFileR2(req.body.chain);
            args = ['r2', '-i', cmdfile, '-d', globals.binary];
            break;
    }


    if (result) {
        res.send({result: "error"});
        return;
    }


    /* Launch the debugger in a terminal */
    if (process.platform === 'darwin')
        args.unshift('sudo');

    args.unshift('-e');
    args.unshift(title);
    args.unshift('-T');
    spawn(term, args);


    res.send({result: "ok"});

});


module.exports = router;
