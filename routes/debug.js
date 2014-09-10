var express = require('express');
var globals = require('../lib/globals');
var spawn = require('child_process').spawn;
var router = express.Router();

/* Start a debugging session. */
router.get('/', function(req, res) {
    spawn('urxvt', ['-T', 'raROP-debug', '-e', 'gdb', '/tmp/test-rop', '-x', '/tmp/cmds.gdb']);
    res.send("");
});

module.exports = router;
