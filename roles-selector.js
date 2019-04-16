(function() {
    'use strict';

    var artRolesSelector = {
        controller: 'RolesSelectorCtrl as vm',
        templateUrl: 'app/users/component/roles-selector.html',
        bindings: {
            type: '<',
            ngModel: '=',
            ngRequired: '<',
            ngDisabled: '<'
        }
    };

    rolesSelectorCtrl.$inject = ['lodash', 'ConfigSvc'];

    /**
     * @description Controlleur du composant de gestion des rôles
     *
     * @param {object} lodash - Utilitaire
     * @param {object} ConfigSvc - Service de gestion de la config
     *
     * @returns {void} rien
     */
    function rolesSelectorCtrl(lodash, ConfigSvc) {
        var vm = this;

        vm.$onInit = onInit;

        /**
         * Initialisation
         *
         * @returns {void} rien
         */
        function onInit() {
            vm.roles = lodash.get(ConfigSvc.getConfig(), 'admin.' + vm.type + 'Roles');
            vm.roles = vm.roles.map(function (r) { return angular.lowercase(r);});
        }
    }

    angular
        .module('artips.admin.users')
        .controller('RolesSelectorCtrl', rolesSelectorCtrl)
        .component('artRolesSelector', artRolesSelector);

})();
