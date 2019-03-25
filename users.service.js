(function () { // eslint-disable-line max-statements
    'use strict';

    // External dependencies
    const lodash = require('lodash');

    // Internal dependencies
    // core
    const Logger = require('./../core/logger.core.js');
    const Config = require('./../core/conf.core').config;
    const Firebase = require('./../core/firebase.core');
    // dao
    const UsersDAO = require('../dao/users.dao');
    const ProspectsDAO = require('../dao/prospects.dao');
    const PaymentsDAO = require('../dao/payments.dao');
    const AnalyticsDAO = require('../dao/analytics.dao');
    const DefaultConfigDAO = require('../dao/default-config.dao');
    const ConfigDAO = require('../dao/config.dao');
    const ModulesDAO = require('../dao/modules.dao');
    // error
    const AntisecheError = require('./errors/antiseche.error');
    // services
    const ResourcesSvc = require('./resources.service');
    const PaymentsSvc = require('./payments.service');
    const GroupsSvc = require('./groups.service');
    const AnalyticsSvc = require('./analytics.service');
    const UtilSvc = require('./util.service');
    const MessagerCollectSvc = require('./messager/messager-collect.service');

    // Interface
    exports.getUsers = getUsers;
    exports.countUsers = countUsers;
    exports.createUser = createUser;
    exports.createUserWithModules = createUserWithModules;
    exports.createAnonymousUser = createAnonymousUser;
    exports.createUserWithUID = createUserWithUID;
    exports.createUserAlias = createUserAlias;
    exports.createCustomToken = createCustomToken;
    exports.userExist = userExist;

    exports.processSignin = processSignin;

    exports.getRoles = getRoles;

    exports.getNextStatus = getNextStatus;
    exports.updateStatus = updateStatus;
    exports.getCourseStatusIndex = getCourseStatusIndex;
    exports.updateSendLater = updateSendLater;
    exports.markLessonAsSent = markLessonAsSent;
    exports.getMedias = getMedias;

    exports.addModuleIfNotExist = addModuleIfNotExist;
    exports.addNotInitModuleIfNotExist = addNotInitModuleIfNotExist;
    exports.addCourse = addCourse;
    exports.searchUserByMail = searchUserByMail;
    exports.searchUserById = searchUserById;
    exports.addOrder = addOrder;
    exports.addSponsor = addSponsor;
    exports.updateUserInfo = updateUserInfo;
    exports.unlockAllLessons = unlockAllLessons;
    exports.unlockNextLesson = unlockNextLesson;
    exports.removeAllCoursesMaxStatus = removeAllCoursesMaxStatus;
    exports.disableUser = disableUser;
    exports.deleteUserById = deleteUserById;
    exports.cleanUserFirebase = cleanUserFirebase;

    // Constantes
    const L_TYPE_NOTION = Config.status.lesson.notion;
    const TEASER_VAR_NAME = 'freeMaxLesson';


    /**
     * @description Récupère une liste d'utilisateur paginé
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {{page: number, pageSize: number, order: string}} pagination - indication de pagination
     * @param {{email: string, group: string}} filters - indication de filtre
     *
     * @returns {{nextLastId: number, items: array}} - promise avec la liste des élements
     */
    async function getUsers(dbInfos, pagination, filters) {
        let usersTmp = await UsersDAO.getUsers(dbInfos, pagination, filters);
        const userTmpAr = lodash.toArray(usersTmp);
        const pageSize = UtilSvc.convertToNumber(pagination ? pagination.pageSize : null);
        let nextLastId = null;
        // Si on a une page entière on enlève le dernier utilisateur de la liste à retourner
        // et on récupère son ID, qu'on retourne pour que la requête suivante puisse renvoyer
        // cet ID
        if(userTmpAr && lodash.isArray(userTmpAr) && pageSize && userTmpAr.length === (pageSize + 1)) {
            nextLastId = Object.keys(usersTmp)[userTmpAr.length - 1];
            delete usersTmp[nextLastId];
        }
        // On applique les filtres
        if(filters) {
            if(filters.email) {
                nextLastId = null;
                usersTmp = lodash.pickBy(usersTmp, function _emailFilter(u) {
                    if(u && u.infos && u.infos.email) {
                        return UtilSvc.lowercase(lodash.get(u, 'infos.email')).indexOf(UtilSvc.lowercase(filters.email)) !== -1;
                    }
                    return false;
                });
            }
            if(filters.group) {
                nextLastId = null;
                usersTmp = lodash.pickBy(usersTmp, function _emailFilter(u) {
                    if(lodash.has(u, 'infos.group')) {
                        return UtilSvc.lowercase(lodash.get(u, 'infos.group')).indexOf(UtilSvc.lowercase(filters.group)) !== -1;
                    }
                    return false;
                });
            }
        }

        return {
            nextLastId: nextLastId,
            items: usersTmp
        };
    }

    function countUsers(dbInfos) {
        return UsersDAO.countUsers(dbInfos);
    }

    /**
     * @description Création d'un utilisateur avec ses parcours
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {object} userData - Données de l'utilisateur
     * @param {object} utmData - Données UTM
     * @param {object} browserData - Infos sur le navigateur de la personne qui s'est inscrit
     * @param {string[]} courses - Une liste d'identifiant de parcours
     *
     * @returns {Promise} - Une promise qui resolve si ça a fonctionné
     */
    async function createUserWithModules(dbInfos, userData, utmData, browserData, courses) {
        const registrationConf = ConfigDAO.getRegistration(dbInfos);

        // 1 - On créé l'utilisateur
        await createUser(dbInfos, userData, utmData, browserData, registrationConf);

        // 2 - On ajoute les parcours
        const promises = [];
        for(let idx = 0; idx < courses.length; idx++) {
            promises.push(addNotInitModuleIfNotExist(dbInfos, userData.uid, courses[idx]));
        }
        await Promise.all(promises);

        // 3 - On ajoute les "factures"
        const promisesOrder = [];
        for(let idx = 0; idx < courses.length; idx++) {
            promisesOrder.push(addOrder(dbInfos, userData.uid, 'admin_' + courses[idx], courses[idx]));
        }
        return Promise.all(promisesOrder);
    }

    /**
     * @description Méthodes enregistrant l'utilisateur anonyme dans firebase sous la structure `users`
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {object} userData - les infos liées à l'utilisateur au format:  {uid: string, email: string, password: string, lastname: string, firstname: string, lang: string}
     * @param {object} paramsData - infos venant de l'URL et non regroupable au sein des autres parties : {module: string, group: string, cur: string, code: string}
     * @param {object} utmData - infos UTM
     * @param {object} browserData - infos du browser de l'utilisateur
     * @param {object} registrationConf - infos de configuration de l'inscription
     * @returns {Promise.<object>} L'utilisateur créé sous forme de promise
     */
    async function createAnonymousUser(dbInfos, userData, paramsData, utmData, browserData, registrationConf) {
        // Sécurité pour ne pas qu'un utilisateur puisse s'ajouter des rôles
        delete userData.roles;

        userData.comment = 'Connexion anonyme';
        userData.group = paramsData.group || null;

        // Création de l'utilisateur
        const user = await UsersDAO.createUser(dbInfos, userData, utmData, browserData);

        // On passe l'utilisateur en mode illimité si la conf le demande
        if(registrationConf && registrationConf.unlimited) {
            await UsersDAO.updateInfos(dbInfos, userData.uid, {unlimited: true});
        }

        await UsersDAO.setRoles(dbInfos, userData.uid, ['USER']);

        return user;
    }

    /**
     * @description Méthodes enregistrant l'utilisateur anonyme dans firebase sous la structure `users`
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant de l'utilisateur a créer
     * @param {{uid: string, email: string, password: string, lastname: string, firstname: string, lang: string}} user - les infos liées à l'utilisateur au format
     *
     * @returns {Promise.<void>} Une promise qui resolve si ça fonctionne
     */
    async function createUserWithUID(dbInfos, uid, user) {

        // 1 - On vérifie qu'il n'existe pas déjà un  utilisateur avec cet UID (dans Auth et dans la table users)
        const authUser = await UsersDAO.getAuthUserById(dbInfos, uid);
        const userData = await UsersDAO.getUserById(dbInfos, uid);
        if(authUser || userData) {
            throw new Error({code: 'auth/already-exist', msg: 'User uid=' + uid + ' already exists. We can\'t create another one'});
        }

        // 2 - On créé l'utilisateur firebase
        await UsersDAO.createFirebaseUser(dbInfos, lodash.get(user, 'infos.email'), null, uid);

        // 3 - On créé l'utilisateur dans la table "users"
        await UsersDAO.createRawUser(dbInfos, uid, user);

        await UsersDAO.setRoles(dbInfos, uid, ['USER']);

        Logger.info('User uid=', uid, 'has been created for email=', lodash.get(user, 'infos.email'), 'and data=', JSON.stringify(user));
    }

    /**
     * @description Permet de créer un alias pour un utilisateur. Cet alias pointera sur l'utilisateur principale
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant de l'alias
     * @param {string} company - sous base de l'alias
     * @param {string} base - firebase de l'alias, valeur par défaut le projectId de la connexion firebase, ex : antiseche-dev
     * @param {string} principal - Identifiant de l'utilisateur principal
     *
     * @returns {Promise.<void>} Une promise qui resolve si ça fonctionne
     */
    async function createUserAlias(dbInfos, uid, principal, company = 'default', base = Firebase.getFirebaseProjectId()) {
        if(!principal) {
            throw new Error({code: 'missing-data', principal: 'Trying to create alias without principal'});
        }
        const aliasData = {principal: principal, base: base, company: company};
        // 1 - On supprime les infos de l'utilisateur qui doit devenir un alias
        await UsersDAO.removeUser(dbInfos, uid);
        // 2 - On crée l'alias
        await UsersDAO.createAlias(dbInfos, uid, aliasData);
        // 3  - On migre les analytics
        const analytics = await AnalyticsDAO.getAnalyticsByUserId(dbInfos, uid);
        await AnalyticsDAO.removeAnalyticsByUserId(dbInfos, uid);
        await AnalyticsDAO.setAnalyticsByUserId(dbInfos, principal, analytics);
        Logger.info('Alias created for principal=', principal, ', with uid=', uid, ', and aliasData=', JSON.stringify(aliasData));
    }

    /**
     * Création d'un token custom par Firebase
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @returns {*}
     */
    function createCustomToken(dbInfos, uid) {
        return UsersDAO.createCustomToken(dbInfos, uid);
    }

    /**
     *
     * @param dbInfos
     * @param uid
     * @returns {Promise<*>}
     */
    async function userExist(dbInfos, uid) {
        if(!uid) {
            return null;
        }

        const userAuth = await UsersDAO.getAuthUserById(dbInfos, uid);
        const userData = await UsersDAO.getUserById(dbInfos, uid);

        return !!(userAuth || userData);
    }

    /**
     * @description Création à proprement parlé d'un utilisateur (dans firebase et dans la table User)
     *
     * @param {{subBase: string}} dbInfos - info de base de données
     * @param {object} userData - info de l'utilisateuyr
     * @param {{utm_source: string, utm_medium: string, utm_campaign: string}} utmData - info UTM
     * @param {object} browserData - données du navigateur de l'utilisateur
     * @param {object} registrationConfig - infos sur la configuration de la création de compte
     *
     * @returns {Promise} resolve si ok, reject sinon
     */
    async function createUser(dbInfos, userData, utmData, browserData, registrationConfig) {
        // 1 -  On vérifie qu'on n'a pas déjà un utilisateur avec cet email dans la même company
        //      si c'est OK alors on poursuit la création de compte en créant ou non un utilisateur
        const allowMultipleAccount = lodash.get(registrationConfig, 'allowMultipleAccount') || dbInfos.front === 'antiseche';
        const user = await searchUserByMail(dbInfos, userData.email);
        let uid = null;
        if(user) {
            uid = Object.keys(user)[0];
        }
        // Si on n'autorise pas le multiple compte sur la plateforme
        // OU
        // Si l'utilisateur existe dans la table users de la "company" alors on ne le créer pas
        if((!allowMultipleAccount && uid)
            || (user && uid && user[uid] && Object.keys(user[uid]).length > 0)) {
            return Promise.reject(new AntisecheError({code: 'ALREADY_EXIST', message: 'User ' + userData.email + ' already exist, can\'t be create.'}));
        }

        // 2 - On créé l'utilisateur dans la partie auth de firebase si cet utilisateur n'existe pas,
        //      sinon on récupère juste son uid
        userData.uid = uid;
        if(!user) {
            userData.uid = await UsersDAO.createFirebaseUser(dbInfos, userData.email, userData.password);
        }

        // 3 - On créé l'utilisateur dans la table users
        await UsersDAO.createUser(dbInfos, userData, utmData, browserData);

        // 4 - On créé les rôles
        let roles = ['USER'];
        if(userData.roles) {
            if(lodash.isArray(userData.roles)) {
                roles = roles.concat(userData.roles.map((r) => lodash.toUpper(r)));
            } else {
                roles.push(lodash.toUpper(userData.roles));
            }
        }
        // Ajout du rôle USER
        return UsersDAO.setRoles(dbInfos, userData.uid, roles);
    }


    /**
     * Méthodes enregistrant l'utilisateur dans firebase sous la structure `users`, et qui retourne une action
     * à faire en fonction des données de l'utilisateur qui peut être :
     * - redirection vers la page de paiement
     * - redirection vers la page start-module
     * - redirection vers la page module
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {object} userData - les infos liées à l'utilisateur au format:  {uid: string, email: string, password: string, lastname: string, firstname: string, lang: string}
     * @param {object} paramsData - infos venant de l'URL et non regroupable au sein des autres parties : {module: string, group: string, cur: string, code: string}
     * @param {object} utmData - infos UTM
     * @param {object} browserData - infos du browser de l'utilisateur
     * @param {object} registrationConf - infos de configuration de l'inscription
     * @returns {*} promise
     */
    async function processSignin(dbInfos, userData, paramsData, utmData, browserData, registrationConf) {

        Logger.debug('User created in Firebase - will start signin');
        // Sécurité pour ne pas qu'un utilisateur puisse s'ajouter des rôles
        delete userData.roles;

        const bodyPaymentData = PaymentsSvc.extractPaymentInfo({module: paramsData.module, email: userData.email, cur: paramsData.cur, code: paramsData.code, group: paramsData.group || null});

        // 1 - On récupère les infos de paiement
        const paymentData = await PaymentsSvc.getPaymentInfo(dbInfos, null, bodyPaymentData.module, bodyPaymentData.email, bodyPaymentData.currency, bodyPaymentData.amount, bodyPaymentData.group);
        const groupTitle = paymentData.group;

        // 2 -  On récupère le group lié au group à enregistrer pour l'utilisateur
        //      pour ce module
        const group = await GroupsSvc.getGroupById(dbInfos, groupTitle);
        userData.group = groupTitle || userData.group;

        // 3 - On créé l'utilisateur
        await createUser(dbInfos, userData, utmData, browserData, registrationConf);

        // 4 - Récupération du pending
        const data = await PaymentsDAO.getPendingsByMail(dbInfos, userData.email);


        // 5 - On récupére le pending correspondant au module
        let pending = null;
        let pendingKey = null;
        let unlimitedPending = false;
        for(const key in data) {
            // On donne la priorité au pending illimité
            if(Object.prototype.hasOwnProperty.call(data, key)
                && data[key].unlimited && data[key].email === userData.email) {
                pending = data[key];
                pendingKey = key;
                unlimitedPending = true;
                break;
            } else if(Object.prototype.hasOwnProperty.call(data, key)
                && data[key].module === paramsData.module && data[key].email === userData.email) {
                pending = data[key];
                pendingKey = key;
                break;
            }
        }

        // 6.A - Si on a un pending qui correspond (cas particulier)
        if (pending) {
            // Suppression du pending
            await PaymentsDAO.removePending(dbInfos, pendingKey);

            // Ajout du "sponsorShip" si le pending provenait d'un code cadeau
            if(pending.fromUid && pending.fromGiftToken) {
                await _addSponsorship(dbInfos, userData.uid, pending.fromUid, pending.fromGiftToken);
            }

            // On regarde si c'est un pending illimité ou pour un module uniquement
            if(unlimitedPending) {
                // On passe l'utilisateur en illimité
                await UsersDAO.updateInfos(dbInfos, userData.uid, {unlimited: true});
                return {
                    code: 'DASHBOARD',
                    msg: 'Création d\'un utilisateur en illimité',
                    data: {userId: userData.uid, fromPending: true}
                };
            }
            // Ajout du module non initialisé
            await addNotInitModuleIfNotExist(dbInfos, userData.uid, paramsData.module);
            return {
                code: 'INIT_MODULE',
                msg: 'Pending check',
                data: {userId: userData.uid, module: paramsData.module, fromPending: true}
            };
        }

        // 6.B - Sinon si on n'a pas de pending correspondant alors on a différent cas
        Logger.debug('No pending found');
        paymentData.email = userData.email;

        // 6.B.1 - Si on n'a pas de pending dans tous les cas on vient ré-écrire le prospect avec les données extraites (url ou prospect)
        await ProspectsDAO.upsertProspect(paymentData);
        if(registrationConf && registrationConf.unlimited) {
            await UsersDAO.updateInfos(dbInfos, userData.uid, {unlimited: true});
        }

        // 6.B.2 - Soit on est en mode teaser (deprecated)
        if (group && group.freeMaxLesson && paramsData.module) {
            Logger.debug('Group detected - will add free trial module to user');
            await addModuleIfNotExist(dbInfos, userData.uid, paramsData.module, groupTitle, null, userData.lang, Config.mailingData.default);
            Logger.info('Teaser module added for user', userData.uid);
            return {
                code: 'START_MODULE',
                msg: 'Enregistrement en mode teaser',
                data: {
                    userId: userData.uid,
                    module: paramsData.module
                }
            };
        // 6.B.3 - Soit on doit ajouter un parcours, mais ce parcours n'a pas été payé, ni ajouté via un code cadeau
        } else if(paramsData.module && !paramsData.isGift) {
            // Cas d'un enregistrement avec un module en param donc on redirige vers la page paiement du module
            Logger.info('User signed in with e module');
            return {
                code: 'PAYMENT',
                msg: 'Enregistrement donc on redirige vers la paiement',
                data: {
                    userId: userData.uid,
                    module: paramsData.module,
                    code: paramsData.cur,
                    cur: paramsData.cur,
                    group: paramsData.cur
                }
            };

        // 6.B.4 - On doit ajouter un parcours qui a été "payé" par un code cadeau
        } else if(paramsData.module && paramsData.isGift) {
            // Inscription après avoir cliqué sur utilisé un code cadeau
            Logger.debug('User signed in with gift code');
            return {
                code: 'GIFT',
                msg: 'Enregistrement via code cadeau on redirige vers la page cadeau',
                data: {
                    userId: userData.uid,
                    module: paramsData.module,
                    code: paramsData.cur,
                    cur: paramsData.cur,
                    group: paramsData.cur
                }
            };
        }
        // 6.B.5 - On n'ajoute pas de parcours, seul l'utilisateur est créé
        // Inscription depuis la page login "Je n'ai pas de compte"
        Logger.debug('User signed in');
        return {
            code: 'DASHBOARD',
            msg: 'Enregistrement sans module on redirige vers le dashboard',
            data: {
                userId: userData.uid
            }
        };
    }


    function _addSponsorship(dbInfos, uid, fromUid, fromGiftToken) {
        const sponsorship = {
            uid: fromUid,
            createdAt: new Date().getTime()
        };
        const sponsor = {
            uid: uid,
            updatedAt: new Date().getTime()
        };
        return Promise.all([
            UsersDAO.updateSponsor(dbInfos, fromUid, fromGiftToken, sponsor),
            UsersDAO.addSponsorship(dbInfos, uid, sponsorship)
        ]);
    }

    /**
     * @description Récupère la liste des rôles d'un utilisateur pour une company
     *
     * @param {{subBase: string}} dbInfos - Infos de la base de données
     * @param {string} uid - Identifiant de l'utilisateur
     *
     * @return {Promise.<string[]>} une promise avec la liste des rôles
     */
    function getRoles(dbInfos, uid) {
        return UsersDAO.getRoles(dbInfos, uid);
    }


    /**
     *@description Permet de récupérer le prochain status d'un utilisateur
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant de l'utilisateur (exemple: 124654GJYGYUJFHGDedfss)
     * @param {string} course - identifiant du module (exemple: impressionnisme, avant-gardes)
     * @param {object} courseData - données utilisateur du module (exemple: {data:, mailing:, param})
     * @param {object} moduleStruct - données concernant la structure du module
     *
     * @returns {Promise.<*>} - le nouveau status
     */
    async function getNextStatus(dbInfos, uid, course, courseData, moduleStruct) {

        // 1 - Si pas de status au parcours on reject
        if(!courseData || !lodash.has(courseData, 'mailing.status')) {
        // if(!lodash.has(user, 'modules.' + course + '.mailing.status')) {
            throw new AntisecheError({code: 'course/no-course-status', message: 'User ' + uid + ' not found, or without this course= ' + course});
        }

        // 2 - On récupère toutes les infos sur le groupe de l'utilisateur
        const groupName = courseData.param ? courseData.param.group : null;
        const group = GroupsSvc.getGroupById(dbInfos, groupName);
        const checkGroup = !!group;
        // Si on a un groupe et que ce groupe à une valeur de teaser et que cette valeur de teaser est inférieur ou égale à l'avancement du parcours
        // alors on renvoie un code PAYMENTR
        if(checkGroup && group && group[TEASER_VAR_NAME] && (parseInt(group[TEASER_VAR_NAME], 10) <= courseData.mailing.status.lessonID)) {
            throw new AntisecheError({code: 'course/teaser-limit', message: 'Teaser limit detected when unlocking next lesson for user ' + uid + ' with course=' + course});
        }

        // 3 - On récupère le status d'envoi du parcours et la liste des étapes du parcours
        const status = lodash.get(courseData, 'mailing.status');
        const maxStatus = lodash.get(courseData, 'mailing.maxStatus');
        let moduleStructure = moduleStruct;
        if(!moduleStructure) {
            const defaultConfiguration = await DefaultConfigDAO.getConfig();
            moduleStructure = lodash.get(await MessagerCollectSvc.getModulesStructure(dbInfos, lodash.get(defaultConfiguration, 'moduleStructure')), course);
        }
        const currentStatusIndex = getCourseStatusIndex(status, moduleStructure);

        // Si le status actuel n'a pas de correspondance on balance une erreur
        if(currentStatusIndex === -1) {
            throw new AntisecheError({code: 'course/status-not-found', message: 'Current status ' + JSON.stringify(status) + ' does not match any status in module structure of course=' + course + ' for user ' + uid});
        }
        // Si le status actuel correspond au maxStatus on balance une erreur
        if(maxStatus && (_compareStatus(status, maxStatus) >= 0)) {
            throw new AntisecheError({code: 'course/max-status', message: 'Current status ' + JSON.stringify(status) + ' is equal of maxStatus ' + JSON.stringify(maxStatus) + ' of course=' + course + ' for user ' + uid});
        }

        // 4 - On incrément le prochain status
        const nextStatusIndex = currentStatusIndex + 1;
        // Si on arrive à la fin on ne fait rien
        if(nextStatusIndex > moduleStructure.length) {
            throw new AntisecheError({code: 'course/status-higher', message: 'Next status index ' + nextStatusIndex + ' is higher than the status list length for user ' + uid + ' and course=' + course});
        }

        return Object.assign({}, moduleStructure[nextStatusIndex]);
    }

    /**
     * @description Retourne l'index d'un status, parmis une liste de status, -1 si le status n'est pas trouvé
     *
     * @param {{lessonID:number, lessonType:string, sectionID:number}} moduleStatus - Status recherché dans la liste
     * @param {{lessonID:number, lessonType:string, sectionID:number}[]} moduleStructure - Liste des status
     *
     * @returns {number} index du status dans la liste, -1 si le status n'est pas dans la liste
     */
    function getCourseStatusIndex(moduleStatus, moduleStructure) {
        if(!moduleStatus || !moduleStructure) {
            return -1;
        }
        return lodash.findIndex(moduleStructure, {
            lessonID: lodash.parseInt(moduleStatus.lessonID, 10),
            lessonType: moduleStatus.lessonType,
            sectionID: lodash.parseInt(moduleStatus.sectionID, 10)});
    }

    function _compareStatus(statusA, statusB) {
        if(!statusA || !statusB) {
            throw new Error('Missing status in compareStatus');
        }

        const type = {};
        type[Config.status.lesson.anecdote] = 0;
        type[Config.status.lesson.revision] = 0.1;
        type[Config.status.lesson.quiz] = 0.2;
        type[Config.status.lesson.diploma] = 0.3;
        type[Config.status.lesson.finished] = 0.4;
        const scoreA = statusA.lessonID + type[statusA.lessonType];
        const scoreB = statusB.lessonID + type[statusB.lessonType];

        return scoreA - scoreB;
    }

    /**
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @param course
     * @param statusData
     * @return {*}
     */
    function updateStatus(dbInfos, uid, course, statusData) {
        return UsersDAO.updateMailing(dbInfos, uid, course, {status: statusData});
    }


    /**
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @param module
     * @param lessonId
     */
    function updateSendLater(dbInfos, uid, module, lessonId) {
        if(uid && module && lessonId) {

            const now = new Date();
            const currentHour = now.getUTCHours();
            const infos = {
                sendHour: currentHour + 5,
                lessonID: parseInt(lessonId, 10),
                sectionID: UtilSvc.sectionIdWithLessonId(lessonId)
            };
            return UsersDAO.updateMailing(dbInfos, uid, module, {sendLater: infos}).then(function () {
                return AnalyticsSvc.createAction(dbInfos, {
                    lessonID: lessonId,
                    sectionID: UtilSvc.sectionIdWithLessonId(lessonId),
                    action: 'receive_notions_later',
                    uid: uid,
                    module: module
                });
            });
        }
        return Promise.reject('Error in updateSendLater uid : ' + uid + ', module: ' + module + ', lessonId: ' + lessonId);
    }

    /**
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param course
     * @param lessonID
     * @param sectionID
     * @param uid
     * @return {*}
     */
    function markLessonAsSent(dbInfos, uid, course, sectionID, lessonID) {
        Logger.info('User', uid, 'in company', dbInfos.subBase, 'update status lesson to lessonID=', lessonID, 'et sectionID=', sectionID, 'for course', course);
        return UsersDAO.updateLessonStatus(dbInfos, uid, course, sectionID, lessonID, 'notions');
    }

    /**
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @return {*}
     */
    async function getMedias(dbInfos, uid) {

        const userMailingInfos = await UsersDAO.getMailingInfo(dbInfos, uid);

        const result = ['email'];
        for(const media in userMailingInfos.medias) {
            result.push(media);
        }
        return result;
    }

    /**
     * Ajout d'un module à l'utilisateur, si ce module existe déjà on ne l'ajoute pas
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @param course
     * @param groupType
     * @param orderRef
     * @param lang
     * @param mailingInfo
     *
     * @returns {*} promise
     */
    async function addModuleIfNotExist(dbInfos, uid, course, groupType, orderRef, lang, mailingInfo) {
        const existingModule = await UsersDAO.getOneModule(dbInfos, uid, course);
        // L'utilisateur a déjà le module donc on n'y touche pas
        if(existingModule && existingModule !== true) {
            return null;
        }

        // Si l'utilisateur est en anonyme il peut y avoir une limite
        const user = await UsersDAO.getAuthUserById(dbInfos, uid);
        const isAnonymous = _isAnonymous(user);
        let maxStatus = null;
        if(isAnonymous) {
            const registration = await ConfigDAO.getRegistration(dbInfos);
            maxStatus = lodash.get(registration, 'anonymous.maxStatus');
        }

        // On construit les données du module
        const moduleData = await _buildModuleData(dbInfos, course, lang, {groupType: groupType, orderRef: orderRef}, mailingInfo, maxStatus);
        if(!moduleData) {
            Logger.error('Unable to build module data for user=', uid, 'and module=', course);
            throw new Error('Unable to build module data');
        }
        return UsersDAO.addModule(dbInfos, uid, course, moduleData);
    }

    /**
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param course
     * @param lang
     * @param buildData
     * @param mailingInfos
     * @param maxStatus
     * @returns {Promise.<*>}
     * @private
     */
    async function _buildModuleData(dbInfos, course, lang, buildData, mailingInfos, maxStatus) {
        const filePath = ResourcesSvc.getResourcesFilePath(dbInfos, course, lang, 'json/structure.json');
        const moduleDataStructure = JSON.parse(await UtilSvc.readFile(filePath));


        // Si on n' pas la structure du module on retourne directement
        if(!moduleDataStructure) {
            return null;
        }

        const defaultStructure = await ModulesDAO.getDefaultStructure(dbInfos);
        const moduleInfo = await ModulesDAO.getModule(dbInfos, course);

        // Liste des mails à envoyer
        let moduleStructure = defaultStructure;
        if (lodash.get(moduleInfo, 'config.moduleStructure')) {
            moduleStructure = lodash.get(moduleInfo, 'config.moduleStructure');
        }

        // Id du status auquel on initialise le user
        let initStatusId = 0;
        if (lodash.get(moduleInfo, 'config.initStatus.id')) {
            initStatusId = lodash.get(moduleInfo, 'config.initStatus.id');
        }

        // Récupération du status correspondant à l'id
        const initStatus = moduleStructure[initStatusId];

        // Déblocage des leçons situées avant l'id du premier mail à envoyer
        if (lodash.get(initStatus, 'lessonID')) {
            const unlockUntilLessonId = lodash.get(initStatus, 'lessonID');
            for (let lessonId = 0; lessonId <= unlockUntilLessonId; lessonId++) {
                const sectionId = UtilSvc.sectionIdWithLessonId(lessonId);
                moduleDataStructure['section_' + sectionId]['lesson_' + lessonId].status = L_TYPE_NOTION;
            }
        }

        const mailing = lodash.extend({}, mailingInfos, {status: initStatus}, {maxStatus: maxStatus || null});
        return {
            param: {
                group: buildData.groupType || null,
                orderRef: buildData.orderRef || null,
                lang: lang,
                startDate: new Date().getTime()
            },
            data: moduleDataStructure,
            mailing: mailing
        };

    }

    /**
     * Ajout d'un module non initialisé (à true) à un utilisateur
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant utilisateur
     * @param {string} course - identifiant du parcours
     *
     * @returns {*} promise
     */
    async function addNotInitModuleIfNotExist(dbInfos, uid, course) {
        const existingModule = await UsersDAO.getOneModule(dbInfos, uid, course);
        if(existingModule) {
            return null;
        }
        return UsersDAO.addModule(dbInfos, uid, course, true);
    }

    /**
     * Ajout d'un module non initialisé (à true) à un utilisateur
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant utilisateur
     * @param {string} course - identifiant du parcours
     * @param {{data: object, mailing: object, param: object}} courseData - Infos du parcours
     *
     * @returns {*} promise
     */
    async function addCourse(dbInfos, uid, course, courseData) {
        return UsersDAO.addModule(dbInfos, uid, course, courseData);
    }

    /**
     * Récupère un utilisateur en indiquant son adresse email
     *
     * @param {{subBase:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} email - email qu'on recherche
     *
     * @return {*} l'utilisateur au format  {uid: {infos: [...], modules: [...], [...]}
     */
    async function searchUserByMail(dbInfos, email) {
        const uid = await UsersDAO.getUserIdByMail(dbInfos, email);
        if(!uid) {
            return null;
        }
        const userData = await UsersDAO.getUserById(dbInfos, uid);
        const user = {};
        user[uid] = userData;
        return user;
    }

    /**
     * Récupère un utilisateur avec son ID
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid identifiant de l'utilisateur
     * @returns {*} - Utilisateur au format {uid: {firstname, lastname...}}
     */
    async function searchUserById(dbInfos, uid) {
        if(!uid) {
            return null;
        }

        const userData = await UsersDAO.getUserById(dbInfos, uid);
        if(!userData) {
            return null;
        }

        const user = {};
        user[uid] = userData;
        return user;
    }

    /**
     * Enregistre au niveau de l'utilisateur la référence de sa commande
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid identifiant de l'utilisateur
     * @param orderRef référence de commande
     * @param module module commandé
     */
    async function addOrder(dbInfos, uid, orderRef, module) {
        if(!uid || !orderRef) {
            return null;
        }
        return UsersDAO.createOrder(dbInfos, uid, orderRef, module);
    }


    /**
     * Ajout de la liste des "sponsor" (code cadeaux offerts)
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid
     * @param listGift
     */
    function addSponsor(dbInfos, uid, listGift) {
        const now = new Date().getTime();
        const data = {};
        for(let idx = 0; idx < listGift.length; idx++) {
            data[listGift[idx]] = now;
        }
        return UsersDAO.createSponsor(dbInfos, uid, data);
    }

    /**
     * Mise à jour des infos de l'utilisateur
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param uid identifiant de l'utilisateur
     * @param dataToUpdate les infos à mettre à jour
     *
     * @returns promise
     */
    function updateUserInfo(dbInfos, uid, dataToUpdate) {
        return UsersDAO.updateInfos(dbInfos, uid, dataToUpdate);
    }

    /**
     * @description Débloque toutes les leçons d'un parcours pour un utilisateur donné
     *
     * @param {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param {string} uid - identifiant utilisateur
     * @param {string} course - identifiant du parcours
     *
     * @returns {Promise} promise
     */
    async function unlockAllLessons(dbInfos, uid, course) {
        // 1 - Récupération du maxStatus, s'il est setté on balance une erreur 403
        const maxStatus = await UsersDAO.getMaxStatus(dbInfos, uid, course);
        if(maxStatus) {
            throw new AntisecheError({code: 'course/max-status', message: 'User ' + uid + ' can\'t unlock all lesson for course ' + course + ' because it has a maxStatus ' + JSON.stringify(maxStatus)});
        }

        // 2 - Récupération du nombre de sections public du parcours
        const nbSectionPublicPerModule = await ModulesDAO.getNbSectionPublic(dbInfos, course);

        // 3 - Récupération des infos du parcours pour l'utilisateur
        const moduleData = await UsersDAO.getOneModule(dbInfos, uid, course);
        if(!lodash.has(moduleData, 'data')) {
            throw new AntisecheError({code: 'course/no-data', message: 'There is no data for user ' + uid + ' and course ' + course});
        }

        // TODO @deprecated
        // 4 - On regarde s'il y a un groupe sur le parcours
        const group = await GroupsSvc.getGroupById(dbInfos, (lodash.get(moduleData, 'param.group') || null));
        if(lodash.has(group, TEASER_VAR_NAME)) {
            Logger.warning('Teaser limit detected when sending mail ');
            return {code: 'PAYMENT', msg: 'Teaser limit detected when sending mail '};
        }

        // 5 - On passe toutes les leçons non débloquées au statut débloqué et on enregistre la modification
        const lessonPerSection = lodash.get(Config, 'module.lessonPerSection');
        for (let lessonId = 0; lessonId < (lessonPerSection * nbSectionPublicPerModule); lessonId++) {
            const sectionId = UtilSvc.sectionIdWithLessonId(lessonId);
            if(moduleData.data['section_' + sectionId]['lesson_' + lessonId].status === lodash.get(Config, 'status.notion.locked')) {
                moduleData.data['section_' + sectionId]['lesson_' + lessonId].status = lodash.get(Config, 'status.notion.unlocked');
            }
        }
        await UsersDAO.updateModuleData(dbInfos, uid, course, moduleData.data);

        // 6 - On met à jour le status du parcours
        const status = {
            lessonType: lodash.get(Config, 'status.mail.finished'),
            lessonID: (lessonPerSection * nbSectionPublicPerModule) - 1,
            sectionID: nbSectionPublicPerModule - 1
        };
        return UsersDAO.updateMailing(dbInfos, uid, course, {status: status});
    }

    async function unlockNextLesson(dbInfos, uid, course) {
        try {

            // 1 - On récupère l'utilisateur
            const user = await UsersDAO.getUserById(dbInfos, uid);
            // 2 - On récupère la structure du module
            const defaultConfiguration = await DefaultConfigDAO.getConfig();
            const moduleStructure = lodash.get(await MessagerCollectSvc.getModulesStructure(dbInfos, lodash.get(defaultConfiguration, 'moduleStructure')), course);
            // 3 - On récupère le prochain status
            const nextStatus = await getNextStatus(dbInfos, uid, course, lodash.get(user, 'modules.' + course), moduleStructure);

            // 4 - On regarde si on est sur une notion de type 'anecdotes' pour savoir si on doit avancer "normalement"
            // ou si on doit avancer à la leçon suivante (en squizant les steps revision et quiz)
            const lessonType = lodash.get(nextStatus, 'lessonType');
            if((lessonType === lodash.get(Config, 'status.lesson.quiz')
                    || lessonType === lodash.get(Config, 'status.lesson.revision'))) {
                nextStatus.lessonType = 'anecdotes';
                nextStatus.lessonID++;
                nextStatus.sectionID++;
            }


            // On  vérifie que le status qu'on veut mettre existe bien dans la liste
            // Si on n'est pas sur les status de la fin (diplome et fini) on met à jour le status
            // et la leçon correspondante
            const idxNextStatus = getCourseStatusIndex(nextStatus, moduleStructure);
            if(lessonType !== lodash.get(Config, 'status.lesson.diploma')
                && lessonType !== lodash.get(Config, 'status.lesson.finished')
                && idxNextStatus && idxNextStatus !== -1) {
                await Promise.all([
                    markLessonAsSent(dbInfos, uid, course, nextStatus.sectionID, nextStatus.lessonID),
                    updateStatus(dbInfos, uid, course, nextStatus)
                ]);
            }

            return {code: 'NO_REDIRECT', msg: 'Lesson unlocked'};
        } catch(error) {
            // On récupère le code d'erreur
            const code = lodash.get(error, 'code') || error;
            switch(code) {
                // On est arrivé à la fin du parcours
                case 'course/status-higher':
                    return {code: 'NO_REDIRECT', msg: 'Lesson unlocked'};
                // Fin de l'essai gratuit
                case 'course/teaser-limit':
                    return {code: 'PAYMENT', msg: 'Teaser limit detected when sending mail '};

                // L'utilisateur n'a pas de status pour ce parcours
                // Le status n'a pas de correspondance
                default:
                    throw error;
            }
        }

    }

    /**
     * Retourne la liste de module récupéré en entrée, sans le maxStatus
     * @param {object} courseList - liste des modules
     * @returns {object} la liste des modules sans maxStatus
     */
    function removeAllCoursesMaxStatus(courseList) {
        const courseListCopy = courseList;
        for(const key in courseListCopy) {
            if(Object.prototype.hasOwnProperty.call(courseListCopy, key)) {
                lodash.set(courseListCopy[key], 'mailing.maxStatus', null);
            }
        }
        return courseListCopy;
    }

    function disableUser(dbInfos, uid, disableValue) {
        // mettre le user.infos.disable à la valeur
        return Promise.all([
            UsersDAO.updateInfos(dbInfos, uid, {disabled: disableValue}),
            UsersDAO.updateFirebaseUser(dbInfos, uid, {disabled: disableValue})
        ]);
        // mettre le user firebase à la valeur
    }


    async function deleteUserById(dbInfos, company, uid) {
        // 1 - On supprime les rôles de l'utilisateur
        await UsersDAO.deleteRoles(dbInfos, company, uid);
        Logger.warning('All roles deleted for uid', uid, 'in company', company, {uid: uid, company: company});

        // 2 - On supprime la partie analytics
        await AnalyticsDAO.removeUsersByUid(dbInfos, uid);
        Logger.warning('Analytics deleted for uid', uid, 'in company', company, {uid: uid, company: company});

        // 3 - On supprime la partie utilisateur
        await UsersDAO.removeUser(dbInfos, uid);
        Logger.warning('User deleted for uid', uid, 'in company', company, {uid: uid, company: company});

        // 4 - On regarde s'il reste des choses dans les rôles, si oui ça signifie que l'utilisateur
        //     est aussi dans une autre conf donc on ne supprime pas la partie Authentification
        const roles = await UsersDAO.getAllRoles(dbInfos, uid);
        if(!roles) {
            await UsersDAO.removeFirebaseUser(dbInfos, uid);
            Logger.warning('Auth deleted for uid', uid, 'in company', company, {uid: uid, company: company});
        }
    }

    /**
     * Nettoyage d'un utilisateur firebase
     * {{subBase:string, front:string}} dbInfos - infos de la base de données (example: {subBase: 'local-saas'})
     * @param email
     */
    async function cleanUserFirebase(dbInfos, email) {
        await _cleanAnalyticsByEmail(dbInfos, email);
        await _cleanPayments(dbInfos, email);
        await _cleanProspects(dbInfos, email);
        await _cleanRoles(dbInfos, email);
        // Retourne l'uid de l'utilisateurs
        return await _cleanUsers(dbInfos, email);
    }

    //
    // PRIVATE MEMBERS
    //
    async function _cleanUsers(dbInfos, email) {
        // On récupère tous les utilisateurs
        const users = await UsersDAO.getUsers(dbInfos, {});
        const promises = [];

        let _resUID = null;
        for(const uid in users) {
            if(Object.prototype.hasOwnProperty.call(users, uid)) {
                const user = users[uid];
                if(user.infos && user.infos.email === email) {
                    _resUID = uid;
                    promises.push(UsersDAO.removeUser(dbInfos, uid));
                    promises.push(UsersDAO.removeFirebaseUser(dbInfos, uid));
                }
            }
        }
        Logger.info('Users cleaned for ' + email);
        await Promise.all(promises);
        return _resUID;
    }

    async function _cleanPayments(dbInfos, email) {
        // On récupère tous les pendigns et tous les orders
        const arrayData = await Promise.all([
            PaymentsDAO.getOrders(dbInfos),
            PaymentsDAO.getPendings(dbInfos)
        ]);
            // .then(function(arrayData) {
        const orders = arrayData[0],
            pendings = arrayData[1],
            promises = [];

        // Suppression des orders
        for(const ordKey in orders) {
            if(orders.hasOwnProperty(ordKey)) {
                const order = orders[ordKey];
                if(order.email === email) {
                    promises.push(PaymentsDAO.removeOrder(dbInfos, ordKey));
                }
            }
        }

        // Suppression des pendings
        for(const pendKey in pendings) {
            if(pendings.hasOwnProperty(pendKey)) {
                const pending = pendings[pendKey];
                if(pending.email === email) {
                    promises.push(PaymentsDAO.removePending(dbInfos, pendKey));
                }
            }

        }
        return Promise.all(promises);
        // });
    }


    async function _cleanProspects(dbInfos, email) {
        // On récupère tous les prospects
        const prospects = await ProspectsDAO.getProspects(dbInfos);
        const promises = [];

        for(const module in prospects) {
            if(prospects.hasOwnProperty(module)) {
                for(const emailKey in prospects[module]) {
                    if(prospects[module].hasOwnProperty(emailKey) && UtilSvc.addDot(emailKey) === email) {
                        promises.push(ProspectsDAO.removeProspect(dbInfos, module, emailKey));
                    }
                }
            }
        }
        return Promise.all(promises);
    }


    async function _cleanAnalyticsByEmail(dbInfos, email) {
        const uid = await UsersDAO.getUserIdByMail(dbInfos, email);
        return await Promise.all([
            AnalyticsDAO.removeUsersByEmail(dbInfos, email),
            AnalyticsDAO.removeUsersByUid(dbInfos, uid)
        ]);

    }

    async function _cleanRoles(dbInfos, email) {
        const uid = await UsersDAO.getUserIdByMail(dbInfos, email);
        return UsersDAO.deleteAllRoles(dbInfos, uid);
    }

    function _isAnonymous(user) {
        return !user.email
            && (!user.providerData || user.providerData.length === 0);
    }

})();