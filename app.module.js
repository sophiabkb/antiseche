(function() {
    'use strict';

    angular
        .module('artips.admin', [
            // Technical modules
            'artips.admin.core',
            // Functional modules
            'artips.admin.login',
            'artips.admin.company',
            'artips.admin.analytic',
            'artips.admin.users'
            // 'artips.admin.tools_old'
        ]);
})();