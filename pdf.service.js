(function() {

    'use strict';

    // External dependencies
    const fs = require('fs');
    const path = require('path');
    const PDFDocument = require('pdfkit');
    const lodash = require('lodash');
    const sizeOf = require('image-size');

    // Own dependencies
    // core
    const Logger = require('./../core/logger.core.js');
    const Config = require('./../core/conf.core').config;
    // dao
    const UsersDAO = require('../dao/users.dao');
    const ResourcesSvc = require('../services/resources.service');

    // Template
    const antisecheTpl = require('../resources/template/antiseche.json');
    const diplomaTpl = require('../resources/template/diploma.json');
    const voucherTpl = require('../resources/template/voucher.json');

    // Interface
    module.exports = {
        generateAntisechePdfFile: generateAntisechePdfFile,
        generateDiplomaPdfFile: generateDiplomaPdfFile,
        processAntisechePdfName: processAntisechePdfName,
        processDiplomaPdfName: processDiplomaPdfName,
        generateVoucher: generateVoucher,
        deletePdf: deletePdf,
        deleteAllTmp: deleteAllTmp,
        getDownloadData: getDownloadData
    };


    /**
     * @description Fonction de génération du PDF de l'antisèche
     *
     * @param {object} dbInfos info de la base à requêter
     * @param {string} userId identifiant de l'utilisateur (utilisé pour le nom temporaire du PDF)
     * @param {string} userName nom de l'utilisateur
     * @param {string} module nom du mdoule
     * @param {string} lang langue de génération du PDF
     * @param {number} semaine semaine choisie
     * @param {number} lessons listes des leçons que l'utilisateur souhaite avoir dans le PDF
     * @param {string} requestId identifiant de la requête pour pouvoir logguer
     *
     * @return {*} une promise lorsque le traitement est fini
     */
    function generateAntisechePdfFile(dbInfos, userId, userName, module, lang, semaine, lessons, requestId) {
        return new Promise(function (resolve, reject) {
            const pdfDoc = new PDFDocument(antisecheTpl.page);
            const filePath = path.join(__dirname, '..', Config.pdf.workingDir, _processTmpPdfName(userId));
            const pdfStream = fs.createWriteStream(filePath, {defaultEncoding: 'utf8'});
            const lesLength = lessons.length;
            const headerPath = _getHeaderPath(dbInfos, module, lang);
            if(!_fileExist(headerPath)) {
                const msg = 'Header doesn\'t exist in path ' + headerPath;
                Logger.error(msg, {requestId: requestId});
                return reject(msg);
            }
            const headerSize = _getHeaderSizeNormallized(pdfDoc, sizeOf(headerPath));

            pdfDoc.pipe(pdfStream);

            // Génération du PDF
            let imgIdx = 0;
            for(let idx = 0; idx < lesLength; idx++) {
                const lesson = lodash.get(lessons, idx);

                // Check if image exist
                if(_imageExist(dbInfos, module, lang, lesson)) {

                    const is2ColImg = _is2ColImg(dbInfos, module, lang, lesson);

                    // Si on est au tout début, on ajoute le header pour la première page
                    if(imgIdx === 0) {
                        _addHeader(dbInfos, pdfDoc, headerSize, module, lang, semaine, userName, 1);
                    }

                    // Si on doit ajouter une image sur 2 colonnes et qu'on est sur un colonne de
                    // droite alors on repasse à la ligne
                    if(is2ColImg && imgIdx % 2 === 1) {
                        // Ici on ajoute le header si on arrive sur la dernière case parmis les 4 cases du documents
                        // car sinon avec le ++imgIdx qui suit on risque de sauter l'ajout d'une nouvelle page
                        if(imgIdx % 4 === 3) {
                            _addPage(pdfDoc);
                            _addHeader(dbInfos, pdfDoc, headerSize, module, lang, semaine, userName, ((imgIdx + 1) / 4) + 1);
                        }
                        ++imgIdx;
                    }

                    // Ajout de l'image
                    _addImg(dbInfos, pdfDoc, headerSize, module, lang, lesson, imgIdx % 4, is2ColImg);

                    // Add new page en new header
                    if(imgIdx % 4 === 3 && idx < (lesLength - 1)) {
                        _addPage(pdfDoc);
                        _addHeader(dbInfos, pdfDoc, headerSize, module, lang, semaine, userName, ((imgIdx + 1) / 4) + 1);
                    }

                    // Si on a ajouté une image sur 2 colonnes alors on passe 2 emplacements d'images
                    // au lieu d'un seul
                    if(is2ColImg) {
                        ++imgIdx;
                        // Ici on ajoute le header car on a pu arriverf à la fin de la page en ajoutant le ++imgIdx
                        if(imgIdx % 4 === 3 && (idx < lesLength - 1)) {
                            _addPage(pdfDoc);
                            _addHeader(dbInfos, pdfDoc, headerSize, module, lang, semaine, userName, ((imgIdx + 1) / 4) + 1);
                        }
                    }
                    ++imgIdx;
                } else {
                    Logger.error('There is a missing image for module ' + module + ' and lesson ' + lesson.lesson + ' and notion ' + lesson.item, {requestId: requestId});
                }
            }

            pdfDoc.end();

            pdfStream.on('close', function() {
                resolve(filePath);
            });
        });
    }

    /**
     * Fonction de génération du PDF Diplome
     *
     * @param module nom du mdoule
     * @param userId identifiant de l'utilisateur (utilisé pour le nom temporaire du PDF)
     * @param userFirstName prénom de l'utilisateur
     * @param userName nom de l'utilisateur
     * @param month mois d'obtention
     * @param year année d'obtention
     * @param nbNotions nombre de notions du module
     * @param mark note sur 20
     * @param requestId identifiant de la requête permettant d'identifier les call en cas d'appels en parallèle
     *
     * @return {*} une promise lorsque le traitement est fini
     */
    function generateDiplomaPdfFile(dbInfos, module, userId, userFirstName, userName, month, year, nbNotions, mark, lang, customization, requestId) {
        return new Promise(function (resolve, reject) {
            const pdfDiplomaDoc = new PDFDocument(diplomaTpl.page);
            const filePath = path.join(__dirname, '..', Config.pdf.workingDir, _processTmpPdfName(userId + '_diploma'));
            const pdfStream = fs.createWriteStream(filePath, {defaultEncoding: 'utf8'});

            // Génération du PDF
            pdfDiplomaDoc.pipe(pdfStream);


            // Check if image exist
            if (_imageBackgroundExist(dbInfos, module, diplomaTpl, lang)) {
                _addImgBackground(dbInfos, pdfDiplomaDoc, module, diplomaTpl, lang);
                _addUserName(pdfDiplomaDoc, userFirstName, userName);
                _addNbNotions(pdfDiplomaDoc, nbNotions);
                _addMark(pdfDiplomaDoc, mark);
                _addDates(pdfDiplomaDoc, month, year);

                if (customization && customization.logoCertificat && customization.logoCertificat.front) {
                    _addImgLogoPartner(pdfDiplomaDoc, customization.logoCertificat.front);
                }

            } else {
                // TODO gérer dans la partie API le retour de ça
                Logger.error('The diploma for module ' + module + ' is missing.', {requestId: requestId});
                return reject(); // On fait un reject car ça ne sert à rien de renvoyer un PDF vide
            }


            pdfDiplomaDoc.end();

            pdfStream.on('close', function () {
                resolve(filePath);
            });
        });
    }

    /**
     * Génération du nom du PDF de l'antisèche
     * @param moduleName nom du module
     * @param semaine numéro de la semaine
     * @return {string} le nom totale du PDF
     */
    function processAntisechePdfName(moduleName, semaine, lang) {
        let prefix = '';
        if (lang === 'fr') {
            prefix = 'MonAntiseche_';
        } else {
            prefix = 'MyStudyGuide_';
        }
        return prefix + moduleName + '_C' + (parseInt(semaine, 10) + 1) + '.pdf';
    }

    /**
     * Génération du nom du PDF diplome
     * @param moduleName nom du module
     * @param userFirstName prénom de l'utilisateur
     * @param userName nom de l'utilisateur
     * @return {string} le nom totale du PDF
     */
    function processDiplomaPdfName(moduleName, userFirstName, userName) {
        const userFirstNameWithoutAccent = userFirstName.replace(/[èéêë]/g, 'e');
        const userNameWithoutAccent = userName.replace(/[èéêë]/g, 'e');

        if (userName === 'undefined' || userName === '') {
            return 'Certificat_' + moduleName + '_' + userFirstNameWithoutAccent + '.pdf';
        }
        return 'Certificat_' + moduleName + '_' + userFirstNameWithoutAccent + '_' + userNameWithoutAccent + '.pdf';

    }

    /**
     * Génère le PDf du bon cadeau pour la plateforme d'e-Learning
     * @param module nom du module
     * @param voucherId reférence du bon cadeau
     * @param lang langue dans laquelle le PDF doit être généré
     * @param requestId identifiant de la requête pour pouvoir logguer
     * @returns {*|promise}
     */
    function generateVoucher(module, voucherId, lang, requestId) {
        return new Promise(function (resolve, reject) {
            const pdfVoucherDoc = new PDFDocument(voucherTpl.page);
            const filePath = path.join(__dirname, '..', Config.pdf.workingDir, _processTmpPdfName(voucherId + '_voucher'));
            const pdfStream = fs.createWriteStream(filePath, {defaultEncoding: 'utf8'});

            // Génération du PDF
            pdfVoucherDoc.pipe(pdfStream);

            // Check if image exist
            if (_imageBackgroundExist(module, voucherTpl, lang)) {
                _addImgBackground(pdfVoucherDoc, module, voucherTpl, lang);
                _addVoucherId(pdfVoucherDoc, voucherId);
                _addVoucherUrl(pdfVoucherDoc, Config.serverUrl + '#/gift?lang=' + lang);
            } else {
                Logger.error('The Voucher background for module ' + module + ' is missing.', {requestId: requestId});
                return reject(); // On fait un reject car ça ne serta à rien de renvoyer un PDF vide
            }

            pdfVoucherDoc.end();

            pdfStream.on('close', function () {
                resolve(filePath);
            });
        });
    }

    /**
     * Suppression du fichier pdf créé
     * @param pathToPdf Chemin vers le PDF
     */
    function deletePdf(pathToPdf) {
        fs.stat(pathToPdf, function (err) {
            if (err) {
                return Logger.error('Error checking if PDF exist', err);
            }
            fs.unlink(pathToPdf, function(errorUnlink) {
                if(errorUnlink) {
                    return Logger.error('Error deleting PDF', errorUnlink);
                }
            });

        });
    }

    /**
     * Supprime tous les fichier temporaires
     */
    function deleteAllTmp() {
        fs.readdir(path.join(__dirname, '..', Config.pdf.workingDir), function(err, files) {
            if(err) {
                Logger.error('Error deleting all tmp file', err);
            } else {
                Logger.debug('There is ', files.length, ' PDF to delete');
                for(const key in files) {
                    if(files.hasOwnProperty(key)) {
                        const pathFile = path.join(path.join(__dirname, '..', Config.pdf.workingDir, lodash.get(files, key)));
                        deletePdf(pathFile);
                    }
                }
            }
        });
    }

    // -----------------------------
    // PRIVATE MEMBER
    // -----------------------------

    /**
     * Ajout du header d'une page
     * @param pdfDoc document pdf
     * @param headerSize Taille du header dans le pdf
     * @param moduleName nom du module
     * @param lang langue du PDF
     * @param semaine numéro de la semaine
     * @param peopleName nom de la personne
     * @param pageNumber numéro de la page
     * @private
     */
    function _addHeader(dbInfos, pdfDoc, headerSize, moduleName, lang, semaine, peopleName, pageNumber) {

        // Add Image en-tête, on l'ajoute au milieu en haut de la page
        pdfDoc.image(_getHeaderPath(dbInfos, moduleName, lang), pdfDoc.page.margins.left, pdfDoc.page.margins.top,
            {'width': pdfDoc.page.width - (pdfDoc.page.margins.left + pdfDoc.page.margins.right)});

        let bonjourLabel = 'Bonjour ';
        let chapitreLabel = 'Chapitre ';
        if(lang.toLowerCase() === 'en') {
            bonjourLabel = 'Hello ';
            chapitreLabel = 'Chapter ';
        }

        // Add Bonjour
        // On test que le nom existe car sinon on a un "Bonjour null" => Pas top pour les gens
        if(peopleName) {
            pdfDoc
                .fontSize(antisecheTpl.header.fontSize)
                .text(bonjourLabel + peopleName, pdfDoc.page.width - (pdfDoc.page.margins.right + antisecheTpl.header.name.width),
                    pdfDoc.page.margins.top + headerSize.height - antisecheTpl.header.name.posY, {'width': antisecheTpl.header.name.width, 'align': antisecheTpl.header.name.align});

        }

        // Add page number
        pdfDoc
            .fontSize(antisecheTpl.header.fontSize)
            .text(chapitreLabel + (parseInt(semaine, 10) + 1) + ' - Page ' + pageNumber, pdfDoc.page.width - (pdfDoc.page.margins.right + antisecheTpl.header.page.width),
                pdfDoc.page.margins.top +  antisecheTpl.header.page.posY, {'width': antisecheTpl.header.page.width, 'align': antisecheTpl.header.page.align});

    }
    /**
     * Ajout d'un page sur le pdf
     * @param pdfDoc document pdf
     * @private
     */
    function _addPage(pdfDoc) {
        pdfDoc.addPage();
    }


    // -----------------------------
    // RECUPERATION DONNES
    // -----------------------------
    /**
     * Construction des données de téléchargement
     * @param userId
     * @param userName
     * @param lang
     * @param moduleName
     * @param section
     */
    function getDownloadData(dbInfos, userId, userName, lang, moduleName, section) {
        return UsersDAO.getLessons(dbInfos, userId, moduleName, 'section_' + section).then(function(lessons) {
            return _processLessonsForPdf(userId, userName, lang, moduleName, section, lessons);
        });
    }



    /**
     * Extrait toutes les notions
     * @param userId
     * @param userName
     * @param lang
     * @param moduleName
     * @param section
     * @param lessons
     * @returns {{userName: null, userId: *, module: *, section: *, items: Array}}
     * @private les infos nécessaire à la génération du PDF
     */
    function _processLessonsForPdf(userId, userName, lang, moduleName, section, lessons) {

        // On récupère les leçons de la section (semaine) voulue
        const items = [];
        const lessonsArray = [];
        for(let key in lessons) {
            if(lessons.hasOwnProperty(key) && key.indexOf(Config.lesson.prefix) !== -1) {
                lessonsArray.push(lodash.extend({}, lodash.get(lessons, key), {id: key}));
            }
        }
        lessonsArray.sort((a, b) => {
            const aIdx = parseInt(a.id.replace(Config.lesson.prefix, ''), 10);
            const bIdx = parseInt(b.id.replace(Config.lesson.prefix, ''), 10);
            return aIdx - bIdx;
        });
        for(let i = 0; i < lessonsArray.length; i++) {
            const lesson = lodash.get(lessonsArray, i);
            const lessonId = parseInt(lesson.id.replace(Config.lesson.prefix, ''), 10);
            for(let keyItem in lesson.notions) {
                if(lodash.get(lesson, 'notions.' + keyItem) === Config.lesson.inRevision) {
                    items.push({
                        lesson: lessonId,
                        item: keyItem
                    });
                }
            }
        }
        return {
            userName: userName,
            userId: userId,
            module: moduleName,
            section: section,
            lang: lang,
            items: items
        };
    }


    // -----------------------------
    // DIPLOMA _ PRIVATE MEMBER
    // -----------------------------
    /**
     * Ajout du nom et du prénom du user
     * @param pdfDoc document pdf
     * @param userFirstName prénom
     * @param userName nom
     * @private
     */
    function _addUserName(pdfDoc, userFirstName, userName) {
        if(userFirstName) {
            if (userName === 'undefined' || userName === '') {
                pdfDoc
                    .fontSize(diplomaTpl.name.fontSize)
                    .text(userFirstName, pdfDoc.page.width * diplomaTpl.name.posRateX, pdfDoc.page.height * diplomaTpl.name.posRateY, {width: pdfDoc.page.width, align: diplomaTpl.name.align});

            } else{
                pdfDoc
                    .fontSize(diplomaTpl.name.fontSize)
                    .text(userFirstName + '  ' + userName, pdfDoc.page.width * diplomaTpl.name.posRateX, pdfDoc.page.height * diplomaTpl.name.posRateY, {width: pdfDoc.page.width, align: diplomaTpl.name.align});
            }


        }
    }

    /**
     * Ajout du nombre de notions du module
     * @param pdfDoc document pdf
     * @param nbNotions
     * @private
     */
    function _addNbNotions(pdfDoc, nbNotions) {
        if(nbNotions) {
            pdfDoc
                .fontSize(diplomaTpl.nbNotions.fontSize)
                .text(nbNotions,  pdfDoc.page.width * diplomaTpl.nbNotions.posRateX, pdfDoc.page.height * diplomaTpl.nbNotions.posRateY, {width: diplomaTpl.nbNotions.width});

        }
    }
    /**
     * Ajout de la note du user
     * @param pdfDoc document pdf
     * @param mark note de l'utilisateur
     * @private
     */
    function _addMark(pdfDoc, mark) {
        if(mark) {
            pdfDoc
                .fontSize(diplomaTpl.mark.fontSize)
                .text(mark,  pdfDoc.page.width * diplomaTpl.mark.posRateX, pdfDoc.page.height * diplomaTpl.mark.posRateY, {width: diplomaTpl.mark.width});

        }
    }

    /**
     * Ajout des dates de suivi du cours
     * @param pdfDoc document pdf
     * @param month mois de passage du module
     * @param year année de passage du module
     * @private
     */
    function _addDates(pdfDoc, month, year) {
        if(month) {
            if (year) {
                pdfDoc
                    .fontSize(diplomaTpl.date.fontSize)
                    .text((month || '') + ' ' + (year || ''),  pdfDoc.page.width * diplomaTpl.date.posRateX, pdfDoc.page.height * diplomaTpl.date.posRateY, {width: diplomaTpl.date.width});
            }
        }
    }



    function _addImgLogoPartner(pdfDoc, imgPath) {
        if (imgPath) {
            const fullImgPath = path.join(lodash.get(Config, 'file.local.baseFolder'), '..', imgPath);

            if (_fileExist(fullImgPath)) {
                pdfDoc.image(fullImgPath, pdfDoc.page.width * diplomaTpl.logoImage.posRateX, pdfDoc.page.height * diplomaTpl.logoImage.posRateY, {width: diplomaTpl.logoImage.width});

            }
        }
    }


    /**
     * Ajout de la référence du bon cadeau au pdf
     * @param pdfDoc document pdf
     * @param voucherId référence du bon cadeau
     * @private
     */
    function _addVoucherId(pdfDoc, voucherId) {
        pdfDoc
            .fontSize(voucherTpl.voucherRef.fontSize)
            .fillColor('white')
            .text(voucherId,  pdfDoc.page.width * voucherTpl.voucherRef.posRateX, pdfDoc.page.height * voucherTpl.voucherRef.posRateY);
    }

    function _addVoucherUrl(pdfDoc, voucherUrl) {
        pdfDoc
            .fontSize(voucherTpl.voucherUrl.fontSize)
            .fillColor('white')
            .text(voucherUrl, pdfDoc.page.width * voucherTpl.voucherUrl.posRateX, pdfDoc.page.height * voucherTpl.voucherUrl.posRateY, {width: voucherTpl.voucherUrl.width, align: 'center'});
    }

    // -----------------------
    // IMAGE FUNCTIONS
    // -----------------------
    /**
     * Ajout d'une image dans le PDF
     * @param pdfDoc document PDF
     * @param headerSize Taille du header dans le pdf
     * @param moduleName nom du module
     * @param lang langue souhaité
     * @param lesson notion à ajouter
     * @param iModulo indice de l'image dans la page
     * @param is2ColImg indicateur d'une image sur 2 colonnes
     * @private
     */
    function _addImg(dbInfos, pdfDoc, headerSize, moduleName, lang, lesson, iModulo, is2ColImg) {
        const imgPath = _getImgPath(dbInfos, moduleName, lang, lesson);
        const imgPos = _getImgPos(pdfDoc, headerSize, iModulo);
        pdfDoc.image(imgPath, imgPos.width, imgPos.height, {width: _calcImageWidth(pdfDoc, is2ColImg)});
    }

    /**
     * Ajout d'une image background dans le PDF
     * @param pdfDoc document PDF
     * @param moduleName nom du module
     * @param template template du PDF à générer
     * @param lang lang du template
     * @private
     */
    function _addImgBackground(dbInfos, pdfDoc, moduleName, template, lang) {
        const imgPath = _getImgBackgroundPath(dbInfos, moduleName, template.backgroundImage.name, lang);
        pdfDoc.image(imgPath, template.backgroundImage.posX, template.backgroundImage.posY, {width: pdfDoc.page.width});
    }

    /**
     * Retourne la position d'une image par rapport au coin supérieur gauche
     * @param pdfDoc document PDF
     * @param headerSize Taille du header dans le pdf
     * @param iModulo indice de l'image dans la page
     * @return {{width: number, height: number}}
     * @private
     */
    function _getImgPos(pdfDoc, headerSize, iModulo) {
        const initY = pdfDoc.page.margins.top + headerSize.height + antisecheTpl.lesson.initY;
        const initX = pdfDoc.page.margins.left + antisecheTpl.lesson.initX;
        const midY = (pdfDoc.page.height / 2) + antisecheTpl.lesson.midY;
        const midX = (pdfDoc.page.width / 2) + (antisecheTpl.lesson.midX / 2);
        switch(iModulo) {
            case 0:
                return {width: initX, height: initY};
            case 1:
                return {width: midX, height: initY};
            case 2:
                return {width: initX, height: midY};
            case 3:
                return {width: midX, height: midY};
        }
    }

    /**
     * Calcul la largeur de l'image optimisée
     * @param pdfDoc document PDF
     * @param is2ColImg indicateur que l'image est sur 2 colonnes
     * @return {number} taille de la largeur de l'image
     * @private
     */
    function _calcImageWidth(pdfDoc, is2ColImg) {
        let width = (pdfDoc.page.width / 2) - (((pdfDoc.page.margins.left + pdfDoc.page.margins.right) / 2) + (antisecheTpl.lesson.initX + antisecheTpl.lesson.midX) / 2);
        if(is2ColImg) {
            width = pdfDoc.page.width - (pdfDoc.page.margins.left + pdfDoc.page.margins.right);
        }
        Logger.debug('The width of images are ', width, 'px');
        return width;
    }

    /**
     * Récupère le chemin de l'image à ajouter
     * @param dbInfos
     * @param moduleName nom du module
     * @param lang langue
     * @param lesson info sur la notion au format {lesson: number, item: number}
     * @return {string} le chemin de l'image
     * @private
     */
    function _getImgPath(dbInfos, moduleName, lang, lesson) {
        var pathInModuleFolder = path.join(Config.pdf.imageFolder, lang, lesson.lesson.toString(), lesson.item + antisecheTpl.lesson.imageExt);
        return ResourcesSvc.getResourcesFilePath(dbInfos, moduleName, lang, pathInModuleFolder);
    }

    /**
     * Récupère le chemin de l'image background à ajouter
     * @param moduleName nom du module
     * @param imgName nom de l'image
     * @param lang langue
     * @return {string} le chemin de l'image
     * @private
     */
    function _getImgBackgroundPath(dbInfos, moduleName, imgName, lang) {
        var pathInModuleFolder = path.join(Config.pdf.imageFolder, lang, Config.pdf.diplomaName);
        return ResourcesSvc.getResourcesFilePath(dbInfos, moduleName, lang, pathInModuleFolder);
    }

    /**
     * Indique si une image est au format large (sur 2 colonnes) en regardant si sa larageur est supérieure à sa hauteur
     * @param dbInfos
     * @param moduleName nom du module
     * @param lesson infos de la leçon de l'image
     * @return {boolean} vrai si l'image est une image sur 2 colonnes
     * @private
     */
    function _is2ColImg(dbInfos, moduleName, lang, lesson) {
        var size = sizeOf(_getImgPath(dbInfos, moduleName, lang, lesson));
        return size.width > size.height;
    }

    function _fileExist(path) {
        try {
            fs.statSync(path);
            return true;
        } catch(err) {
            return false;
        }
    }
    /**
     * Vérifie l'existence d'une image
     * @param dbInfos
     * @param moduleName le nom du module
     * @param lesson la leçon
     * @return {boolean} vrai si l'iamge existe, faux sinon
     * @private
     */
    function _imageExist(dbInfos, moduleName, lang, lesson) {
        return _fileExist(_getImgPath(dbInfos, moduleName, lang, lesson));
    }

    /**
     * Vérifie l'existence de l'image du diplome
     * @param moduleName le nom du module
     * @return {boolean} vrai si l'iamge existe, faux sinon
     * @private
     */
    function _imageBackgroundExist(dbInfos, moduleName, template, lang) {
        var imgpath = _getImgBackgroundPath(dbInfos, moduleName, template.backgroundImage.name, lang);
        try {
            fs.statSync(imgpath);
            return true;
        }
        catch(err) {
            return false;
        }
    }


    // -----------------------
    // HEADER FUNCTION
    // -----------------------
    /**
     * Chemin vers l'image du header
     * @param dbInfos
     * @param moduleName nom du module
     * @param lang langue du header
     * @return {*} la chaine de caractère du chemin
     * @private
     */
    function _getHeaderPath(dbInfos, moduleName, lang) {
        const pathInModuleFolder = path.join(Config.pdf.imageFolder, lang, Config.pdf.headerName);
        return ResourcesSvc.getResourcesFilePath(dbInfos, moduleName, lang, pathInModuleFolder);
    }
    /**
     * Récupère la taille du header tel qu'il sera affiché
     * @param pdfDoc document pdf
     * @param rawSize taille du header dans l'image
     * @return {{width : number, height: number}}
     * @private
     */
    function _getHeaderSizeNormallized(pdfDoc, rawSize) {
        const headerWidth = _calcHeaderWidth(pdfDoc);
        Logger.debug('Header width is', headerWidth);
        return {
            width: headerWidth,
            height: (headerWidth * rawSize.height) / rawSize.width
        };
    }
    /**
     * Calcule la largeur du header pour qu'il convienne au document
     * @param pdfDoc documennt pdf
     * @return {number} la taille du header
     * @private
     */
    function _calcHeaderWidth(pdfDoc) {
        return pdfDoc.page.width - (pdfDoc.page.margins.left + pdfDoc.page.margins.right)
    }

    // -----------------------
    // PDF FUNCTION
    // -----------------------
    /**
     * Génère le nom du PDF temporaire
     *
     * @param userId identifiant de l'utilisateur
     * @return {string} La concaténation de l'identifiant de l'utilistateur et du timestamp
     * @private
     */
    function _processTmpPdfName(userId) {
        return userId + '_' + (new Date()).getTime() + '.pdf';
    }

})();