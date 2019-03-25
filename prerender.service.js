(function () {
    'use strict';

    // External dependencies
    const lodash = require('lodash');

    // Internal dependencies
    // dao
    const ModulesDAO = require('../dao/modules.dao');
    // service
    const ConfigSvc = require('../services/config.service');

    // Interface du service
    exports.renderPage = renderPage;

    // Implémentation

    /**
     * @description Récupère le template global de la page
     *
     * @param {object} dbInfos - Information sur la base à requêter
     * @param {string} course - Identifiant du module
     *
     * @return {string} le html nécessaire pour donner les informations aux crawler
     */
    async function renderPage(dbInfos, course) {
        const langList = await ConfigSvc.getLangAvailable(dbInfos);
        const lang = langList[0];
        const meta = await ConfigSvc.getMeta(dbInfos);
        const courseInfo = await _getCourseInfos(dbInfos, course, lang);

        const metaData = _determineMeta(courseInfo, meta);
        const basePage = _getBaseTemplate();
        const fb = _getFacebookRender(metaData);
        const twitter = _getTwitterRender(metaData);
        const body = _getBodyRender(metaData);

        return basePage
            .replace('%LANG%', lang[0])
            .replace('%TITLE%', lodash.get(meta, 'title') || '')
            .replace('%DESCRIPTION%', lodash.get(meta, 'description') || '')
            .replace('%FACEBOOK%', fb || '')
            .replace('%TWITTER%', twitter || '')
            .replace('%BODY%', body || '');
    }

    /**
     * @description Récupération du template de base pour le pré-render des pages
     *
     * @returns {string} le code html
     * @private
     */
    function _getBaseTemplate() {
        return '<!DOCTYPE html><html lang="%LANG%"><head>'
            + '<title>%TITLE%</title>'
            + '<meta name="description" content="%DESCRIPTION%" >'
            + '%FACEBOOK%'
            + '%TWITTER%'
            + '</head><body>'
            + '%BODY%'
            + '</body></html>';
    }

    /**
     * @description Récupère les informations d'un module (en fonction de la langue et de la company)
     *
     * @param {object} dbInfos - Infos de base de données
     * @param {string} dbInfos.subBase - Nom de la company
     * @param {string} course - identifiant du parcours
     * @param {string} lang - langue sélectionnée
     * @returns {Promise.<void>} - les données du module en fonction de la langue choisi
     * @private
     */
    async function _getCourseInfos(dbInfos, course, lang) {
        if(!course) {
            return {};
        }

        const courseInfo = await ModulesDAO.getModule(dbInfos, course);
        const courseStdInfo = await ModulesDAO.getStandardModule(dbInfos, lang, course);
        const merged = lodash.merge({}, courseStdInfo, courseInfo);
        return lodash.merge({}, merged, lodash.get(merged, 'lang.' + lang));
    }

    /**
     * @description Mixe les infos du parcours ainsi que les meta pour obtenir quelque chose de plus précis
     *
     * @param {object} courseInfo - Donées de description du parcours
     * @param {object} meta - Méta dans firebase
     * @returns {*} le mix entre les 2 données
     * @private
     */
    function _determineMeta(courseInfo, meta) {
        if(!courseInfo) {
            return meta;
        }
        const result = {};
        result.title = lodash.has(courseInfo, 'name') ? lodash.get(courseInfo, 'name') : lodash.get(meta, 'title');
        result.description = lodash.has(courseInfo, 'teaser1') ? lodash.get(courseInfo, 'teaser1') : lodash.get(meta, 'description');
        result.url = lodash.get(meta, 'url') + (courseInfo ? ('module?module=' + lodash.get(courseInfo, 'id')) : '');
        result.facebook = {
            image: {
                url: lodash.has(courseInfo, 'image') ? (lodash.get(meta, 'url') + lodash.get(courseInfo, 'image')) : lodash.get(meta, 'facebook.image.url'),
                width: lodash.get(meta, 'facebook.image.width'),
                height: lodash.get(meta, 'facebook.image.height')
            }
        };
        result.twitter = {
            site: lodash.get(meta, 'twitter.site'),
            image: lodash.has(courseInfo, 'image') ? (lodash.get(meta, 'url') + lodash.get(courseInfo, 'image')) : lodash.get(meta, 'twitter.image')
        };
        return result;
    }

    /**
     * @description Génère les meta données pour facebook
     *
     * @param {object} meta - Méta données
     * @returns {string} les méta remplacés
     * @private
     */
    function _getFacebookRender(meta) {
        let tpl = '<meta property="og:title" content="%TITLE%">'
            + '<meta property="og:site_name" content="%SITE_NAME%">'
            + '<meta property="og:type" content="website">'
            + '<meta property="og:description" content="%DESCRIPTION%">';
        if(lodash.has(meta, 'url')) {
            tpl += '<meta property="og:url" content="%URL%">';
        }
        if(lodash.has(meta, 'facebook.image.url')) {
            tpl += '<meta property="og:image" content="%IMG_URL%">';
        }
        if(lodash.has(meta, 'facebook.image.width')) {
            tpl += '<meta property="og:image:width" content="%IMG_WIDTH%">';
        }
        if(lodash.has(meta, 'facebook.url.height')) {
            tpl += '<meta property="og:image:height" content="%IMG_HEIGHT%">';
        }


        return tpl.replace('%TITLE%', lodash.get(meta, 'title'))
            .replace('%SITE_NAME%', lodash.get(meta, 'title'))
            .replace('%DESCRIPTION%', lodash.get(meta, 'description'))
            .replace('%URL%', lodash.get(meta, 'url'))
            .replace('%IMG_URL%', lodash.get(meta, 'facebook.image.url'))
            .replace('%IMG_WIDTH%', lodash.get(meta, 'facebook.image.width'))
            .replace('%IMG_HEIGHT%', lodash.get(meta, 'facebook.image.height'));
    }

    /**
     * @description Génère les meta données pour twitter
     *
     * @param {object} meta - Méta données
     * @returns {string} les méta remplacés
     * @private
     */
    function _getTwitterRender(meta) {
        let tpl = '<meta name="twitter:card" content="summary">'
            + '<meta name="twitter:url" content="%URL%">'
            + '<meta name="twitter:title" content="%TITLE%">'
            + '<meta name="twitter:text:title" content="%TEXT_TITLE%">'
            + '<meta name="twitter:description" content="%DESCRIPTION%">';

        if(lodash.has(meta, 'twitter.site')) {
            tpl += '<meta name="twitter:site" content="%SITE%">';
        }
        if(lodash.has(meta, 'twitter.image')) {
            tpl += '<meta name="twitter:image" content="%IMAGE%">';
            tpl += '<meta name="twitter:image:src" content="%IMAGE_SRC%">';
        }

        return tpl.replace('%TITLE%', lodash.get(meta, 'title'))
            .replace('%TEXT_TITLE%', lodash.get(meta, 'title'))
            .replace('%DESCRIPTION%', lodash.get(meta, 'description'))
            .replace('%URL%', lodash.get(meta, 'url'))
            .replace('%SITE%', lodash.get(meta, 'twitter.site'))
            .replace('%IMAGE%', lodash.get(meta, 'twitter.image'))
            .replace('%IMAGE_SRC%', lodash.get(meta, 'twitter.image'));

    }

    function _getBodyRender() {
       return 'Prerender';
    }
})();