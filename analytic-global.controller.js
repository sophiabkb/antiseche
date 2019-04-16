(function() {
    'use strict';

    angular
        .module('artips.admin.analytic')
        .controller('AnalyticGlobalCtrl', analyticGlobalCtrl);

    analyticGlobalCtrl.$inject = ['$log', '$filter', '$translate', 'lodash', 'ADMIN', 'AnalyticSvc', 'AnalyticDA', 'groupList'];
    function analyticGlobalCtrl($log, $filter, $translate, lodash, ADMIN, AnalyticSvc, AnalyticDA, groupList) {

        var vm = this;

        // DATA
        vm.groupList = Object.keys(groupList);

        // vm.users = {
        //     sponsorised: countUser.activeUsers.sponsorised.length + countUser.inactiveUsers.sponsorised.length,
        //     unsponsorised: countUser.activeUsers.unsponsorised.length + countUser.inactiveUsers.unsponsorised.length
        // };
        // Création de compte
        // vm.countCreation = {
        //     labels : lodash.toArray(lodash.map(countUser.byWeek.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
        //     series: [$translate.instant('analytic.unsponsorised')],
        //     data: [lodash.map(countUser.byWeek.unsponsorised , 'number')],
        //     colors: ['#02C385']
        // };
        // // Création de compte
        // vm.countCreationSponsorized = {
        //     labels : lodash.toArray(lodash.map(countUser.byWeek.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
        //     series: [$translate.instant('analytic.sponsorised')],
        //     data: [lodash.map(countUser.byWeek.sponsorised, 'number')]
        // };

        // FUNCTION
        vm.updateAnalytic = updateAnalytic;
        vm.exportSessionsCSV = exportSessionsCSV;
        vm.exportModulesCSV = exportModulesCSV;


        init();
        //
        // IMPLEMENTATION
        //
        function init() {
            _loadData();
        }

        function updateAnalytic() {

        }

        function exportSessionsCSV(group, dateFrom, dateTo) {
            var timestampDateFrom = null;
            var timestampDateTo = null;
            if(dateFrom) {
                timestampDateFrom = dateFrom.getTime();
            }
            if(dateTo) {
                timestampDateTo = dateTo.getTime();
            }
            AnalyticDA.getSessionsAPI(group, timestampDateFrom, timestampDateTo, 'text/csv');
        }

        function exportModulesCSV(group, dateFrom, dateTo) {
            var timestampDateFrom = null;
            var timestampDateTo = null;
            if(dateFrom) {
                timestampDateFrom = dateFrom.getTime();
            }
            if(dateTo) {
                timestampDateTo = dateTo.getTime();
            }
            AnalyticDA.getModulesAPI(group, timestampDateFrom, timestampDateTo, 'text/csv');
        }


        function _loadData(dateFrom, dateTo, group, periodicity) {

            // -----------------------------------
            // Nombre et temps de connexion
            // AnalyticSvc.getUserConnection().then(function(data) {
            //     var hour =  1000 * 60 * 60;
            //
            //     // Nombre de connexion par utilisateurs
            //     vm.countConnection = {
            //         labels : lodash.toArray(lodash.map(data.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.unsponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.unsponsorised, data.unsponsorised, 'connection', 2)],
            //         colors: ['#02C385']
            //     };
            //     // Nombre de connexion parrainés
            //     vm.countConnectionSponsorized = {
            //         labels : lodash.toArray(lodash.map(data.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.sponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.sponsorised, data.sponsorised, 'connection', 2)]
            //     };
            //     // Durée de connexion
            //     vm.timeConnection = {
            //         labels : lodash.toArray(lodash.map(data.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.unsponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.unsponsorised, data.unsponsorised, 'duration', 2).map(function(x) {return (x / hour).toFixed(2);})],
            //         colors: ['#02C385']
            //     };
            //     // Durée de connexion parrainés
            //     vm.timeConnectionSponsorized = {
            //         labels : lodash.toArray(lodash.map(data.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.sponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.sponsorised, data.sponsorised, 'duration', 2).map(function(x) {return (x / hour).toFixed(2);})]
            //     };
            // }).catch(function(error) {
            //     $log.error('Error counting user', error);
            //     // TODO mark in error
            // });

            // -----------------------------------
            // Modules par utilisateurs
            // AnalyticSvc.getUserCourse().then(function(data) {
            //     // Nombre de module/utilisateurs
            //     vm.courseByUser = {
            //         labels : lodash.toArray(lodash.map(data.unsponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.unsponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.unsponsorised, data.unsponsorised, 'number', 2)],
            //         colors: ['#02C385']
            //     };
            //     // Nombre de module/utilisateurs
            //     vm.courseByUserSponsorized = {
            //         labels : lodash.toArray(lodash.map(data.sponsorised, 'weekNumber')).map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.sponsorised')],
            //         data: [AnalyticSvc.divideByUserByWeek(countUser.byWeek.sponsorised, data.sponsorised, 'number', 2)]
            //         // data: [lodash.map(data.sponsorised, 'number').map(function(x) {return (x / data.sponsorisedNb).toFixed(2);})]
            //     };
            //     // Nombre total de modules
            //     var dataSponsorized = [];
            //     var dataUnsponsorized = [];
            //     var count = 0;
            //     for(var i = 0 ; i < data.unsponsorised.length ; i++) {
            //         count += data.unsponsorised[i].number;
            //         dataUnsponsorized.push(count);
            //     }
            //     vm.courseTotal = {
            //         labels : lodash.map(data.unsponsorised, 'weekNumber').map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.unsponsorised')],
            //         data: [dataUnsponsorized],
            //         colors: ['#02C385']
            //     };
            //     count = 0;
            //     for(i = 0 ; i < data.sponsorised.length ; i++) {
            //         count += data.sponsorised[i].number;
            //         dataSponsorized.push(count);
            //     }
            //     vm.courseTotalSponsorized = {
            //         labels : lodash.map(data.unsponsorised, 'weekNumber').map(function(x) {return 'S' + x;}),
            //         series: [$translate.instant('analytic.sponsorised')],
            //         data: [dataSponsorized]
            //     };
            // }).catch(function(error) {
            //     $log.error('Error counting user', error);
            //     // TODO mark in error
            // });

            // -----------------------------------
            // Utilisateurs par modules Modules
            AnalyticSvc.getCourse().then(function(data) {
                // Nombre de module/utilisateurs
                vm.courseSponsorised = {
                    labels : Object.keys(data.sponsorised),
                    data: lodash.toArray(data.sponsorised)
                };
                vm.courseUnsponsorised = {
                    labels : Object.keys(data.unsponsorised),
                    data: lodash.toArray(data.unsponsorised)
                };
            }).catch(function(error) {
                $log.error('Error counting user', error);
                // TODO mark in error
            });

            // ----------------------------
            // Heure et jours d'envoi des modules
            AnalyticSvc.getDaysHours().then(function(data) {
                // Jours
                vm.daysSponsorised = {
                    labels : Object.keys(data.sponsorised.days).map(function(k) { return $translate.instant('common.days.' + k);}),
                    data: lodash.toArray(data.sponsorised.days)
                };
                vm.daysUnsponsorised = {
                    labels : Object.keys(data.unsponsorised.days).map(function(k) { return $translate.instant('common.days.' + k);}),
                    data: lodash.toArray(data.unsponsorised.days)
                };
                // Heures
                vm.hoursSponsorised = {
                    labels : Object.keys(data.sponsorised.hours).map(function(k) { return $translate.instant('common.hours.' + k);}),
                    data: lodash.toArray(data.sponsorised.hours)
                };
                vm.hoursUnsponsorised = {
                    labels : Object.keys(data.unsponsorised.hours).map(function(k) { return $translate.instant('common.hours.' + k);}),
                    data: lodash.toArray(data.unsponsorised.hours)
                };
            }).catch(function(error) {
                $log.error('Error getting course analytic', error);
                // TODO mark in error
            });


            // ----------------------------
            // Device utilisé
            // AnalyticSvc.getDevice().then(function(data) {
            //     // Non parainé
            //     vm.device = {
            //         labels : Object.keys(data.unsponsorised),
            //         data: lodash.toArray(data.unsponsorised).map(function(d) { return d.toFixed(2)})
            //     };
            //     // parainés
            //     vm.deviceSponsorised = {
            //         labels : Object.keys(data.sponsorised),
            //         data: lodash.toArray(data.sponsorised).map(function(d) { return d.toFixed(2)})
            //     };
            // }).catch(function(error) {
            //     $log.error('Error getting course analytic', error);
            //     // TODO mark in error
            // });

            // ----------------------------
            // Device utilisé
            AnalyticSvc.getCompletion().then(function(data) {
                vm.completionOpt = {
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0,
                                max: 100,
                                stepSize: 10
                            }
                        }]
                    }
                };
                // Non parainé
                vm.completion = {
                    labels : Object.keys(data.unsponsorised.modules),
                    series: [$translate.instant('analytic.unsponsorised')],
                    data: [lodash.toArray(lodash.map(data.unsponsorised.modules, 'completionRate')).map(function(d) { return d.toFixed(2)})],
                    colors: ['#02C385']
                };

                // parainés
                vm.completionSponsorized = {
                    labels : Object.keys(data.sponsorised.modules),
                    series: [$translate.instant('analytic.sponsorised')],
                    data: [lodash.toArray(lodash.map(data.sponsorised.modules, 'completionRate')).map(function(d) { return d.toFixed(2)})]
                };

                vm.totalCompletionRate = data.unsponsorised.total.completionRate;
                vm.totalCompletionRateSponsorized = data.sponsorised.total.completionRate;
            }).catch(function(error) {
                $log.error('Error getting course analytic', error);
                // TODO mark in error
            });


            // ----------------------------
            // Trie des leçons
            AnalyticSvc.getFeedback().then(function(data) {
                vm.feedbackOpt = ADMIN.chart.feedback.options;

                vm.feedback = {
                    data: [data.unsponsorised.toLearn, data.unsponsorised.known, data.unsponsorised.dontCare],
                    labels: [$translate.instant(ADMIN.chart.feedback.veuxLapprendre.label), $translate.instant(ADMIN.chart.feedback.savaisDeja.label), $translate.instant(ADMIN.chart.feedback.menFous.label)],
                    colors: [ADMIN.chart.feedback.veuxLapprendre.color, ADMIN.chart.feedback.savaisDeja.color, ADMIN.chart.feedback.menFous.color]
                };
                vm.feedbackSponsorized = {
                    data: [data.sponsorised.toLearn, data.sponsorised.known, data.sponsorised.dontCare],
                    labels: [$translate.instant(ADMIN.chart.feedback.veuxLapprendre.label), $translate.instant(ADMIN.chart.feedback.savaisDeja.label), $translate.instant(ADMIN.chart.feedback.menFous.label)],
                    colors: [ADMIN.chart.feedback.veuxLapprendre.color, ADMIN.chart.feedback.savaisDeja.color, ADMIN.chart.feedback.menFous.color]
                };
            }).catch(function(error) {
                $log.error('Error getting course analytic', error);
                // TODO mark in error
            });

            AnalyticSvc.getNote().then(function(data) {
                console.log('Note data', data);
                vm.scoreTotalSponsorized = data.sponsorised.total.scoreRate;
                vm.scoreTotal = data.unsponsorised.total.scoreRate;
                vm.scoreOpt = {
                    scales: {
                        yAxes: [{
                            ticks: {
                                min: 0,
                                max: 30,
                                stepSize: 2
                            }
                        }]
                    }
                };

                // Non parainé
                vm.score = {
                    labels : Object.keys(data.unsponsorised.modules),
                    series: [$translate.instant('analytic.unsponsorised')],
                    data: [lodash.toArray(lodash.map(data.unsponsorised.modules, 'scoreRate')).map(function(d) { return d.toFixed(2)})],
                    colors: ['#02C385']
                };

                // parainés
                vm.scoreSponsorized = {
                    labels : Object.keys(data.sponsorised.modules),
                    series: [$translate.instant('analytic.sponsorised')],
                    data: [lodash.toArray(lodash.map(data.sponsorised.modules, 'scoreRate')).map(function(d) { return d.toFixed(2)})]
                };
            }).catch(function(error) {
                $log.error('Error getting course analytic', error);
                // TODO mark in error
            });

        }
    }
})();

