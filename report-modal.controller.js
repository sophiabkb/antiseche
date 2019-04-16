/*global angular*/
(function() {
    'use strict';

    angular
        .module('artips.admin.core')
        .controller ('ReportModalCtrl', reportModalCtrl);

    reportModalCtrl.$inject = ['$mdDialog', 'title', 'reportId', 'report'];
    function reportModalCtrl($mdDialog, title, reportId, report){
        var vm = this;

        // BINDING DATA
        vm.title = title;
        vm.reportId = reportId;
        vm.report = report;

        // BINDING FUNCTION
        vm.cancel = cancel;

        // Implémentation

        function cancel() {
            $mdDialog.hide();
        }
    }

})();