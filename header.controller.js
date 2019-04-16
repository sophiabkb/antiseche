(function() {
    'use strict';

    angular
        .module('artips.admin.core')
        .controller('HeaderCtrl', headerCtrl);

    headerCtrl.$inject = ['$state', 'CONF', 'SessionSvc', 'AuthSvc'];

    /**
     * @description Controller du header
     *
     * @param {object} $state - Gestion des "state" ui-router
     * @param {object} CONF - Configuration commune à toutes les plateformes
     * @param {object} SessionSvc - Gestion de la session de l'utilisateur
     * @param {object} AuthSvc - Service d'authentification
     *
     * @returns {void} rien
     */
    function headerCtrl($state, CONF, SessionSvc, AuthSvc) {

        var headerVm = this; // eslint-disable-line angular/controller-as-vm

        // BINDED DATA
        headerVm.subBase = SessionSvc.getSubBase();
        // Permet d'afficher/autoriser la modification selon le(s) rôle(s) des utilisateurs
        headerVm.allow = {
            deleteUser: AuthSvc.isAuthorizedForRole(CONF.roles.admin),
            batchUser: AuthSvc.isAuthorizedForRole(CONF.roles.admin),
            company: AuthSvc.isAuthorizedForRole(CONF.roles.admin)
        };

        // BINDED FUNCTION
        headerVm.logout = logout;
        headerVm.stateIncluded = stateIncluded;

        /**
         * @description Déconnexion de l'utilisateur
         *
         * @returns {void} rien
         */
        function logout() {
            AuthSvc.logout();
        }

        /**
         * @description Regarde si un "state" (ui-router) est un déscendant du state actuel
         *
         * @param {string} state - l'état à tester
         *
         * @returns {void} rien
         */
        function stateIncluded(state) {
            return $state.includes(state);
        }
    }
})();

