(function() {
    'use strict';
    angular
        .module('artips.admin.core')
        .factory('UserAdminDA', userAdminDA);

    userAdminDA.$inject = ['$http', 'lodash', 'CONF'];
    function userAdminDA($http, lodash, CONF) {

        var DEFAULT_PAGE = 20;
        var _baseApi = 'users/';

        var factory = {
            createUserAPI: createUserAPI,
            deleteUserAPI: deleteUserAPI,
            disableUserAPI: disableUserAPI,
            getRolesAPI: getRolesAPI,
            addModuleToUserAPI: addModuleToUserAPI,
            searchUsersAPI: searchUsersAPI,
            getUserByIdAPI: getUserByIdAPI
        };
        return factory;


        /**
         * Création de l'utilisateur côté serveur
         * @param user information de l'utilisateur {uid, email, firstname, lastname, lang}
         * @param modules liste des modules à ajouter
         */
        function createUserAPI(user, modules) {
            return $http.post(CONF.api.baseUrl + _baseApi, {user: user, modules: modules}).then(function(response) {
                return response.data;
            });
        }

        /**
         * Suppression d'un utilisateur
         * @param email email de l'utilisateur à supprimer
         */
        function deleteUserAPI(email) {
            return $http.delete(CONF.api.baseUrl + _baseApi + email).then(function(response) {
                return response.data;
            });
        }

        /**
         * Permet de désactiver un utilisateur
         * @param uid
         * @param disabled
         */
        function disableUserAPI(uid, disabled) {
            return $http.post(CONF.api.baseUrl + _baseApi + uid + '/disable', {disabled: disabled});
        }

        /**
         * @description Récupère la liste des rôles d'un utilisateur
         *
         * @param {string} uid - identifiant de l'utilisateur
         *
         * @return {Promise.<string[]>} La liste des rôles sous forme d'un tableau dans une promise
         */
        function getRolesAPI(uid) {
            return $http.get(CONF.api.baseUrl + _baseApi + uid + '/roles').then(function(response) {
                return response.data;
            });
        }

        /**
         * Ajout d'un module à un utilisateur
         * @param data
         */
        function addModuleToUserAPI(data) {
            data.modules = lodash.map(data.modules, 'text');
            return $http.post(CONF.api.baseUrl + _baseApi + data.email + '/modules', {modules: data.modules, unlimited: data.unlimited}).then(function(response) {
                return response.data;
            });
        }

        /**
         * Recherche d'une liste d'utilisateur
         * @param pageSize
         * @param lastId
         * @param email
         */
        function searchUsersAPI(pageSize, lastId, email) {
            var query = CONF.api.baseUrl + _baseApi + '?pageSize=' + (pageSize || DEFAULT_PAGE);
            if(lastId) {
                query += '&lastId=' + lastId;
            }
            if(email) {
                query += '&filterEmail=' + email;
            }
            return $http.get(query).then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère un utilisateur en entier en fonctyion de son identifiant
         * @param uid
         */
        function getUserByIdAPI(uid) {
            return $http.get(CONF.api.baseUrl + _baseApi + uid).then(function(response) {
                return response.data;
            });
        }
    }
})();