/*global angular, firebase*/
(function() {
    'use strict';
    angular
        .module('artips.admin.core')
        .factory ('PaymentDA', paymentDA);

    paymentDA.$inject = ['$http', 'CONF'];
    function paymentDA($http, CONF){

        var _baseApi = 'payments/';

        var factory = {
            getFreeGiftListAPI: getFreeGiftListAPI,
            getUsedFreeGiftAPI: getUsedFreeGiftAPI,
            getAllOrdersAPI: getAllOrdersAPI
        };
        return factory;

        // ------------------------------
        /**
         * Liste tous les free gift disponibles
         */
        function getFreeGiftListAPI() {
            return $http.get(CONF.api.baseUrl + _baseApi + 'free-gift').then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère tous les utilisateurs qui ont utilisé un free gift
         * @param freeGift
         */
        function getUsedFreeGiftAPI(freeGift) {
            return $http.get(CONF.api.baseUrl + _baseApi + 'used-gift/' + freeGift).then(function(response) {
                return response.data;
            });
        }
        /**
         * Récupération de toutes les commandes
         */
        function getAllOrdersAPI() {
            return $http.get(CONF.api.baseUrl + _baseApi + 'orders').then(function(response) {
                return response.data;
            });
        }
    }
})();