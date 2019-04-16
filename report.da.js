/*global angular, firebase*/
(function() {
    'use strict';
    angular
        .module('artips.admin.core')
        .factory ('ReportDA', reportDA);

    reportDA.$inject = ['$firebaseObject', 'CONF', 'FirebaseSvc'];
    function reportDA($firebaseObject, CONF, FirebaseSvc){

        var _firebaseRef = 'reports';

        var factory = {
            getImportUserFirebase: getImportUserFirebase
        };
        return factory;

        // ------------------------------
        /**
         * Liste tous les free gift disponibles
         */
        function getImportUserFirebase(id) {
            return $firebaseObject(FirebaseSvc.getFirebaseBase().child(_firebaseRef).child('import').child('user').child(id)).$loaded();
        }
    }
})();