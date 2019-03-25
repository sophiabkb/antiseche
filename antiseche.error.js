(function () {
    'use strict';

    module.exports = function AntisecheError(settings) {
        Error.captureStackTrace(this, this.constructor);
        this.message = settings.message;
        this.code = settings.code;
        this.extra = settings.extra;
    };

    require('util').inherits(module.exports, Error);
})();