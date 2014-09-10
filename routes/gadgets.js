var express = require('express');
var router = express.Router();
var globals = require('../lib/globals');

/* Print gadgets and binary info. */
router.get('/', function(req, res) {
    res.send(globals);
});

module.exports = router;
