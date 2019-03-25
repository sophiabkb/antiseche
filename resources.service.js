(function() {
    'use strict';

    // External dependecies
    const lodash = require('lodash');
    const path = require('path');
    const Promise = require('promise');

    // Internal dependencies
    const Config = require('../core/conf.core').config;
    const Logger = require('../core/logger.core');

    const ModulesDAO = require('../dao/modules.dao');
    const ResourcesDAO = require('../dao/resources.dao');
    const UtilSvc = require('./util.service');
    // error
    const AntisecheError = require('./errors/antiseche.error');
    const FileExistError = require('./errors/file-exist.error');

    const LOCAL_FOLDER = Config.file.local ? Config.file.local.baseFolder : null;
    const ASSET_FOLDER = 'assets';

    module.exports = {
        getFile: ResourcesDAO.getFile,
        setFile: ResourcesDAO.setFile,
        readDir: ResourcesDAO.readDir,
        getResourcesFilePath: getResourcesFilePath,
        writeResourceFile: writeResourceFile,
        listResourcesDir: listResourcesDir,
        uploadImage: uploadImage,
        uploadImageSaas: uploadImageSaas,
        uploadLogo: uploadLogo,
        uploadDashboardModuleImage: uploadDashboardModuleImage,
        determineFileModulePath: determineFileModulePath,
        publishCourse: publishCourse,
        checkChangeStatus: checkChangeStatus,
        listResourcesDirSaas: listResourcesDirSaas
    };

    function getResourcesFilePath(dbInfos, module, lang, filePath) {
        const rscPath = determineFileModulePath(dbInfos.subBase, module, filePath);
        return ResourcesDAO.getFile(rscPath);
    }

    function writeResourceFile(dbInfos, module, lang, filePath, data) {
        const rscPath = determineFileModulePath(dbInfos.subBase, module, filePath);
        return ResourcesDAO.setFile(rscPath, data);
    }

    function listResourcesDir(dbInfos, module, lang, filePath) {
        const rscPath = determineFileModulePath(dbInfos.subBase, module, filePath);
        return ResourcesDAO.readDir(rscPath);
    }

    function listResourcesDirSaas(dbInfos, filePath) {
        const rscPath = _determineAssetSaasPath(dbInfos.subBase, filePath);
        return ResourcesDAO.readDir(rscPath);
    }

    async function uploadImage(dbInfos, module, lang, dirPath, fileName, ext, imagesSizeSuffix, type, picture) {
        const checkPath = [];
        const promises = [];
        let rscPath = null;
        let rscPathSecondMain = null;

        // 2 - On récupère le chemin de base pour enregistrer la ou les images
        rscPath = determineFileModulePath(dbInfos.subBase, module, dirPath);
        if (type === 'anecdote') {
            const dirPathSecondMain = _removeLastDirectoryPartOf(dirPath);
            rscPathSecondMain = determineFileModulePath(dbInfos.subBase, module, dirPathSecondMain);
        }
        // 3 - On vérifie que l'image n'existe pas déjà sauf si on est sur anecdote
        let fn = null;
        if((type !== 'anecdote') && (type !== 'background')) {
            for(let i = 0; i < imagesSizeSuffix.length; i++) {
                const imgPath = path.join(rscPath, fileName + imagesSizeSuffix[i].suffix + '.' + ext);
                checkPath.push(UtilSvc.fileExist(path.join(LOCAL_FOLDER, imgPath)));
            }
            fn = Promise.all(checkPath);
        } else {
            fn = Promise.resolve([]);
        }
        const fileExistError = await fn; // .then(function(fileExistError) {
        if(lodash.compact(fileExistError).length > 0) {
            return Promise.reject(new FileExistError('File already exist', fileExistError));
        }
        // 4 - On Enregistre les images si on n'a pas d'erreurs
        for(let i = 0; i < imagesSizeSuffix.length; i++) {
            const imgPath = path.join(rscPath, fileName + imagesSizeSuffix[i].suffix + '.' + ext);
            promises.push(ResourcesDAO.saveImage(picture.path, {method: 'scale', width: imagesSizeSuffix[i].size.width, height: imagesSizeSuffix[i].size.height}, imgPath));
        }
        // 5 - On Enregistre la petite main image dans le cas de l'anecdote, qui doit être enregistrée dans le dossier parent
        if (type === 'anecdote' && fileName === 'main') {
            const imgPathSecondMain = path.join(rscPathSecondMain, fileName + '.' + ext);
            promises.push(ResourcesDAO.saveImage(picture.path, {method: 'fit', width: 135, height: 90}, imgPathSecondMain));
        }

        return Promise.all(promises);
    }

    async function uploadImageSaas(dbInfos, fileName, ext, picture, type, lang) {

        // 1 - On récupère le chemin du dossier assets/img
        const clientDirectory = path.join(dbInfos.subBase, ASSET_FOLDER);
        let imgDirectory = path.join(clientDirectory, 'img');

        // 2 - On vérifie que le dossier content/client/assets/img existe et le cas échéant on le créé
        const directoryExist = await UtilSvc.directoryExist(path.join(LOCAL_FOLDER, imgDirectory));
        if (!directoryExist) {
            await UtilSvc.createDir(path.join(LOCAL_FOLDER, imgDirectory));
        }

        // 3 - On vérifie que le dossier content/client/assets/img/type existe et le cas échéant on le créé (optionnel)
        if (type){
            const typeDirectoryExist =  await UtilSvc.directoryExist(path.join(LOCAL_FOLDER, imgDirectory, type));
            if (!typeDirectoryExist) {
                await UtilSvc.createDir(path.join(LOCAL_FOLDER, imgDirectory, type));
            }
            imgDirectory = path.join(imgDirectory, type);
        }

        // 4 - On vérifie que le dossier content/client/assets/img/type/lang existe et le cas échéant on le créé (optionnel)
        if (type && lang){
            const langDirectoryExist =  await UtilSvc.directoryExist(path.join(LOCAL_FOLDER, imgDirectory, lang));
            if (!langDirectoryExist) {
                await UtilSvc.createDir(path.join(LOCAL_FOLDER, imgDirectory, lang));
            }
            imgDirectory = path.join(imgDirectory, lang);
        }

        const imgPath = path.join(imgDirectory, fileName + '.' + ext);
        const resize = {method: 'fit', width: picture.width, height: picture.height};

        // 5 - On enregistre l'image
        await ResourcesDAO.saveImage(picture.path, resize, imgPath);
        // 6 - On renvoie le path de l'image
        return path.join('content', imgPath);
    }

    function _removeLastDirectoryPartOf(url) {
        const arr = url.split('/');
        arr.pop();
        return(arr.join('/'));
    }


    async function uploadLogo(dbInfos, logo) {
        // Chemins des dossiers
        const clientDirectory = dbInfos.subBase ? path.join(dbInfos.subBase, ASSET_FOLDER) : path.join(ASSET_FOLDER);
        const logoDirectory = path.join(clientDirectory, 'img');
        const logoPath = path.join(logoDirectory, 'logo.png');
        // let confLogoPath = path.join('resources', logoPath.replace('modules', 'assets'));
        const confLogoPath = path.join('content', logoPath);
        // Taille du logo
        const resize = {method: 'fit', width: 300, height: 150};
        // Stockage temporaire en png
        const tmpPath = path.join(__dirname, '..', 'tmp', 'img', UtilSvc.generateId());

        // 1 - On vérifie que le dossier /content/modules/ ou /content/client/mdoules existe et le cas échéant on le créé
        const exist = await UtilSvc.directoryExist(path.join(LOCAL_FOLDER, clientDirectory));
        if(!exist) {
            await UtilSvc.createDir(path.join(LOCAL_FOLDER, clientDirectory));
        }

        // 2 - On vérifie que le dossier resources/assets/img ou resources/client/assets/img existe et le cas échéant on le créé
        const existLogo = await UtilSvc.directoryExist(path.join(LOCAL_FOLDER, logoDirectory));
        if(!existLogo) {
            await UtilSvc.createDir(path.join(LOCAL_FOLDER, logoDirectory));
        }

        // 3 - On stock temporairement l'image en png
        await UtilSvc.writeFile(tmpPath, logo.replace(/^data:image\/png;base64,/, ''), 'base64');

        // 4 - On enregsitre et on retaille l'image au bon endroit
        await ResourcesDAO.saveImage(tmpPath, resize, logoPath);

        // 5 - On renvoie le chemin du logo
        return confLogoPath;
    }

    async function uploadDashboardModuleImage(dbInfos, module, logo) {
        const randomNb = Math.floor((Math.random() * 10) + 1);
        let logoPath;
        if(dbInfos.subBase) {
            logoPath = path.join(dbInfos.subBase, 'modules', module, 'img', 'dashboard-' + randomNb + '.jpg');
        } else {
            // @deprecated
            logoPath = path.join('modules', module, 'img', 'dashboard-' + randomNb + '.jpg');
        }
        const confLogoPath = path.join('content', logoPath);

        const resize = {method: 'fit', width: 328, height: 223};

        const imgLogo = logo.replace(/^data:image\/png;base64,/, '');

        const tmpPath = path.join(__dirname, '..', 'tmp', 'img', UtilSvc.generateId());

        await UtilSvc.writeFile(tmpPath, imgLogo, 'base64');
        await ResourcesDAO.saveImage(tmpPath, resize, logoPath);
        await ModulesDAO.updateModuleDraft(dbInfos, module, {image: confLogoPath});
        return confLogoPath;
    }

    function determineFileModulePath(subdomain, module, rscPath, addContent) {
        let subPath = path.join('modules', module, rscPath);
        if(subdomain) {
            subPath = path.join(subdomain, 'modules', module, rscPath);
        }
        return (addContent ? path.join(LOCAL_FOLDER, subPath) : subPath);
    }

    async function publishCourse(dbInfos, courseIdDraft, courseId) {
        // 1 - On récupère les paths du dossier du parcours "draft" et du dossier "prod"
        const draftDirPath = path.join(LOCAL_FOLDER, determineFileModulePath(dbInfos.subBase, courseIdDraft, ''));
        const dirPath = path.join(LOCAL_FOLDER, determineFileModulePath(dbInfos.subBase, courseId, ''));

        // 2 - On vérifie que le dossier dossier du parcours "prod" existe et le cas échéant on le créé
        const dirExist = await UtilSvc.directoryExist(dirPath);
        if(!dirExist) {
            await UtilSvc.createDir(dirPath);
        }

        // 3 - On parcours les dossiers de destination
        for(let idx = 0; idx < Config.module.folderList.length; idx++) {
            // 3.1 - On créé les dossiers de destination pour les images
            const folderInfo = Config.module.folderList[idx];
            const folderPath = path.join(dirPath, folderInfo.path);
            const folderDraftPath = path.join(draftDirPath, folderInfo.path);
            const existDraft = await UtilSvc.directoryExist(folderDraftPath);
            const exist = await UtilSvc.directoryExist(folderPath);
            if(!exist && existDraft) {
                await UtilSvc.createDir(folderPath);
            }

            // 3.2 - On recopie les donées en minifiant les fichiers
            let fn = null;
            switch (folderInfo.type) {
                case 'json':
                    fn = ResourcesDAO.copyJsonFolder(folderDraftPath, folderPath);
                    break;
                case 'img':
                    fn = ResourcesDAO.copyImageFolder(folderDraftPath, folderPath);
                    break;
                case 'audio':
                    if (existDraft) {
                        fn = ResourcesDAO.copyAudioFolder(folderDraftPath, folderPath);
                    }
                    break;
                case 'html':
                    if (existDraft) {
                        fn = ResourcesDAO.copyHtmlFolder(folderDraftPath, folderPath);
                    }
                    break;
            }
            await fn;
        }
    }

    async function checkChangeStatus(dbInfos, course, lang) {
        let errors = [];
        // 1 - On récupère le parcours dans modulesDraft
        const courseInfo = await ModulesDAO.getModuleDraft(dbInfos, course);
        const nbSection = await ModulesDAO.getDraftNbSectionPublic(dbInfos, course);

        // 2 - On vérifie toutes les leçons en regardant ce qui est contenu dans les json
        const lessonPromise = [];
        for(let idx = 0; idx < nbSection * Config.module.lessonPerSection; idx++) {
            lessonPromise.push(_checkLessonJson(dbInfos.subBase, course, lang, idx));
        }
        errors = errors.concat(lodash.flatten(await Promise.all(lessonPromise)));

        // 3 - On vérifie les json du quiz
        const quizPromise = [];
        for(let idx = 0; idx < nbSection; idx++) {
            quizPromise.push(_checkQuiz(dbInfos.subBase, course, lang, idx));
        }
        errors = errors.concat(lodash.flatten(await Promise.all(quizPromise)));

        // 4 - Vérifier qu'on a les json associés aux features
        if(lodash.get(courseInfo, 'feature.notionEnd')) {
            errors = errors.concat(lodash.flatten(await _checkEndLesson(dbInfos.subBase, course, lang, nbSection)));
        }
        if(lodash.get(courseInfo, 'feature.source')) {
            errors = errors.concat(lodash.flatten(await _checkSource(dbInfos.subBase, course, lang)));
        }
        if(lodash.get(courseInfo, 'feature.writer')) {
            errors = errors.concat(lodash.flatten(await _checkWriter(dbInfos.subBase, course, lang)));
        }

        return errors;
    }

    async function _checkLessonJson(company, course, lang, lessonId) {
        const errors = [];
        const data = await UtilSvc.readJson(path.join(LOCAL_FOLDER, company, 'modules', course, 'json', lang, 'lessons', lessonId.toString(), 'data.json'));
        if(!lodash.get(data, 'anecdote.lesson_title')) {
            errors.push(new AntisecheError({
                code: 'course/check-src-anecdote-title',
                message: 'Missing warm-up title',
                extra: {
                    course: course,
                    lessonId: lessonId,
                    data: lodash.get(data, 'anecdote.lesson_title'),
                    label: 'course_rsc.anecdote_title',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(data, 'anecdote.content') || !lodash.get(data, 'anecdote.content.part1')) {
            errors.push(new AntisecheError({
                code: 'course/check-src-anecdote-content',
                message: 'Missing warm-up content',
                extra: {
                    course: course,
                    lessonId: lessonId,
                    data: lodash.get(data, 'anecdote.lesson_title'),
                    label: 'course_rsc.anecdote_content',
                    level: 'error'
                }
            }));
        }
        if(!lodash.get(data, 'notions.content') || lodash.get(data, 'notions.content').length === 0) {
            errors.push(new AntisecheError({
                code: 'course/check-src-lesson-content',
                message: 'Missing notion',
                extra: {
                    course: course,
                    lessonId: lessonId,
                    label: 'course_rsc.lesson_content',
                    level: 'error'
                }
            }));
        }
        return errors;
    }

    async function _checkQuiz(company, course, lang, section) {
        const errors = [];
        const data = await UtilSvc.readJson(path.join(LOCAL_FOLDER, company, 'modules', course, 'json', lang, 'quiz', section.toString() + '.json'));
        if(!data || data.length === 0) {
            errors.push(new AntisecheError({
                code: 'course/check-src-quiz',
                message: 'Missing description in firebase description',
                extra: {
                    course: course,
                    section: section,
                    label: 'course_rsc.quiz_content',
                    level: 'error'
                }
            }));
        }
        return errors;
    }

    async function _checkEndLesson(company, course, lang, nbSection) {
        const errors = [];
        const data = await UtilSvc.readJson(path.join(LOCAL_FOLDER, company, 'modules', course, 'json', lang, 'endLesson.json'));
        if(!data) {
            errors.push(new AntisecheError({
                code: 'course/check-src-end-lesson',
                message: 'Missing end lesson content',
                extra: {
                    course: course,
                    label: 'course_rsc.end_lesson_content',
                    level: 'error'
                }
            }));
        }
        if(data && data.length < ((nbSection * Config.module.lessonPerSection) - 1)) {
            errors.push(new AntisecheError({
                code: 'course/check-src-end-lesson-count',
                message: '',
                extra: {
                    course: course,
                    label: 'course_rsc.end_lesson_count',
                    level: 'error'
                }
            }));
        }
        return errors;
    }

    function _determineAssetSaasPath(subdomain, rscPath){
        return path.join(subdomain, 'assets', rscPath);
    }

    async function _checkSource(company, course, lang) {
        // TODO quand la modification de format aura été fait
        return [];
    }
    async function _checkWriter(company, course, lang) {
        // TODO quand la modification de format aura été fait
        return [];
    }
})();