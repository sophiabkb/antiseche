(function () {
    'use strict';

    module.exports = function CsvContentError(message, extra) {
        Error.captureStackTrace(this, this.constructor);
        this.message = message;
        this.extra = extra || null;
    };

    require('util').inherits(module.exports, Error);
})();