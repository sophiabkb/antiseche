(function() {
    'use strict';

    angular
        .module('artips.admin.users')
        .controller('UsersCtrl', usersCtrl);

    usersCtrl.$inject = ['$log', '$scope', '$translate', 'lodash', 'ADMIN', 'ConfigSvc', 'UploadSvc', 'UserSvc', 'ToastSvc', 'ModalSvc'];

    function usersCtrl($log, $scope, $translate, lodash, ADMIN, ConfigSvc, UploadSvc, UserSvc, ToastSvc, ModalSvc) {

        var vm = this;
        var config = ConfigSvc.getConfig();

        var PAGINATION = 20;
        var MAX_SEARCH = 50;
        var _nextLastId = null;

        // DATA
        // Liste des utilisateurs
        vm.loadingData = false;
        vm.users = [];
        vm.platformUrl = lodash.get(config, 'mainParameters.serverUrl');
        vm.gridOptions = {
            enableColumnResizing: true,
            exporterMenuCsv: false,
            enableGridMenu: false,
            enableColumnMenus: false,
            enableSorting: false,
            rowHeight: ADMIN.grid.rowHeight,
            data: 'vm.users',
            columnDefs: [
                {
                    field: 'email',
                    displayName: 'common.field.email',
                    headerCellFilter: 'translate',
                    maxWidth: 300,
                    enableSorting: false,
                    enableCellEdit: false,
                    enableHiding: false,
                    cellTemplate: '<div class="ui-grid-cell-contents">'
                    + '<a ui-sref="admin.header.users.consult({uid: row.entity.uid})">{{row.entity.email}}</a>'
                    + '</div>'
                }, {
                    field: 'name',
                    displayName: 'Name',
                    headerCellFilter: 'translate',
                    maxWidth: 230,
                    enableSorting: false,
                    enableCellEdit: false,
                    enableHiding: false,
                    cellTemplate: '<div class="ui-grid-cell-contents">'
                    + '{{row.entity.name}} <img ng-if="::row.entity.unlimited" style="float:right;" src="assets/img/icon/unlimited-red.svg"/>'
                    + '</div>'
                }, {
                    field: 'lang',
                    displayName: 'common.field.language',
                    headerCellFilter: 'translate',
                    maxWidth: 70,
                    enableSorting: false,
                    enableCellEdit: false,
                    enableHiding: false,
                    cellClass: 'capitalize'
                }, {
                    field: 'group',
                    displayName: 'user.list.grid.header.group',
                    headerCellFilter: 'translate',
                    maxWidth: 120,
                    enableSorting: false,
                    enableCellEdit: false,
                    enableHiding: false
                }, {
                    field: 'modules',
                    displayName: 'user.list.grid.header.course',
                    headerCellFilter: 'translate',
                    enableSorting: false,
                    enableCellEdit: false,
                    enableHiding: false,
                    cellTemplate: '<div class="ui-grid-cell-contents">'
                    + '<span ng-if="!row.entity.modules.noModule" ng-repeat="module in row.entity.modules track by $index" '
                    + 'ng-class="{\'initialized\':module.initialized,\'not-initialized\':!module.initialized}">'
                    + '{{module.name}}<span ng-show="!$last">, </span>'
                    + '</span>'
                    + '<span ng-if="row.entity.modules.noModule" class="no-modules">{{row.entity.modules.noModule}}</span>'
                    + '</div>'
                }
                //     ,
                // { field: 'nbConnections', displayName: 'user.list.grid.header.nb_login',
                //     headerCellTemplate:  "<div role=\"columnheader\" ng-class=\"{ 'sortable': sortable }\" ui-grid-one-bind-aria-labelledby-grid=\"col.uid + '-header-text ' + col.uid + '-sortdir-text'\" aria-sort=\"{{col.sort.direction == asc ? 'ascending' : ( col.sort.direction == desc ? 'descending' : (!col.sort.direction ? 'none' : 'other'))}}\"><div role=\"button\" tabindex=\"0\" class=\"ui-grid-cell-contents ui-grid-header-cell-primary-focus\" col-index=\"renderIndex\" title=\"TOOLTIP\"><span class=\"ui-grid-header-cell-label\" ui-grid-one-bind-id-grid=\"col.uid + '-header-text'\" translate='{{col.displayName}}'></span> <span ui-grid-one-bind-id-grid=\"col.uid + '-sortdir-text'\" ui-grid-visible=\"col.sort.direction\" aria-label=\"{{getSortDirectionAriaLabel()}}\"><i ng-class=\"{ 'ui-grid-icon-up-dir': col.sort.direction == asc, 'ui-grid-icon-down-dir': col.sort.direction == desc, 'ui-grid-icon-blank': !col.sort.direction }\" title=\"{{isSortPriorityVisible() ? i18n.headerCell.priority + ' ' + ( col.sort.priority + 1 )  : null}}\" aria-hidden=\"true\"></i> <sub ui-grid-visible=\"isSortPriorityVisible()\" class=\"ui-grid-sort-priority-number\">{{col.sort.priority + 1}}</sub></span></div><div role=\"button\" tabindex=\"0\" ui-grid-one-bind-id-grid=\"col.uid + '-menu-button'\" class=\"ui-grid-column-menu-button\" ng-if=\"grid.options.enableColumnMenus && !col.isRowHeader  && col.colDef.enableColumnMenu !== false\" ng-click=\"toggleMenu($event)\" ng-class=\"{'ui-grid-column-menu-button-last-col': isLastCol}\" ui-grid-one-bind-aria-label=\"i18n.headerCell.aria.columnMenuButtonLabel\" aria-haspopup=\"true\"><i class=\"ui-grid-icon-angle-down\" aria-hidden=\"true\">&nbsp;</i></div><div ui-grid-filter></div></div>",
                //     maxWidth: 200, enableSorting: false, enableCellEdit: false, enableHiding: false, cellClass: 'align-right'},
                // { field: 'navDuration', displayName: 'user.list.grid.header.duration',
                //     headerCellTemplate:  "<div role=\"columnheader\" ng-class=\"{ 'sortable': sortable }\" ui-grid-one-bind-aria-labelledby-grid=\"col.uid + '-header-text ' + col.uid + '-sortdir-text'\" aria-sort=\"{{col.sort.direction == asc ? 'ascending' : ( col.sort.direction == desc ? 'descending' : (!col.sort.direction ? 'none' : 'other'))}}\"><div role=\"button\" tabindex=\"0\" class=\"ui-grid-cell-contents ui-grid-header-cell-primary-focus\" col-index=\"renderIndex\" title=\"TOOLTIP\"><span class=\"ui-grid-header-cell-label\" ui-grid-one-bind-id-grid=\"col.uid + '-header-text'\" translate='{{col.displayName}}'></span> <span ui-grid-one-bind-id-grid=\"col.uid + '-sortdir-text'\" ui-grid-visible=\"col.sort.direction\" aria-label=\"{{getSortDirectionAriaLabel()}}\"><i ng-class=\"{ 'ui-grid-icon-up-dir': col.sort.direction == asc, 'ui-grid-icon-down-dir': col.sort.direction == desc, 'ui-grid-icon-blank': !col.sort.direction }\" title=\"{{isSortPriorityVisible() ? i18n.headerCell.priority + ' ' + ( col.sort.priority + 1 )  : null}}\" aria-hidden=\"true\"></i> <sub ui-grid-visible=\"isSortPriorityVisible()\" class=\"ui-grid-sort-priority-number\">{{col.sort.priority + 1}}</sub></span></div><div role=\"button\" tabindex=\"0\" ui-grid-one-bind-id-grid=\"col.uid + '-menu-button'\" class=\"ui-grid-column-menu-button\" ng-if=\"grid.options.enableColumnMenus && !col.isRowHeader  && col.colDef.enableColumnMenu !== false\" ng-click=\"toggleMenu($event)\" ng-class=\"{'ui-grid-column-menu-button-last-col': isLastCol}\" ui-grid-one-bind-aria-label=\"i18n.headerCell.aria.columnMenuButtonLabel\" aria-haspopup=\"true\"><i class=\"ui-grid-icon-angle-down\" aria-hidden=\"true\">&nbsp;</i></div><div ui-grid-filter></div></div>",
                //     maxWidth: 200, enableSorting: false, enableCellEdit: false, enableHiding: false, cellClass: 'align-right', cellFilter: 'duration:"d \'jour(s)\' hh:mm:ss"'}
            ],
            onRegisterApi: onRegisterApi
        };

        // Données d'import
        vm.reportId = null;
        vm.importUserFile = null;
        // Données de suppression par lot
        vm.deleteUserFile = null;

        // -----------------------------
        // FUNCTION
        // -----------------------------
        // Search
        vm.cancelSearch = cancelSearch;
        vm.search = search;
        // Create
        vm.openCreateModal = openCreateModal;
        // Import
        vm.selectImportFile = selectImportFile;
        vm.importUser = importUser;
        vm.openReport = openReport;
        // Suppression par lot
        vm.selectDeleteFile = selectDeleteFile;
        vm.deleteUser = deleteUser;


        init();

        // //////////
        function init() {
            vm.loadingData = true;
            UserSvc.searchUsers(PAGINATION, null).then(function(data) {
                vm.users = lodash.map(data.items, _formatUser);
                vm.totalUsers = data.totalItems;
                _nextLastId = data.nextLastId;

                vm.loadingData = false;
            });
        }

        // ------------------------------
        // Gestion affichage de la liste d'utilisateur
        //
        function onRegisterApi(gridApi) {
            vm.gridApi = gridApi;

            // Gestion infinite scroll
            gridApi.infiniteScroll.on.needLoadMoreData($scope, getDataDown);
        }

        function getDataDown() {
            if(_nextLastId) {
                UserSvc.searchUsers(PAGINATION, _nextLastId).then(function(data) {
                    vm.gridApi.infiniteScroll.saveScrollPercentage();
                    vm.users = vm.users.concat(lodash.map(data.items, _formatUser));
                    _nextLastId = data.nextLastId;

                    return vm.gridApi.infiniteScroll.dataLoaded(false, true);
                }, function(error) {
                    $log.error('Error when downloading new page', error);
                    return vm.gridApi.infiniteScroll.dataLoaded();
                });
            } else {
                return vm.gridApi.infiniteScroll.dataLoaded(false, false);
            }

        }

        // ------------------------------
        // Gestion recherche d'utilisateur
        //
        function search() {
            if(vm.searchForm.$valid) {
                vm.loadingData = true;
                _nextLastId = null;
                UserSvc.searchUsers(MAX_SEARCH, _nextLastId, vm.search.email).then(function(data) {
                    vm.loadingData = false;
                    vm.users = lodash.map(data.items, _formatUser);
                    _nextLastId = null;
                    return vm.gridApi.infiniteScroll.dataLoaded(false, false);
                }, function(error) {
                    vm.loadingData = false;
                    // TODO
                });
            } else {
                $log.debug('Formulaire de recherche non valid', vm.searchForm);
            }
        }

        function cancelSearch() {
            vm.gridApi.infiniteScroll.resetScroll(false, true);
            init();
        }


        // ------------------------------
        // Création d'utilisateurs
        //
        function openCreateModal(ev) {
            ModalSvc.showModal('CreateUserModalctrl', 'app/users/modal/create-user-modal.html', {}, ev).then(function(user) {
                ToastSvc.success($translate.instant('user.list.create.success', {email: user.email}));
                init();
            }).catch(function() {
                $log.debug('No user created');
            });
        }
        // ------------------------------
        // Import d'utilisateurs
        //
        function selectImportFile(file) {
            vm.importUserFile = file;
            vm.reportId = null;
        }

        function importUser() {
            if(vm.importForm.$valid && vm.importUserFile) {
                var upload = UploadSvc.uploadFile('imports/users', vm.importUserFile);

                upload.then(function(response) {
                    $log.debug('Import success', response);
                    vm.reportId = lodash.get(response, 'data.id');
                    vm.importUserFile = null;
                    ToastSvc.success('user.list.import.success');
                }, function(error) {
                    $log.error('Error importing user', error);
                    ToastSvc.error('core.error.import');
                });
            } else {
                $log.error('Form vm.importForm isn\'t valid', vm.importForm, ' or vm.importUserFile is missing', vm.importUserFile);
            }
        }

        function openReport(id, ev) {
            UserSvc.getReportImport(id).then(function(report) {
                var data = lodash.merge({}, {title: 'user.list.import.report_title', reportId: id}, {report: report});
                ModalSvc.showModal('ReportModalCtrl', 'app/core/modal/import-user-report-modal.html', data, ev);
            });
        }
        // ------------------------------
        // Suppression d'utilisateurs par lot
        //
        function selectDeleteFile(file) {
            vm.deleteUserFile = file;
        }
        function deleteUser() {
            if(vm.deleteForm.$valid && vm.deleteUserFile) {
                // eslint-disable-next-line no-alert
                if(confirm('Veuillez confirmer la suppression définitive de tous ces utilisateurs !')) {

                    var upload = UploadSvc.uploadFile('imports/delete/users', vm.deleteUserFile);
                    upload.then(function(response) {
                        $log.debug('Delete success', response);
                        vm.deleteUserFile = null;
                        ToastSvc.success('user.list.delete.success');
                    }, function(error) {
                        $log.error('Error deleting user', error);
                        ToastSvc.error('user.list.delete.error');
                    });
                }
            } else {
                $log.error('Form vm.deleteForm isn\'t valid', vm.deleteForm, ' or vm.deleteUserFile is missing', vm.deleteUserFile);
            }
        }

        // ------------------------------
        // Private Members
        //
        function _formatUser(user, uid) {
            return {
                uid: uid,
                email: (user && user.infos) ? user.infos.email : 'No "infos"',
                name: (user && user.infos) ? (user.infos.firstname || '') + ' ' + (user.infos.lastname || '') : 'No "infos"',
                lang: (user && user.infos) ? user.infos.lang : 'No "infos"',
                group: (user && user.infos) ? user.infos.group : 'No "infos"',
                modules: user.modules ? lodash.map((user.modules), _formatModule) : {noModule: 'No modules'},
                unlimited: (user && user.infos) ? user.infos.unlimited : null,
                nbConnections: (user && user.analytic) ? (user.analytic.nbConnections || user.analytic.nbConnexions || 0) : 0,
                navDuration: (user && user.analytic) ? user.analytic.navDuration : 0
            };
        }

        function _formatModule(module, name) {
            var retour = {
                name: name,
                initialized: true
            };
            if(module === true) {
                retour.initialized = false;
            }
            return retour;
        }

    }
})();

