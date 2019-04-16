(function () {
    'use strict';

    // --------------------------------------------------
    // Configuration de l'authentification
    // --------------------------------------------------
    angular
        .module('artips.admin.core')
        .config(authConfig);

    authConfig.$inject = ['AuthSvcProvider'];
    function authConfig (AuthSvcProvider) {
        AuthSvcProvider.setLoginState('admin.login.connection');
    }

    // ------------------
    // Configuration Chart.js
    // ------------------
    angular
        .module('artips.admin.core')
        .config(chartJs);

    chartJs.$inject = ['ChartJsProvider'];

    function chartJs(ChartJsProvider) {
        ChartJsProvider.setOptions({
            //chartColors: [],
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 2500
            }
        });
    }

    // WORKAROUND pour l'erreur "possibly unhandled rejection"
    angular
        .module('artips.admin.core')
        .config(unhandledRejection);

    unhandledRejection.$inject = ['$qProvider'];
    function unhandledRejection($qProvider) {
        $qProvider.errorOnUnhandledRejections(false);
    }


    // ------------------
    // Configuration Material design
    // ------------------
    angular
        .module('artips.admin.core')
        .config(material);

    material.$inject = ['$mdThemingProvider'];
    function material($mdThemingProvider) {
        var green = $mdThemingProvider.extendPalette('green', {
            '500': '#02C385',
            '600': '#01B572',
            'contrastDefaultColor': 'dark',
            'contrastLightColors': [
                '500',
                '600'
            ]
        });
        var orange = $mdThemingProvider.extendPalette('orange', {
            'A200': '#FFBE76',
            'A700': '#FFAF63',
            'contrastDefaultColor': 'dark',
            'contrastLightColors': [
                'A200',
                'A700'
            ]
        });
        var red = $mdThemingProvider.extendPalette('red', {
            '50': 'ffeded',
            '100': 'ffd3d3',
            '200': 'ffb6b6',
            '300': 'ff9898',
            '400': 'ff8282',
            '500': 'ff6c6c',
            '600': 'ff6464',
            '700': 'ff5959',
            '800': 'ff4f4f',
            '900': 'ff3d3d',
            'A100': 'ffffff',
            'A200': 'ffffff',
            'A400': 'ffe5e5',
            'A700': 'ff6c6c',
            'contrastDefaultColor': 'light'
        });

        $mdThemingProvider.definePalette('artipsGreen', green);
        $mdThemingProvider.definePalette('artipsOrange', orange);
        $mdThemingProvider.definePalette('artipsRed', red);
        $mdThemingProvider.theme('default')
            .primaryPalette('artipsGreen')
            .accentPalette('artipsOrange')
            .warnPalette('artipsRed');
    }

    // ------------------
    // Configuration ChartJS
    // ------------------
    angular
        .module('artips.admin.core')
        .config(chartJsConfig);

    chartJsConfig.$inject = ['ChartJsProvider'];
    function chartJsConfig(ChartJsProvider) {
        ChartJsProvider.setOptions({
            chartColors: [
                '#FFE176',
                '#02C385',
                '#F09767',
                '#587BF7',
                '#FF6C6C',
                '#78BEFF',
                '#FFB1B1',
                '#AD90FF',
                '#F875C5'],
            responsive: true,
            legend: {
                display: true,
                position: 'bottom'
            }
        });

        // Configure all pie charts
        // ChartJsProvider.setOptions('pie', {
        //     legend: {
        //         display: true,
        //         position: 'bottom'
        //     }
        // });

        // Ne fonctionne pas
       /* ChartJsProvider.setOptions('doughnut', {
            chartOptions: {
                cutoutPercentage: 70
            }
        });*/

    }

})();