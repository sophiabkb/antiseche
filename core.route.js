(function() {
    'use strict';

    angular
        .module('artips.admin.core')
        .config(routesConf);

    routesConf.$inject = ['$stateProvider', '$urlRouterProvider', '$locationProvider', 'ENV', 'CONF'];
    function routesConf($stateProvider, $urlRouterProvider, $locationProvider, ENV, CONF) {

        $locationProvider.html5Mode(ENV.html5Mode).hashPrefix('');

        // Route par défaut
        $urlRouterProvider.when('/', ['$injector', function ($injector) {
            $injector.get('$state').go('admin.header.users.list');
        }]);
        $urlRouterProvider.when('', ['$injector', function ($injector) {
            $injector.get('$state').go('admin.header.users.list');
        }]);

        // Page 404 par défaut
        $urlRouterProvider.otherwise('/404');

        $stateProvider
            .state('admin', {
                abstract: true,
                template: '<ui-view style="height: 100%"/>',
                resolve: {loadPart: loadPart}
            })
            .state('admin.404', {
                url: '/404',
                templateUrl: 'app/core/404.html',
                data: {
                    authenticated: false,
                    requiredRole: null,
                    noInitialization: true
                }
            })
            .state('admin.header', {
                templateUrl: 'app/core/layout/header.html',
                controller: 'HeaderCtrl',
                controllerAs: 'headerVm',
                data: {
                    authenticated: true,
                    requiredRole: [CONF.roles.supervisor, CONF.roles.admin]
                }
            });


        loadPart.$inject = ['LangSvc'];
        function loadPart(LangSvc) {
            return LangSvc.loadPartial('assets/translate/core/');
        }
    }

})();