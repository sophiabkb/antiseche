(function() {
    'use strict';

    angular
        .module('artips.admin.users')
        .controller('ConsultUserCtrl', consultUserCtrl);

    consultUserCtrl.$inject = ['$log', '$state', '$translate', 'lodash', 'uiGridConstants', 'ADMIN',
        'UserSvc', 'AnalyticSvc', 'ConfigSvc', 'StatisticSvc', 'SessionSvc', 'ToastSvc', 'user', 'modAnalytics', 'roles'];
    function consultUserCtrl($log, $state, $translate, lodash, uiGridConstants, ADMIN,
                             UserSvc, AnalyticSvc, ConfigSvc, StatisticSvc, SessionSvc, ToastSvc, user, modAnalytics, roles) {

        var vm = this;

        // DATA
        vm.uid = Object.keys(user)[0];
        vm.myUid = SessionSvc.getUserId();
        vm.user = user[vm.uid];
        vm.courseAnalytics = {};
        // Infos de l'utilisateur
        vm.listInfoItems = ADMIN.userInfosItems;
        // Gauge style
        vm.gaugeStyle = ADMIN.gauge;
        // Image de profil
        vm.loadingData = false;
        // Statistiques
        vm.sessions = [];
        vm.lastSession = null;
        vm.sessionsDuration = 0;
        vm.resultQuiz = null;
        vm.progressionTotal = null;
        // Détail d'un module
        vm.selectedCourse = false;

        // Liste des modules
        vm.gridOptions = {
            enableHorizontalScrollbar: uiGridConstants.scrollbars.NEVER,
            enableVerticalScrollbar: uiGridConstants.scrollbars.NEVER,
            enableColumnResizing: true,
            exporterMenuCsv: false,
            enableGridMenu: false,
            enableColumnMenus: false,
            enableSorting: false,
            enableCellEdit: false,
            enableHiding: false,
            rowHeight: ADMIN.grid.rowHeight,
            // data: 'vm.modules',
            columnDefs: [{
                field: 'name',
                displayName: 'Nom',
                maxWidth: 270,
                cellTemplate: '<div class="ui-grid-cell-contents pointer capitalize" '
                + 'ng-click="grid.appScope.vm.selectCourse(row.entity.name);grid.appScope.adminVm.goToAnchor(\'course-detail\')">'
                + '<a href>{{row.entity.name}}</a>'
                + '</div>'
            }, {
                field: 'lang',
                displayName: 'Lang',
                maxWidth: 70
            }, {
                field: 'startDate',
                displayName: 'Date de début',
                maxWidth: 230,
                cellTemplate: '<div class="ui-grid-cell-contents">'
                + '{{row.entity.startDate | date:\'short\'}}'
                + '</div>'
            }, {
                field: 'progression',
                displayName: 'Avancement',
                cellTemplate:
                '<div class="ui-grid-cell-contents">'
                + '<art-progress-bar value="row.entity.progression" append="%"></art-progress-bar>'
                + '</div>'
            }, {
                field: 'mailing',
                displayName: 'Prochain mail à envoyer',
                cellTemplate: '<div class="ui-grid-cell-contents">'
                + '<span ng-if="row.entity.mailing.lessonType === \'anecdotes\'">Anecdote leçon {{row.entity.mailing.lessonID + 2}}</span>'
                + '<span ng-if="row.entity.mailing.lessonType === \'revisions\'">Antiseche chapitre {{row.entity.mailing.sectionID + 1}}</span>'
                + '<span ng-if="row.entity.mailing.lessonType === \'quiz\'">Quiz chapitre {{row.entity.mailing.sectionID + 1}}</span>'
                + '<span ng-if="row.entity.mailing.lessonType === \'diploma\'">Diplome</span>'
                + '<span ng-if="row.entity.mailing.lessonType === \'finished\'">Fini</span>'
                + '</div>'
            }]
        };


        // FUNCTION
        vm.selectCourse = selectCourse;
        vm.disableUser = disableUser;
        vm.deleteUser = deleteUser;


        // LISTENER
        // var deregister = $scope.$watch('vm.user.infos.disabled', disableUser);
        // $scope.$on('$destroy', deregister);

        init();
        // //////////

        /**
         * @description Initialisation du controlleur
         *
         * @returns {void} rien
         */
        function init() {

            vm.loadingData = true;

            // Liste des modules
            // On veut avoir : nom du module, group du parcours, date de début, langue, avancement des mails, % de complétion
            vm.modules = lodash.map(vm.user.modules, _createModuleListItem);
            vm.gridOptions.data = vm.modules;
            vm.loadingData = false;

            // Récupération et traitement des analytics de sessions
            AnalyticSvc.getUserAnalytics(vm.uid, 'sessions').then(function (sessAnalytics) {
                vm.sessions = lodash.get(sessAnalytics, 'sessions');
                vm.lastSession = lodash.orderBy(vm.sessions, 'startDate', 'desc')[0];
                vm.sessionsDuration = lodash.sumBy(vm.sessions, 'duration');
            });

            // Récupération et traitement des analytics de parcours
            vm.courseAnalytics = lodash.get(modAnalytics, 'modules');
            if(vm.courseAnalytics && vm.courseAnalytics.length > 0) {
                var resultQuizTmp = lodash.flatten(lodash.map(vm.courseAnalytics, function(m) { return lodash.toArray(m.quiz);}));

                vm.resultQuiz = parseInt(StatisticSvc.sumQuizScore(resultQuizTmp), 10);
                vm.progressionTotal = lodash.sumBy(vm.courseAnalytics, _sumFeedBack)
                    / lodash.sumBy(vm.courseAnalytics, function(m) {return lodash.get(m, 'feedback.total');});
                vm.progressionTotal = parseInt(vm.progressionTotal * 100, 10);
            }

            // Gestion des rôles éditeur
            var editorRoles = lodash.get(ConfigSvc.getConfig(), 'admin.editorRoles');
            vm.user.editorRoles = lodash.map(lodash.intersection(roles, editorRoles), function(r) { return angular.lowercase(r);});
        }

        /**
         * @description Sélection d'un parcours pour en avoir le détail
         *
         * @param {string} course - Identifiant du parcours
         *
         * @return {void} rien
         */
        function selectCourse(course) {

            var courseAnalytics = lodash.find(vm.courseAnalytics, {course: course});

            vm.selectedCourse = course;
            vm.courseData = vm.user.modules[course];

            // On récupère les sessions, les feedbacks et les scores aux quiz du module
            var sessions = lodash.get(courseAnalytics, 'sessions');
            var quiz = lodash.get(courseAnalytics, 'quiz');
            var feedback = lodash.get(courseAnalytics, 'feedback');
            vm.selectedCourseAnalytics = {
                duration: lodash.sumBy(sessions, 'duration'),
                startDate: lodash.get(vm.courseData, 'param.startDate'),
                lang: lodash.get(vm.courseData, 'param.lang'),
                mailing: {
                    days: lodash.get(vm.courseData, 'mailing.sendDaysLocal') || [],
                    hour: lodash.get(vm.courseData, 'mailing.sendHourLocal') || null
                },
                quizScore: parseInt(StatisticSvc.sumQuizScore(quiz), 10)
            };

            // Charts feedback
            // Si on a au moins 1 feedback
            if((lodash.get(feedback, 'save') + lodash.get(feedback, 'ok') + lodash.get(feedback, 'ko')) > 0) {
                vm.selectedCourseAnalytics.feedGraph = {
                    labels: [
                        $translate.instant(lodash.get(ADMIN.chart.feedback, 'data.save.label')),
                        $translate.instant(lodash.get(ADMIN.chart.feedback, 'data.ok.label')),
                        $translate.instant(lodash.get(ADMIN.chart.feedback, 'data.ko.label'))
                    ],
                    data: [
                        lodash.get(feedback, 'save'),
                        lodash.get(feedback, 'ok'),
                        lodash.get(feedback, 'ko')
                    ],
                    colors: [
                        lodash.get(ADMIN.chart.feedback, 'data.save.color'),
                        lodash.get(ADMIN.chart.feedback, 'data.ok.color'),
                        lodash.get(ADMIN.chart.feedback, 'data.ko.color')
                    ],
                    options: lodash.merge(lodash.get(ADMIN.chart.feedback, 'options'), {
                        elements: {arc: {borderWidth: 0}},
                        legend: {display: false}
                    })
                };
                vm.selectedCourseAnalytics.feedGraph.legend = ADMIN.chart.feedback.data;
            }
        }

        function disableUser() {
            UserSvc.disableUser(vm.uid, vm.user.infos.disabled).then(function() {
                if(vm.user.infos.disabled) {
                    ToastSvc.success('L\'utilisateur est maintenant désactivé');
                } else {
                    ToastSvc.success('L\'utilisateur est maintenant activé');
                }
            }, function (error) {
                $log.error('Error disabling user', error);
                ToastSvc.error('Erreur lors de la désactivation de l\'utilisateur');
            });
        }

        function deleteUser() {
            if(confirm('La suppression d\'un utilisateur est définitive ! Voulez-vous continuer ?')) {
                UserSvc.deleteUser(vm.user.infos.email).then(function() {
                    ToastSvc.success('L\'utilisateur ' + vm.user.infos.email + ' a été supprimé définitivement');
                    $state.go('admin.header.users.list');
                }, function (error) {
                    $log.error('Error deleting user', error);
                    ToastSvc.error('Erreur lors de la suppression de l\'utilisateur');
                });
            }
        }

        function _createModuleListItem(module, name) {
            if(module === true) {
                return {
                    name: name,
                    lang: 'Non commencé',
                    group: 'Non commencé',
                    startDate: 'Non commencé',
                    mailing: {lessonType: 'anecdotes', lessonID: -1},
                    progression: 0
                };
            }
            var moduleTmp = lodash.find(modAnalytics.modules, {course: name});
            var progression = StatisticSvc.completionRate2(moduleTmp.feedback);
            return {
                name: name,
                lang: module.param ? module.param.lang : 'ERREUR',
                group: module.param ? module.param.group : 'ERREUR',
                startDate: module.param ? module.param.startDate : 'ERREUR',
                mailing: module.mailing ? module.mailing.status : 'ERREUR',
                progression: progression || 0
            };
        }


        function _sumFeedBack(m) {
            return lodash.get(m, 'feedback.ok') + lodash.get(m, 'feedback.ko') + lodash.get(m, 'feedback.save');
        }

        // TODO à garder
        // function addModules() {
        //     if(_formIsValid(vm.addModuleForm, vm.add)) {
        //         UserSvc.addModuleToUser(vm.add).then(function(data) {
        //             if(data && data.unlimited) {
        //                 addAlert('success', 'L\'utilisateur : <b>' + vm.add.email + '</b> a maintenant un accès illimité aux modules');
        //             } else {
        //                 addAlert('success', 'Le(s) module(s) : <b>' + lodash.map(vm.add.modules, 'text').join(', ') + '</b> a(ont) été ajouté(s) à l\'utilisateur : <b>' + vm.add.email + '</b>');
        //             }
        //             _initAddModuleForm();
        //         }, function() {
        //             console.log('error', error);
        //             addAlert('danger', 'An unknown error occurs.');
        //         })
        //     } else {
        //         console.log('Form invalid : vm.addModuleForm', vm.addModuleForm, 'vm.add.modules', vm.add);
        //     }
        // }
    }
})();

