(function() {
    'use strict';

    angular
        .module('artips.admin.users')
        .config(routesConf);

    routesConf.$inject = ['$stateProvider', 'CONF'];
    function routesConf($stateProvider, CONF) {

        $stateProvider
            .state('admin.header.users', {
                abstract: true,
                url: '/users',
                template: '<ui-view style="height: 100%"/>',
                data: {
                    authenticated: true,
                    requiredRole: [CONF.roles.supervisor, CONF.roles.admin]
                },
                resolve: {loadPart: loadPart}
            })
            .state('admin.header.users.list', {
                url: '',
                templateUrl: 'app/users/users.html',
                controller: 'UsersCtrl',
                controllerAs: 'vm'
            })
            .state('admin.header.users.consult', {
                url: '/:uid',
                templateUrl: 'app/users/consult-user.html',
                controller: 'ConsultUserCtrl',
                controllerAs: 'vm',
                resolve: {
                    user: getUser,
                    roles: getRoles,
                    modAnalytics: getUserModulesAnalytics
                }
            });

        getUser.$inject = ['$stateParams', 'UserAdminDA'];
        function getUser($stateParams, UserAdminDA) {
            return UserAdminDA.getUserByIdAPI($stateParams.uid);
        }

        getUserModulesAnalytics.$inject = ['$stateParams', 'AnalyticSvc'];
        function getUserModulesAnalytics($stateParams, AnalyticSvc) {
            return AnalyticSvc.getUserAnalytics($stateParams.uid, 'modules');
        }

        getRoles.$inject = ['$stateParams', 'UserSvc'];
        function getRoles($stateParams, UserSvc) {
            return UserSvc.getRoles($stateParams.uid);
        }

        loadPart.$inject = ['LangSvc'];
        function loadPart(LangSvc) {
            return LangSvc.loadPartial('assets/translate/user/');
        }
    }

})();