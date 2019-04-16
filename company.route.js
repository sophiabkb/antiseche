(function() {
    'use strict';

    angular
        .module('artips.admin.company')
        .config(routesConf);

    routesConf.$inject = ['$stateProvider', 'CONF'];
    function routesConf($stateProvider, CONF) {

        $stateProvider
            .state('admin.header.company', {
                abstract: true,
                url: '/company',
                template: '<ui-view style="height: 100%"/>',
                data: {
                    authenticated: true,
                    requiredRole: [CONF.roles.admin]
                }
            })
            .state('admin.header.company.list', {
                url: '',
                templateUrl: 'app/company/company-list.html',
                controller: 'CompanyListCtrl',
                controllerAs: 'vm'
            });
    }

})();