/* global require*/
(function () {
    'use strict';

    // External dependencies
    const lodash = require('lodash');

    // Internal dependencies
    const Config = require('../core/conf.core').config;
    const Logger = require('../core/logger.core');
    // model
    const UserAnalytic = require('../model/user-analytic');
    const UserSessionAnalytic = require('../model/user-session-analytic');
    const UserModuleAnalytic = require('../model/user-module-analytic');
    // dao
    const AnalyticsDAO = require('../dao/analytics.dao');
    const UsersDAO = require('../dao/users.dao');
    // service
    const UsersSvc = require('../services/users.service');


    const ANALYTICS_CONFIG = Config.analytic;

    // Interface du service
    module.exports = {
        // Rework
        createAction: createAction,
        getAllUserSession: getAllUserSession,
        getOneUserSession: getOneUserSession,
        processSession: processSession,
        getAllUserModule: getAllUserModule,
        getOneUserModule: getOneUserModule,
        // To check ou TO DELETE
        getAnalyticsByUserId: getAnalyticsByUserId,
        updateUserAnalytics: updateUserAnalytics,
        filterActionByType: filterActionByType,
        calculNavDuration: calculNavDuration,
        filterNavPage: filterNavPage,
        completionRate: completionRate,
        getAnalyticsByDate: getAnalyticsByDate,
        getUsers: getUsers,
        countFeedbackByType: countFeedbackByType
    };

    async function createAction(dbInfos, uid, action, module, lessonID, sectionID) {
        if(action) {
            const actionParams = {
                action: action,
                creationDate: new Date().getTime(),
                module: module || null,
                lessonID: lessonID || null,
                sectionID: sectionID || null
            };
            return AnalyticsDAO.createAction(dbInfos, uid, actionParams);
        }
        return Promise.resolve(null);
    }


    // Implémentation du service
    async function getAllUserSession(dbInfos, group, course, dateFrom, dateTo) {
        const promises = [];
        const result = [];
        const listUsers = await UsersSvc.getUsers(dbInfos, null, {group: group});
        // 1 - On récupère tous les utilisateurs
        const users = lodash.map(listUsers.items, (val, key) => { return new UserAnalytic(lodash.merge(val.infos, {sponsorship: val.sponsorship}, {uid: key}, {active: val.modules ? (Object.keys(val.modules).length > 0) : false}));});

        // 2 - On récupère toutes nav sessions des utilisateurs
        for(let idx = 0; idx < users.length; idx++) {
            promises.push(AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, users[idx].getUid(), 'navSessions'));
        }
        const sessions = await Promise.all(promises);

        // 3 - On fait matcher utilisateur et sessions (pas top de faire ça sur l'ordre retourné même si c'est sensé fonctionné)
        for(let idx = 0; idx < users.length; idx++) {
            result.push(new UserSessionAnalytic({
                user: users[idx],
                sessions: processSession(sessions[idx], course, dateFrom, dateTo)
            }));
        }

        return result;
    }

    async function getOneUserSession(dbInfos, uid, course, dateFrom, dateTo) {
        const userData = await UsersDAO.getUserById(dbInfos, uid);

        // 1 - On construit l'utlisateur au sens analytics
        const userAnalytics = new UserAnalytic(lodash.merge(userData.infos,
            {sponsorship: userData.sponsorship},
            {uid: uid},
            {active: userData.modules ? (Object.keys(userData.modules).length > 0) : false}));

        // 2 - On récupère toutes nav sessions de l'utilisateur
        const sessions = await AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, uid, 'navSessions');

        // 3 - On fait matcher utilisateur et sessions
        return new UserSessionAnalytic({
            user: userAnalytics,
            sessions: processSession(sessions, course, dateFrom, dateTo)
        });
    }

    // Version corrigée
    function processSession(rawSessions, course, dateFrom, dateTo) {
        if(!rawSessions) {
            return [];
        }

        // On supprimer les sessions qui n'ont pas de nav
        const rawSessionsFiltered = lodash.filter(rawSessions, (s) => s.nav);
        // 1 - On met toutes les navigations dans un tableau
        const navs = lodash(rawSessionsFiltered)
            .map((u) => Object.values(u.nav))
            .flattenDepth(2)
            .filter(_filterNavs)
            .value();
        // 2 - On trie ce tableau par date de création du plus ancien au plus récent
        navs.sort(function(a, b) { return a.startDate - b.startDate;});
        // 3 - On parcours tout et on créé des session au fur et à mesure
        const sessions = [];
        let sesIdx = 0;
        let lastStartDate = -Infinity;
        for(let idx = 0; idx < navs.length; idx++) {
            const nav = navs[idx];

            if(nav.startDate) {
                if((nav.startDate - lastStartDate) > ANALYTICS_CONFIG.session.timeout) {
                    // Session en timeout
                    if(sessions[sesIdx] && idx !== 0) {
                        // On ferme la sessions actuelle
                        sessions[sesIdx].endDate = sessions[sesIdx].startDate + sessions[sesIdx].duration;
                        sesIdx++;
                    }
                    // On créé la prochaine
                    sessions.push({
                        startDate: nav.startDate,
                        duration: 0
                    });
                } else if (sessions[sesIdx] && ((nav.startDate - lastStartDate) > ANALYTICS_CONFIG.nav.timeout)) {
                    // Navigation corrigée car trop longue
                    sessions[sesIdx].duration += ANALYTICS_CONFIG.nav.timeoutValue;

                } else if (sessions[sesIdx]) {
                    // Navigation "normale"
                    sessions[sesIdx].duration += (nav.startDate - lastStartDate);
                }
                lastStartDate = nav.startDate;
            }
        }
        if(sessions[sesIdx]) {
            // Pour la dernière session on indique la endDate
            sessions[sesIdx].endDate = sessions[sesIdx].startDate + sessions[sesIdx].duration;
        }

        return lodash.filter(sessions, (s) => { return s.duration > ANALYTICS_CONFIG.session.shortest; });


        function _filterNavs(n) {
            if(!n) {
                return false;
            }
            if(course && course !== lodash.get(n, 'params.module')) {
                return false;
            }
            if(n.startDate && dateFrom && dateFrom.getTime() >= n.startDate) {
                return false;
            }
            if(n.startDate && dateTo && dateTo.getTime() <= n.startDate) {
                return false;
            }
            return true;
        }
    }

    // // Version buguée
    // function processSession(rawSessions, course, dateFrom, dateTo) {
    //     if(!rawSessions) {
    //         return [];
    //     }
    //     // 1 - On met toutes les navigations dans un tableau
    //     const navs = lodash(rawSessions)
    //         .map((u) => { if(u && u.nav) { return Object.values(u.nav); } return {}; })
    //         .flattenDepth(2)
    //         .filter(_filterNavs)
    //         .value();
    //     // 2 - On trie ce tableau par date de création du plus ancien au plus récent
    //     navs.sort(function(a, b) { return a.startDate - b.startDate;});
    //     // 3 - On parcours tout et on créé des session au fur et à mesure
    //     const sessions = [];
    //     let sesIdx = 0;
    //     let lastStartDate = -Infinity;
    //     for(let idx = 0; idx < navs.length; idx++) {
    //         const nav = navs[idx];
    //
    //         if((nav.startDate - lastStartDate) > ANALYTICS_CONFIG.session.timeout) {
    //             // Session en timeout
    //             if(sessions[sesIdx] && idx !== 0) {
    //                 // On ferme la sessions actuelle
    //                 sessions[sesIdx].endDate = sessions[sesIdx].startDate + sessions[sesIdx].duration;
    //                 sesIdx++;
    //             }
    //             // On créé la prochaine
    //             sessions.push({
    //                 startDate: nav.startDate,
    //                 duration: 0
    //             });
    //         } else if (sessions[sesIdx] && ((nav.startDate - lastStartDate) > ANALYTICS_CONFIG.nav.timeout)) {
    //             // Navigation corrigée car trop longue
    //             sessions[sesIdx].duration += ANALYTICS_CONFIG.nav.timeoutValue;
    //
    //         } else if (sessions[sesIdx]) {
    //             // Navigation "normale"
    //             sessions[sesIdx].duration += (nav.startDate - lastStartDate);
    //         }
    //         lastStartDate = nav.startDate;
    //     }
    //     if(sessions[sesIdx]) {
    //         // Pour la dernière session on indique la endDate
    //         sessions[sesIdx].endDate = sessions[sesIdx].startDate + sessions[sesIdx].duration;
    //     }
    //
    //     return lodash.filter(sessions, (s) => { return s.duration > ANALYTICS_CONFIG.session.shortest; });
    //
    //
    //     function _filterNavs(n) {
    //         if(!n) {
    //             return false;
    //         }
    //         if(course && course !== lodash.get(n, 'params.module')) {
    //             return false;
    //         }
    //         if(dateFrom && dateFrom.getTime() >= n.startDate) {
    //             return false;
    //         }
    //         if(dateTo && dateTo.getTime() <= n.startDate) {
    //             return false;
    //         }
    //         return true;
    //     }
    // }


    async function getAllUserModule(dbInfos, group, course, dateFrom, dateTo, page) {
        const result = [];
        const promises = [];
        const listUsers = await UsersSvc.getUsers(dbInfos, page, {group: group});
        const nextId = listUsers.nextLastId;

        // 1 - On construit les utlisateurs au sens analytics
        const users = lodash.map(listUsers.items, (val, key) => { return new UserAnalytic(lodash.merge(val.infos, {sponsorship: val.sponsorship}, {uid: key}, {active: val.modules ? (Object.keys(val.modules).length > 0) : false}));});

        // 2 - On récupère toutes nav sessions des utilisateurs
        for(let idx = 0; idx < users.length; idx++) {
            promises.push(AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, users[idx].getUid(), 'navSessions'));
        }
        const sessions = await Promise.all(promises);

        // 3 - On fait matcher utilisateur et modules
        for(let idx = 0; idx < users.length; idx++) {
            const user = users[idx];
            const userData = listUsers.items[user.getUid()];
            const modules = lodash.get(userData, 'modules');
            for(const key in modules) {if(modules.hasOwnProperty(key) && course && key !== course) { delete modules[key];}}
            result.push(new UserModuleAnalytic({
                user: users[idx],
                modules: lodash.map(modules, (m, k) => processModules(m, k, sessions[idx], dateFrom, dateTo))
            }));
        }

        return {
            items: result,
            nextId: nextId
        };
    }

    async function getOneUserModule(dbInfos, uid, course, dateFrom, dateTo) {
        const userData = await UsersDAO.getUserById(dbInfos, uid);

        // 1 - On construit l'utlisateur au sens analytics
        const userAnalytics = new UserAnalytic(lodash.merge(userData.infos,
            {sponsorship: userData.sponsorship},
            {uid: uid},
            {active: userData.modules ? (Object.keys(userData.modules).length > 0) : false}));

        // 2 - On récupère toutes nav sessions de l'utilisateur
        const sessions = await AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, uid, 'navSessions');

        // 3 - On fait matcher utilisateur et parcours
        const courses = lodash.get(userData, 'modules');
        for(const key in courses) {
            // 3.1 - On filtre sur les parcours
            if(courses.hasOwnProperty(key) && course && key !== course) {
                delete courses[key];
            }
        }
        return new UserModuleAnalytic({
            user: userAnalytics,
            modules: lodash.map(courses, (m, k) => processModules(m, k, sessions, dateFrom, dateTo))
        });
    }


    function processModules(courseData, course, sessions, dateFrom, dateTo) {
        return {
            course: course,
            feedback: _computeFeedbackForAModule(courseData),
            quiz: _computeQuizResultForAModule(courseData),
            sessions: processSession(sessions, course, dateFrom, dateTo)
        };
    }

    // Private
    function _computeFeedbackForAModule(module) {
        try {
            if(module === true) {
                return {};
            }
            if(!module || !module.data) {
                throw new Error({code: 'missing-data', msg: 'No module data in _computeFeedbackForAModule', data: {module: module}});
            }
            const allFeedbacks = _getAllFedbackFromModuleData(module.data);
            const feedbacks = lodash.compact(allFeedbacks);
            return {
                total: allFeedbacks.length,
                save: feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.toLearn);}, 0),
                ok: feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.known);}, 0),
                ko: feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.dontCare);}, 0)
            };
        } catch(err) {
            Logger.error(err);
            return false;
        }
    }
    function _computeQuizResultForAModule(module) {
        try {
            if(module === true) {
                return {};
            }
            if(!module || !module.data) {
                throw new Error({code: 'missing-data', msg: 'No module data in _computeQuizResultForAModule', data: {module: module}});
            }
            const result = {};
            for(const key in module.data) {
                if(module.data.hasOwnProperty(key)) {
                    const section = module.data[key];
                    const resultKey = key.replace(Config.section.prefix, ''); // On supprime la partie 'section_'
                    result[resultKey] = lodash.extend({}, _processQuizResult(lodash.get(section, 'quiz')), {
                        list: lodash.map(lodash.get(section, 'quiz.historique'), _processQuizResult)
                    });
                }
            }
            return result;
        } catch(err) {
            Logger.error(err);
            return false;
        }
    }


    function getAnalyticsByUserId(dbInfos, uid) {
        return AnalyticsDAO.getAnalyticsByUserId(dbInfos, uid);
    }

    function getAnalyticsByDate(dbInfos, date) {
        return AnalyticsDAO.getAnalyticsByDate(dbInfos, date);
    }

    function updateUserAnalytics(dbInfos) {
        return UsersDAO.getUsers(dbInfos).then(function(users) {
            const promises = [];
            if(users) {
                const uidList = Object.keys(users);
                for(let idx = 0; idx < uidList.length; idx++) {
                    promises.push(_updateUserNbConnexion(dbInfos, uidList[idx]));
                    promises.push(_updateUserNavDuration(dbInfos, uidList[idx]));
                }
            }
            return Promise.all(promises);
        });
    }

    function calculNavDuration(listNav, isDuration) {
        function minusDateFn(s) { if(!Number.isNaN(s.endDate - s.startDate)) {return s.endDate - s.startDate;} return 0;}
        function durationFn(s) { if(!Number.isNaN(s.duration)) {return s.duration;} return 0;}
        const usedFn = isDuration ? durationFn : minusDateFn;
        if(listNav) {
            return lodash.sumBy(lodash.toArray(listNav), usedFn);
        }
        return 0;
    }

    function filterNavPage(listSessionNav, includedStates, filterParam) {
        let pageNav = [];
        for(const sesKey in listSessionNav) {
            if(listSessionNav.hasOwnProperty(sesKey) && listSessionNav[sesKey].nav) {
                const filteredPageNav = lodash.filter(lodash.toArray(listSessionNav[sesKey].nav), _filterNav);
                pageNav = pageNav.concat(filteredPageNav);
            }

        }
        return pageNav;

        function _filterNav(navItem) {
            if(!includedStates) {
                return true;
            }
            if(navItem.stateName) {
                for(let idx = 0; idx < includedStates.length; idx++) {
                    if(navItem.stateName.indexOf(includedStates[idx]) !== -1 && _objectInclude(navItem.params, filterParam)) {
                        return true;
                    }
                }

            }
            return false;
        }
    }

    function filterActionByType(listAction, typeAction, orderCol) {
        if(listAction) {
            return lodash.orderBy(lodash.filter(lodash.toArray(listAction), function(a) {return a.action === typeAction; }), orderCol);
        }
        return 0;
    }

    /**
     * Taux de completion en %
     * @param module
     * @returns {number}
     */
    function completionRate(module) {
        let feedbacks = [];
        if(module && module.data) {
            feedbacks = _getAllFedbackFromModuleData(module.data);
            const completed = lodash.compact(feedbacks).length;
            const total = feedbacks.length;
            if(completed !== 0) {
                return 100 * (completed / total);
            }
            return 0;
        }
        return 0;
    }


    async function getUsers(dbInfos) {
        const users = await UsersDAO.getUsers(dbInfos);
        const usersArr = lodash.toArray(users);
        const activeUsersArr = lodash.extend({}, usersArr);
        const unactiveUsersArr = lodash.remove(activeUsersArr, function(u) { return !u.modules; });
        return {
            usersArr: usersArr,
            activeUsers: {
                unsponsorised: lodash.filter(activeUsersArr, function(u) { return !u.sponsorship; }),
                sponsorised: lodash.filter(activeUsersArr, function(u) { return !!u.sponsorship; })
            },
            inactiveUsers: {
                unsponsorised: lodash.filter(unactiveUsersArr, function(u) { return !u.sponsorship; }),
                sponsorised: lodash.filter(unactiveUsersArr, function(u) { return !!u.sponsorship; })
            }
        };
    }


    function countFeedbackByType(module) {
        const result = {
            toLearn: 0,
            known: 0,
            dontCare: 0
        };
        if(module && module.data) {
            const feedbacks = lodash.compact(_getAllFedbackFromModuleData(module.data));
            result.toLearn = feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.toLearn);}, 0);
            result.known = feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.known);}, 0);
            result.dontCare = feedbacks.reduce(function(n, val) {return n + (val === Config.feedback.dontCare);}, 0);
        }
        return result;
    }

    function _updateUserNbConnexion(dbInfos, uid) {
        return AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, uid, 'actions').then(function(userActions) {
            const connection = filterActionByType(userActions, 'connection', 'creationDate');
            return UsersDAO.updateAnalytics(dbInfos, uid, 'nbConnections', connection.length || 0);
        });
    }

    function _updateUserNavDuration(dbInfos, uid) {
        return AnalyticsDAO.getSubAnalyticsByUserId(dbInfos, uid, 'navSessions')
        .then(function(userNavSessions) {
            const navDuration = calculNavDuration(userNavSessions, true);
            return UsersDAO.updateAnalytics(dbInfos, uid, 'navDuration', navDuration || 0);
        });

    }

    function _objectInclude(srcObj, filtersObj) {
        if(srcObj && filtersObj && lodash.isObject(srcObj) && lodash.isObject(filtersObj)) {
            for(const key in filtersObj) {
                if(filtersObj.hasOwnProperty(key) && filtersObj[key]) {
                    if(!srcObj[key] || srcObj[key] !== filtersObj[key]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Récupère tous les feedbacks d'un module sous forme de liste
     * @param data les données du modules
     * @private
     */
    function _getAllFedbackFromModuleData(data) {
        let feedbacks = [];
        const sectionPerModule = 4;
        const lessonPerSection = 4;
        const sectionPrefix = 'section_';
        const lessonPrefix = 'lesson_';
        if(data) {
            for(let sectIdx = 0; sectIdx < sectionPerModule; sectIdx++) {
                for(let lessIdx = 0; lessIdx < lessonPerSection; lessIdx++) {
                    const lessonId = (sectIdx * lessonPerSection) + lessIdx;
                    if(data[sectionPrefix + sectIdx][lessonPrefix + lessonId]) {
                        feedbacks = feedbacks.concat(data[sectionPrefix + sectIdx][lessonPrefix + lessonId].notions);
                    }
                }
            }
        }
        return feedbacks;
    }

    /**
     * @description
     * @param result
     * @return {{totalQuestions: *|null, score: *, date: *|null}}
     * @private
     */
    function _processQuizResult(result) {
        return {
            totalQuestions: lodash.get(result, 'allQuestions') || null,
            score: lodash.get(result, 'allQuestions') ? (lodash.get(result, 'goodAnswers') / lodash.get(result, 'allQuestions')) : null,
            date: lodash.get(result, 'date') || null
        };
    }

})();

