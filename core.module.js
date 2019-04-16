(function() {
    'use strict';

    angular
        .module('artips.admin.core', [
            'ngAnimate',
            'ngAria',
            'ngCookies',
            'ngMaterial',
            'ngMessages',
            'ngSanitize',
            'angularjs-gauge',
            'chart.js',
            'firebase',
            'ngFileUpload',
            'ngLodash',
            'pascalprecht.translate',
            'tmh.dynamicLocale',
            'ui.grid',
            'ui.grid.infiniteScroll',
            'ui.grid.pagination',
            'ui.grid.resizeColumns',
            'ui.router',
            'artips.common.core',
            'artips.common.da'
        ]);
})();