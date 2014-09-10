var async = require('async');
var which = require('which').sync;
var crypto = require('crypto');
var fs = require('fs');

//var r2jsapi = require('./r2');
var r2pipe = require('./r2pipe');
var globals = require('./globals');


var terminals = ['urxvt', 'rxvt', 'xterm', 'aterm', 'Eterm', 'gnome-terminal'];
var debuggers = ['gdb', 'r2', 'idaq', 'idaq64'];

var r2;



function hashFile(file) {
    var md5sum = crypto.createHash('md5');
    var data = fs.readFileSync(file);
    md5sum.update(data);

    return md5sum.digest('hex');
}


function pad(num, size){
    var s = "0000000000000000000" + num;
    return s.substr(s.length-size);
}


function checkCmds() {
    terminals.forEach(function (term) {
        try {
            which(term);
            globals.terminals.push(term);
        } catch (e) {}
    });

    debuggers.forEach(function (dbg) {
        try {
            which(dbg);
            globals.debuggers.push(dbg);
        } catch (e) {}
    });
}


function getGadget(g, callback) {
    var len = globals.info.bin.bits / 8 * 2;
    var cmd = 'pDj ' + g.size + " @ " + g.addr;

    r2.cmd(cmd, function (res) {
        try {
            var gadget = JSON.parse(res);
        } catch (e) {
            callback(true, e);
            return;
        }

        /* Ignore gadgets useless gadgets */
        if (gadget.length <= 1) {
            callback(null);
            return;
        }

        /* Set search depth to 5 opcodes per gadget
        if (gadget.length > 5) {
            callback(null);
            return;
        } */

        /* Remove gadgets with invalid disassemble
        for (var x=0; x<gadget.length; x++) {
            if (gadget[x].type === 'invalid') {
                callback(null);
                return;
            }
        } */

        /* Remove invalid ones
        if (gadget[gadget.length-1].type.indexOf("ret") === -1) {
            callback(null);
            return;
        }*/


        var parsed = {};
        parsed.offset = gadget[0].offset;
        parsed.hexoffset = pad(gadget[0].offset.toString(16), len);
        parsed.opcodes = "";
        gadget.forEach(function (opcode) {
            parsed.opcodes += opcode.opcode + "; ";
        });
        globals.gadgets.push(parsed);
        callback(null);
    });
}

function resolvGadgets(gadgets) {
    var len = globals.info.bin.bits / 8 * 2;

    gadgets.forEach(function (gadget) {
        var parsed = {};
        var gadgetLen = gadget.opcodes.length;

        /* Ignore gadgets useless gadgets */
        if (gadgetLen <= 1)
            return;

        /* Ignore non ret opcodes */
        if(gadget.opcodes[gadgetLen-1].type.indexOf("ret") === -1)
            return;

        parsed.offset = gadget.opcodes[0].offset;
        parsed.hexoffset = pad(gadget.opcodes[0].offset.toString(16), len);
        parsed.opcodes = "";
        gadget.opcodes.forEach(function (opcode) {
            parsed.opcodes += opcode.opcode + "; ";
        });

        globals.gadgets.push(parsed);
    });
}


module.exports.init = function (callback) {

    checkCmds();
    globals.hash = hashFile(globals.binary);
    r2pipe.pipe(globals.binary, function (r2) {
        r2.cmd('/Rj', function (res) {
            try {
                r2.cmd('ij', function (info) {
                    globals.info = JSON.parse(info);
                    var gadgets = JSON.parse(res);
                    resolvGadgets(gadgets);
                    callback(null);
                })
            } catch (e) {
                console.log("ERROR:" + e);
                process.exit(1);
            }
        });

    });
};
