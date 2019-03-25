(function() {
    'use strict';

    // External dependencies
    const oauth2 = require('simple-oauth2');
    const lodash = require('lodash');

    // Internal dependencies
    const Logger = require('../../core/logger.core');
    // const Config = require('../../core/conf.core').config;
    // error
    const AntisecheError = require('../errors/antiseche.error');
    // dao
    const ConfigDAO = require('../../dao/config.dao');
    // service
    const UtilSvc = require('../util.service');

    // Interface
    exports.getOAuth2Credentials = getOAuth2Credentials;
    exports.getOAuthCookieOption = getOAuthCookieOption;
    exports.getUserData = getUserData;

    /**
     * @description
     *
     * @param dbInfos
     *
     * @returns {Promise.<credentials>}
     */
    async function getOAuth2Credentials(dbInfos) {
        // 1 - On récupère les infos de l'OAuth pour cette configuration
        const oauth = await _getAuthMethodConfig(dbInfos, 'oauth');

        // 2 - On créé l'objet pour OAuth
        const client = lodash.get(oauth, 'client');
        // client.secret = Config.secretEM;
        const auth = lodash.get(oauth, 'auth');
        if(!client || !auth) {
            throw new Error({code: 'config/auth-param', msg: 'No client or auth param for OAuth'});
        }
        const credentials = {
            client: client,
            auth: auth
        };
        return oauth2.create(credentials);
    }

    /**
     * @description
     *
     * @param dbInfos
     *
     * @returns {Promise.<*>}
     */
    async function getOAuthCookieOption(dbInfos) {
        // 1 - On récupère les infos de l'OAuth pour cette configuration
        const oauth = await _getAuthMethodConfig(dbInfos, 'oauth');

        // 2 - On retourne les infos
        return lodash.get(oauth, 'cookie');
    }

    /**
     * @description
     *
     * @param dbInfos
     * @param authResult
     *
     * @returns {Promise.<*>}
     */
    async function getUserData(dbInfos, authResult) {
        // 1 - On récupère les infos de l'OAuth pour cette configuration
        const oauth = await _getAuthMethodConfig(dbInfos, 'oauth');

        // 2 - On regarde comment récupérer les infos de l'utilisateur (soit un appel, soit directement dans le auth result, si rien de renseigné on renvoie {})
        const me = lodash.get(oauth, 'me');
        switch(lodash.get(me, 'type')) {
            case 'url':
                const headers = {
                    'Authorization': authResult.token_type + ' ' + authResult.access_token,
                    'Content-Type': 'application/json'
                };
                return await _getMeAPI(me, headers);
            default:
                return {};
        }
    }

    // --------------------------------
    // PRIVATE
    // --------------------------------
    /**
     * @description
     *
     * @param dbInfos
     * @param typeAuth
     *
     * @returns {Promise.<void>}
     * @private
     */
    async function _getAuthMethodConfig(dbInfos, typeAuth) {
        // 1 - On récupère les infos de l'OAuth pour cette configuration
        const authMethod = lodash.get(await ConfigDAO.getAuthentication(dbInfos), 'method');
        const oauth = lodash.find(authMethod, {type: typeAuth});
        if(!oauth) {
            throw new Error({code: 'config/no-oauth', msg: 'No OAuth for this config'});
        }
        return oauth;
    }

    /**
     * @description
     *
     * @param me
     * @param headers
     *
     * @returns {Promise.<*>}
     * @private
     */
    async function _getMeAPI(me, headers) {
        const protocol = lodash.get(me, 'protocol') || 'https';
        const httpCall = require(protocol); // eslint-disable-line security/detect-non-literal-require
        const host = lodash.get(me, 'host');
        const method = lodash.get(me, 'method') || 'GET';
        const path = lodash.get(me, 'path');
        const mapping = lodash.get(me, 'mapping');

        if(!host || !path) {
            throw new AntisecheError({code: 'config/auth-param', msg: 'No host or path to get user information after OAuth (host=' + host + ', path=' + path + ')'});
        }

        const options = {
            hostname: host,
            path: path,
            method: method.toUpperCase(),
            headers: headers
        };

        const resultMe = await UtilSvc.httpRequest(httpCall, options);
        Logger.info('OAuth retrieve me API BEFORE mapping ', JSON.stringify(resultMe).substring(0, 100), '...', resultMe);
        // On fait un  mapping entre l'objet récupéré
        if(!mapping) {
           return resultMe;
        }

        const resultAntiseche = {};
        for(const key in mapping) {
            if(mapping.hasOwnProperty(key)) {
                resultAntiseche[mapping[key]] = resultMe[key];
            }
        }
        Logger.info('OAuth retrieve me API AFTER mapping ', JSON.stringify(resultAntiseche).substring(0, 100), '...', resultAntiseche);
        return resultAntiseche;
    }

})();
