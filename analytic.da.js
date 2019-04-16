(function() {
    'use strict';
    angular
        .module('artips.admin.core')
        .factory('AnalyticDA', analyticDA);

    analyticDA.$inject = ['$http', 'CONF'];
    function analyticDA($http, CONF) {

        var _baseApi = 'analytic/';
        var _versionApi = '';

        var factory = {
            getUserAnalyticsAPI: getUserAnalyticsAPI,
            updateUsersAnalyticsAPI: updateUsersAnalyticsAPI,
            getUserCountAPI: getUserCountAPI,
            getUserConnectionAPI: getUserConnectionAPI,
            getUserCourseAPI: getUserCourseAPI,
            getCourseAPI: getCourseAPI,
            getDaysHoursAPI: getDaysHoursAPI,
            getDeviceAPI: getDeviceAPI,
            getCompletionAPI: getCompletionAPI,
            getNoteAPI: getNoteAPI,
            getFeedbackAPI: getFeedbackAPI,
            getModulesAPI: getModulesAPI,
            getSessionsAPI: getSessionsAPI
        };
        return factory;


        /**
         * @description Récupération des analytic liées à un utilisateur
         *
         * @param {string} uid - Identifiant de l'utilisateur
         * @param {"sessions"|"modules"} type - type d'analytics qu'on souhaite récupérer (soit la liste des sessions, soit les infos sur les modules)
         *
         * @return {Promise} une promise qui reject si la requête échoue
         */
        function getUserAnalyticsAPI(uid, type, filter) {
            return $http.get(CONF.api.baseUrl + _versionApi + _baseApi + 'users/' + uid + '/' + type + filter).then(function(response) {
                return response.data;
            });
        }

        /**
         * MAJ des analytic au niveau de l'utilisateur
         *
         * @return {*} - Promise avce les données retournées par le web service
         */
        function updateUsersAnalyticsAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'users/update').then(function(response) {
                return response.data;
            });
        }

        /**
         * Compte le nombre d'utilisateurs
         */
        function getUserCountAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'users/count').then(function(response) {
                return response.data;
            });
        }

        /**
         * Compte le nombre d'utilisateurs
         */
        function getUserConnectionAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'users/connection').then(function(response) {
                return response.data;
            });
        }

        /**
         * Compte le nombre de parcours
         */
        function getUserCourseAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'users/course').then(function(response) {
                return response.data;
            });
        }

        /**
         * Compte le nombre de parcours
         */
        function getCourseAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'course').then(function(response) {
                return response.data;
            });
        }

        /**
         * Compte le nombre de parcours
         */
        function getDaysHoursAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'dayshours').then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère les infos sur les devices utilisées
         */
        function getDeviceAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'device').then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère les infos sur la complétion
         */
        function getCompletionAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'completion').then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère les infos sur les notes obetnues
         */
        function getNoteAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'note').then(function(response) {
                return response.data;
            });
        }

        /**
         * Récupère les infos sur les tries des notions
         */
        function getFeedbackAPI() {
            return $http.post(CONF.api.baseUrl + _baseApi + 'feedback').then(function(response) {
                return response.data;
            });
        }

        function getModulesAPI(group, dateFrom, dateTo, accept) {
            var params = '?fields=lastname,firstname,email,group,course,duration,completion,Q_0,Q_1,Q_2,Q_3,Q_final,feedback_save_percent,feedback_ok_percent,feedback_ko_percent';
            if(group) {
                params += '&qGroup=' + group;
            }
            if(dateFrom) {
                params += '&qdDateFrom=' + dateFrom;
            }
            if(dateTo) {
                params += '&qDateTo=' + dateTo;
            }
            return $http.get(CONF.api.baseUrl + _versionApi + _baseApi + 'modules' + params, {headers: {'Accept': accept || 'application/json'}}).then(function(response) {
                var anchor = angular.element('<a/>');
                anchor.attr({
                    href: 'data:attachment/csv;charset=utf-8,' + encodeURI(response.data),
                    target: '_blank',
                    download: 'modules.csv'
                })[0].click();
                return response.data;
            });
        }

        function getSessionsAPI(group, dateFrom, dateTo, accept) {
            var params = '?fields=firstname,lastname,email,group,startDate,endDate,duration';
            if(group) {
                params += '&qGroup=' + group;
            }
            if(dateFrom) {
                params += '&qdDateFrom=' + dateFrom;
            }
            if(dateTo) {
                params += '&qDateTo=' + dateTo;
            }
            return $http.get(CONF.api.baseUrl + _versionApi + _baseApi + 'sessions' + params, {headers: {'Accept': accept || 'application/json'}}).then(function(response) {
                var anchor = angular.element('<a/>');
                anchor.attr({
                    href: 'data:attachment/csv;charset=utf-8,' + encodeURI(response.data),
                    target: '_blank',
                    download: 'sessions.csv'
                })[0].click();
                return response.data;
            });
        }
    }
})();