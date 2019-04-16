/*global angular, firebase*/
(function() {
    'use strict';
    angular
        .module('artips.admin.core')
        .factory ('GroupDA', groupDA);

    groupDA.$inject = ['$http', 'CONF'];
    function groupDA($http, CONF){

        var _baseApi = 'groups/';

        var factory = {
            getAllAPI: getAllAPI
        };
        return factory;


        /**
         * Récupération de tous les groups
         */
        function getAllAPI() {
            return $http.get(CONF.api.baseUrl + _baseApi).then(function(response) {
                return response.data;
            });
        }
    }
})();