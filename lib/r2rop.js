var async = require('async');
var which = require('which').sync;
var crypto = require('crypto');
var fs = require('fs');
var r2pipe = require('r2pipe');

//var r2jsapi = require('./r2');
var globals = require('./globals');


var terminals = ['urxvt', 'rxvt', 'xterm', 'aterm', 'Eterm', 'gnome-terminal'];
var debuggers = ['gdb', 'r2'];
//var debuggers = ['gdb', 'r2', 'idaq', 'idaq64'];

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


function parseGadgets(tmp) {
    var len = globals.info.bin.bits / 8 * 2;
    var gadgets = [];
    var dupes = [];

    /* Split gadgets */
    tmp.forEach(function (gadget) {
        var size = gadget.opcodes[gadget.opcodes.length-1].size;

        /* Skip dupes */
        if (dupes.indexOf(gadget.retaddr) !== -1)
            return;
        dupes.push(gadget.retaddr);

        for (var x = gadget.opcodes.length - 2; x >= 0; x--) {
            size += gadget.opcodes[x].size;
            var newGadget = {
                opcodes: gadget.opcodes.slice(x),
                retaddr: gadget.retaddr,
                size: size
            };
            gadgets.push(newGadget);
        }
    });

    gadgets.forEach(function (gadget) {
        var parsed = {};
        var gadgetLen = gadget.opcodes.length;

        /* Ignore useless gadgets */
        if (gadgetLen <= 1)
            return;

        /* Ignore non ret opcodes */
        if(gadget.opcodes[gadgetLen-1].type.indexOf("ret") === -1)
            return;

        /* get a valid ret opcode for debugging */
        if (globals.retaddr === null) {
            if (gadget.opcodes[gadgetLen-1].opcode === 'ret')
                globals.retaddr = gadget.opcodes[gadgetLen-1].offset;
        }

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

    var gadgets = null;

    checkCmds();
    globals.hash = hashFile(globals.binary);

    /* Indentation party */
    r2pipe.pipe(globals.binary, function (r2) {

        r2.promise(r2.cmdj, '/Rj', function(res) { gadgets = res; })
            .then(r2.cmdj, 'ij', function(res) {globals.info = res; })
            .then(r2.cmdj, 'iej', function(res) { globals.entry = res[0].vaddr; })
            .done(function() {
                parseGadgets(gadgets);
                callback(null);
            });
    });
};
