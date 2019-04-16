(function() {
    'use strict';

    angular
        .module('artips.admin.analytic')
        .config(routesConf);

    routesConf.$inject = ['$stateProvider', 'CONF'];
    function routesConf($stateProvider, CONF) {

        $stateProvider
            .state('admin.header.analytic', {
                abstract: true,
                url: '/analytic',
                template: '<ui-view style="height: 100%"/>',
                data: {
                    authenticated: true,
                    requiredRole: [CONF.roles.supervisor, CONF.roles.admin]
                },
                resolve: {loadPart: loadPart}
            })
            .state('admin.header.analytic.global', {
                url: '',
                templateUrl: 'app/analytic/analytic-global.html',
                controller: 'AnalyticGlobalCtrl',
                controllerAs: 'vm',
                resolve: {
                    groupList: getGroupList/*,
                    countUser: getCountUser*/
                }
            });

        getGroupList.$inject = ['AnalyticSvc'];
        function getGroupList(AnalyticSvc) {
            return AnalyticSvc.getAllGroup();
        }

        // getCountUser.$inject = ['AnalyticSvc'];
        // function getCountUser(AnalyticSvc) {
        //     return AnalyticSvc.getUserCount();
        // }

        loadPart.$inject = ['LangSvc'];
        function loadPart(LangSvc) {
            return LangSvc.loadPartial('assets/translate/analytic/');
        }
    }

})();