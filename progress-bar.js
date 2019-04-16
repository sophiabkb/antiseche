(function() {
    'use strict';

    var artProgressBar = {
        controller: 'ProgressBarCtrl as vm',
        templateUrl: 'app/core/component/progress-bar.html',
        bindings: {
            value: '<',
            append: '@'
        }
    };

    progressBarCtrl.$inject = [];

    /**
     * @description Controlleur de la progress bar
     *
     * @returns {void} rien
     */
    function progressBarCtrl() {
        var vm = this;

        vm.$onInit = onInit;

        /**
         * Initialisation
         *
         * @returns {void} rien
         */
        function onInit() {
            vm.value = parseInt(vm.value, 10);
            vm.style = {width: vm.value + '%'};
        }
    }

    angular
        .module('artips.admin.core')
        .controller('ProgressBarCtrl', progressBarCtrl)
        .component('artProgressBar', artProgressBar);

})();
