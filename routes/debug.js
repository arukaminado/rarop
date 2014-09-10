var fs = require('fs');
var express = require('express');
var spawn = require('child_process').spawn;
var router = express.Router();
var globals = require('../lib/globals');



function dbgFileGdb(chain) {
    var type;
    var content;
    var width =  globals.info.bin.bits/8;

    console.log("bits arch is: " + globals.info);

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
    
    console.log("Chain: " + JSON.stringify(chain));
    console.log("Len: " + chain.length);

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


    fs.writeFileSync('/tmp/cmds-test.gdb', content);

    return 0;
}

router.post('/', function(req, res) {

    var fields = ['chain', 'debugger', 'term' ];

    /* Check for parameter sanity */
    for (var x=0; x++; x<fields.length) {
        if ( (typeof req.body[fields[x]] === 'undefined') || (req.body[fields[x]] === "") ) {
            res.send({result: "error"});
            return;
        }
    }

    var term = req.body.term;
    var dbg = req.body.debugger;

    dbgFileGdb(req.body.chain);
    spawn(term, ['-T', 'raROP-debug', '-e', 'gdb', globals.binary, '-x', '/tmp/cmds-test.gdb']);
    res.send({result: "ok"});
});


module.exports = router;
