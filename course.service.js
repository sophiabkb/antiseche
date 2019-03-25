(function () {
    'use strict';

    // External dependencies
    const lodash = require('lodash');
    const path = require('path');

    // Internal dependencies
    // core
    const Config = require('../core/conf.core').config;
    const Logger = require('../core/logger.core');
    // dao
    const ModulesDAO = require('../dao/modules.dao');
    const ResourcesDAO = require('../dao/resources.dao');
    // error
    const AntisecheError = require('./errors/antiseche.error');
    // service
    const UtilSvc = require('./util.service');


    const DEFAULT_COURSE = {
        order: 100,
        feature: {
            pdf: false,
            writer: false,
            source: false,
            titleText: true,
            notionEnd: false
        },
        lang: {
            fr: {
                status: 'DRAFT'
            }
        }
    };
    const CONTENT_FOLDER = 'content';


    // Interface du service
    exports.createCourse = createCourse;
    exports.updateDraftCourse = ModulesDAO.updateModuleDraft;
    exports.updateCourseStatus = ModulesDAO.updateModuleDraftStatus;
    exports.updateCourseDraftStatusForAllLang = updateCourseDraftStatusForAllLang;
    exports.publishCourse = publishCourse;
    exports.checkChangeStatus = checkChangeStatus;
    exports.deleteCourse = deleteCourse;

    // Implémentation

    /**
     *
     * @param dbInfos
     * @param course
     * @param courseInfo
     * @return {Promise.<void>}
     */
    async function createCourse(dbInfos, course, courseInfo) {
        let confDashboardModuleImagePath;

        if(dbInfos.subBase) {
            confDashboardModuleImagePath = path.join(CONTENT_FOLDER, dbInfos.subBase, 'modules', course, 'img', 'dashboard.jpg');
        } else {
            confDashboardModuleImagePath = path.join(CONTENT_FOLDER, 'modules', course, 'img', 'dashboard.jpg');
        }

        const mergedCourseInfo = lodash.merge({}, DEFAULT_COURSE, courseInfo, {image: confDashboardModuleImagePath});

        const nbSection = lodash.get(courseInfo, 'config.nbSection') || Config.module.sectionPerModule;

        Logger.info('Trying to create course', course, 'for company', dbInfos.subBase);

        // Création du dossier du module
        await ResourcesDAO.createRscModule(dbInfos.subBase, course, nbSection);

        Logger.info('Folder for', course, 'in company', dbInfos.subBase, 'has been created');

        // Création des infos du module dans Firebase
        await ModulesDAO.createModuleDraft(dbInfos, course, mergedCourseInfo);

        return mergedCourseInfo;
    }

    /**
     * @description Change le statut d'un module (_draft) pour toutes les langues disponibles
     *
     * @param {{sbuBase: string}} dbInfos - Infos de connexions à la bas de données
     * @param {string} course - Identifiant du parcours
     * @param {string} status - Nouveau status
     *
     * @returns {Promise<*>} Resolve si succeed
     */
    async function updateCourseDraftStatusForAllLang(dbInfos, course, status) {
        // 1 - On récupère le parcours dans son intégralité
        const courseData = await ModulesDAO.getModuleDraft(dbInfos, course);
        if(!courseData) {
            throw new AntisecheError({
                code: 'course/no-data',
                message: 'No courseData found for course ID ' + course,
                extra: {
                    course: course
                }
            });
        }

        // 2 - On récupère la liste des langues disponibles
        const langData = lodash.get(courseData, 'lang');
        const langs = Object.keys(langData);

        // 3 - On met à jour le status pour toutes les langues
        const promises = [];
        for(let idx = 0; idx < langs.length; idx++) {
            promises.push(ModulesDAO.updateModuleDraftStatus(dbInfos, langs[idx], course, {status: status}));
        }
        return Promise.all(promises);
    }

    async function publishCourse(dbInfos, courseIdDraft, courseId) {

        // 1 - On récupère le parcours dans "modulesDraft", pour le recopier dans "modules
        const courseDraft = await ModulesDAO.getModuleDraft(dbInfos, courseIdDraft);
        courseDraft.id = courseId;
        // 2 - Les chemins des images doivent être modifiés
        if (lodash.get(courseDraft, 'image')) {
            courseDraft.image = courseDraft.image.replace(courseId + '_draft', courseId);
        }
        if (lodash.get(courseDraft, 'imageRow')) {
            courseDraft.image = courseDraft.image.replace(courseId + '_draft', courseId);
        }
        await ModulesDAO.updateModule(dbInfos, courseId, courseDraft);
    }


    async function checkChangeStatus(dbInfos, course, lang) {
        const errors = [];
        // 1 - On récupère le parcours dans modulesDraft
        const courseInfo = await ModulesDAO.getModuleDraft(dbInfos, course);
        const courseLangInfo = lodash.get(courseInfo, 'lang.' + lang);

        // 2 - On vérifie qu'on a bien : un id, une image + sous la langue : un nom, un teaser 1, une description
        if(!lodash.get(courseInfo, 'id')) {
            errors.push(new AntisecheError({
                code: 'course/check-id',
                message: 'Missing id in firebase description',
                extra: {
                    course: course,
                    data: lodash.get(courseInfo, 'id'),
                    label: 'course.missing_id',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(courseInfo, 'image')) {
            errors.push(new AntisecheError({
                code: 'course/check-image',
                message: 'Missing image in firebase description',
                extra: {
                    course: course,
                    data: lodash.get(courseInfo, 'image'),
                    label: 'course.missing_image',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(courseLangInfo, 'name')) {
            errors.push(new AntisecheError({
                code: 'course/check-name',
                message: 'Missing name in firebase description',
                extra: {
                    course: course,
                    data: lodash.get(courseLangInfo, 'name'),
                    label: 'course.missing_name',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(courseLangInfo, 'description')) {
            errors.push(new AntisecheError({
                code: 'course/check-description',
                message: 'Missing description in firebase description',
                extra: {
                    course: course,
                    data: lodash.get(courseLangInfo, 'description'),
                    label: 'course.missing_description',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(courseLangInfo, 'teaser1')) {
            errors.push(new AntisecheError({
                code: 'course/check-teaser1',
                message: 'Missing teaser1 in firebase description',
                extra: {
                    course: course,
                    data: lodash.get(courseLangInfo, 'teaser1'),
                    label: 'course.missing_teaser1',
                    level: 'error'
                }
            }));
        }

        // 3 - On retourne les éventuelles erreurs
        return errors;
    }

    /**
     * Suppression d'un parcours (pas un parcours "_draft")
     *
     * @param {object} dbInfos - Données de la base
     * @param {string} course - Identifiant du parcours
     *
     * @returns {Promise<void>} Une promise qui resolve si ça fonctionne bien
     */
    async function deleteCourse(dbInfos, course) {
        const courseWithoutDraft = UtilSvc.strReplaceLast(course, '_draft', '');

        // 1 - Suppression dans firebase du parcours
        await ModulesDAO.deleteModule(dbInfos, courseWithoutDraft);

        // 2 - Suppression du dossier ressource
        await ResourcesDAO.deleteCourse(dbInfos.subBase, courseWithoutDraft);
    }

})();