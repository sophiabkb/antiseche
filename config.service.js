/* global require*/
(function () {
    'use strict';

    // External dependencies
    const lodash = require('lodash');

    // Internal dependencies
    const ConfigDAO = require('../dao/config.dao');
    const DefaultConfigDAO = require('../dao/default-config.dao');

    // Interface du service
    exports.getConfigForFront = getConfigForFront;
    exports.decrementLicense = decrementLicense;
    exports.getCustomizationColor = getCustomizationColor;
    exports.getRedirectLogout = getRedirectLogout;
    exports.getOAuthRedirectURI = getOAuthRedirectURI;
    exports.getMeta = getMeta;
    exports.getLangAvailable = getLangAvailable;
    exports.validateClientSecret = validateClientSecret;

    // Implémentation
    async function getConfigForFront(dbInfos) {
        // On récupère la configuration "normal" et la configuration par défaut
        const confConfig = await ConfigDAO.getConfig(dbInfos);
        const defaultConfig = await DefaultConfigDAO.getConfig(dbInfos);

        // On merge les 2 configs en priorisant la config "saas
        let config = lodash.merge(defaultConfig, confConfig);

        // On supprime toutes les données qui ne doivent pas être récupérés dans le front
        delete config.meta;
        delete config.api;
        delete config.facebookParameters;
        delete config.emailParameters;
        delete config.moduleStructure;
        // Registration parameters
        if(lodash.has(config, 'registration')) {
            delete config.registration.email;
            delete config.registration.emailSponsor;
            delete config.registration.nbSponsor;
            delete config.registration.unlimited;
            delete config.registration.whitelist;
            delete config.registration.lockEmails;
        }

        config = _deleteAuthFromConf(config);
        config = _deleteMainParamFromConf(config);

        // Partie éditor
        if(dbInfos.front === 'editor') {
            // Pour la liste des éléments disponibles dans l'éditeur on ne fait pas de merge
            if (lodash.get(config, 'editor.listElemNotion')) {
                config.editor.listElemNotion = lodash.get(confConfig, 'editor.listElemNotion') || lodash.get(defaultConfig, 'editor.listElemNotion');
            }
            if (lodash.get(config, 'editor.listImgNotion')) {
                config.editor.listImgNotion = lodash.get(confConfig, 'editor.listImgNotion') || lodash.get(defaultConfig, 'editor.listImgNotion');
            }
            if (lodash.get(config, 'editor.listMainIconoAnecdote')) {
                config.editor.listMainIconoAnecdote = lodash.get(confConfig, 'editor.listMainIconoAnecdote') || lodash.get(defaultConfig, 'editor.listMainIconoAnecdote');
            }
        } else {
            delete config.editor;
        }

        return config;
    }

    async function decrementLicense(dbInfos) {
        const registration = await ConfigDAO.getRegistration(dbInfos);
        if(registration && registration.remainingLicences > 0) {
            registration.remainingLicences--;
        }
        return ConfigDAO.updateRegistration(dbInfos, registration);
    }

    async function getCustomizationColor(dbInfos) {
        const customization = await ConfigDAO.getCustomization(dbInfos);
        return lodash.get(customization, 'color');
    }

    async function getRedirectLogout(dbInfos) {
        const feature = await ConfigDAO.getFeature(dbInfos);
        return lodash.get(feature, 'redirectLogout');
    }

    async function getOAuthRedirectURI(dbInfos) {
        const authentication = await ConfigDAO.getAuthentication(dbInfos);
        const oAuthConf = lodash.find(authentication.method, (a) => { return a.type === 'oauth';});
        return lodash.get(oAuthConf, 'redirectUri');
    }

    /**
     * @description Récupère les meta en faisant un merge entre la configuration
     *              par défaut et la configuration de la plateforme
     *
     * @param {Object} dbInfos - Information sur la partie de la base à requêter
     * @param {string} dbInfos.subBase - Nom de la company
     * @returns {Promise.<void>}
     */
    async function getMeta(dbInfos) {
        const defaultMeta = await DefaultConfigDAO.getMeta(dbInfos);
        const meta = await ConfigDAO.getMeta(dbInfos);
        return lodash.merge({}, defaultMeta, meta);
    }

    /**
     * @description Récupère la langue de la configuration
     *
     * @param {Object} dbInfos - Information sur la partie de la base à requêter
     * @param {string} dbInfos.subBase - Nom de la company
     * @returns {Promise.<void>}
     */
    async function getLangAvailable(dbInfos) {
        return ConfigDAO.getLangAvailable(dbInfos);
    }


    async function validateClientSecret(dbInfos, id, secret) {
        const apiKey = await ConfigDAO.getApiKey(dbInfos);
        return id === lodash.get(apiKey, 'id') && secret === lodash.get(apiKey, 'secret');
    }

    // PRIVATE

    /**
     * @description Supprime la partie "authentication" de la config pour ne pas qu'elle remonte dans le front
     *
     * @param {object} config - Le configuration
     *
     * @returns {object} La configuration sans la partie "authentication"
     * @private
     */
    function _deleteAuthFromConf(config) {
        // Suppression du secret OAuth
        if(lodash.has(config, 'authentication.method')) {
            const methods = lodash.get(config, 'authentication.method');
            for(let idx = 0; idx < methods.length; idx++) {
                if(methods[idx].type === 'oauth') {
                    delete methods[idx].auth;
                    delete methods[idx].client.secret;
                    delete methods[idx].cookie;
                    delete methods[idx].me;
                }
            }
        }
        return config;
    }

    /**
     * @description Supprime certaines infos de "mainParameters" :
     *              - "mainParameters.mandrill"
     *              - "mainParameters.protocole"
     *
     * @param {object} config - Le configuration
     *
     * @returns {object} La configuration sans la partie de "mainParameters" qui a été supprimée
     * @private
     */
    function _deleteMainParamFromConf(config) {
        if(lodash.has(config, 'mainParameters')) {
            delete config.mainParameters.mandrill;
            delete config.mainParameters.protocol;
        }
        return config;
    }
})();