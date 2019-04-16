(function() {
    'use strict';

    angular
        .module('artips.admin.core')
        .controller('AdminCtrl', adminCtrl);

    adminCtrl.$inject = ['$anchorScroll', '$location', 'ADMIN'];

    /**
     * @description Controlleur globale de l'admin
     *
     * @param {object} $anchorScroll - Service de gestion des "ancres"
     * @param {object} $location - Wrapper pour location
     * @param {object} ADMIN - Configuration de l'admin
     *
     * @returns {void} rien
     */
    function adminCtrl($anchorScroll, $location, ADMIN) {

        var adminVm = this; // eslint-disable-line angular/controller-as-vm, consistent-this

        // BINDED DATA


        // BINDED FUNCTION
        adminVm.gridHeight = gridHeight;
        adminVm.goToAnchor = goToAnchor;


        /**
         * @description Permet de connaitre la hauteur d'une grille ui-grid
         *
         * @param {object} grid - La représentation sous forme d'objet de la grille
         *
         * @returns {{height: string}} La hauteur en pixel
         */
        function gridHeight(grid) {
            var headerHeight = 33; // your header height
            return {height: ((grid.data.length * ADMIN.grid.rowHeight) + headerHeight) + 'px'};
        }

        /**
         * @description Permet de scroller à une "ancre" html
         *
         * @param {string} anchor - nom de l'ancre
         *
         * @returns {void} rien
         */
        function goToAnchor(anchor) {
            // set the location.hash to the id of
            // the element you wish to scroll to.
            $location.hash(anchor);
            $anchorScroll();
        }

    }
})();

