var express = require('express');
var router = express.Router();

/* GET processes listing. */
router.get('/processes', function (req, res, next) {
    res.json([
        { id: 123, name: 'ᚠ', details: 'd.d.d.d', state: 'stopped' },
        { id: null, name: 'ᚻ', details: 'b.d.x.d', state: 'running' }
    ]);
});

module.exports = router;
