/* global require*/
(function () {
    'use strict';

    // External dependencies
    const lodash = require('lodash');
    const Promise = require('promise');
    const path = require('path');
    const fs = require('fs');
    const EmailTemplate = require('email-templates').EmailTemplate;

    // Internal dependencies
    // core
    const Logger = require('../core/logger.core.js');
    const Config = require('../core/conf.core.js').config;
    // dao
    const ConfigDAO = require('../dao/config.dao');
    const DefaultConfigDAO = require('../dao/default-config.dao');
    // providers
    // const Mandrill = require('./messager/mailProviders/mandrill');
    const Sendgrid = require('./messager/mailProviders/sendGrid');



    // Interface
    exports.sendOnePhpMailToList = sendOnePhpMailToList;
    exports.sendOneInternalMailToList = sendOneInternalMailToList;
    exports.sendGenericMail = sendGenericMail;



    // Implémentation
    //
    // Méthode utilisée pour les mails marketing
    //
    function sendOnePhpMailToList(dbInfos, template, title, data) {
        const users = data.users;
        const promises = [];
        for(const ref in users) {
            if(users.hasOwnProperty(ref)) {
                promises.push(_sendMail(dbInfos, {template: template, title: title}, users[ref]));
            }
        }
        return Promise.all(promises);
    }

    //
    // Méthode utilisée pour les mails marketing
    //
    async function sendOneInternalMailToList(dbInfos, typeMail, subType, users) {
        // Je construit le path du dossier contenant les éléments du mail
        const pathDir = path.join(__dirname, '..', 'resources', 'mail', 'template', typeMail);
        // J'instancie mon builder d'email
        const template = new EmailTemplate(pathDir);
        const type = typeMail + '_' + (subType || '');

        // Je récupère l'URL du serveur
        const saasMainParameters = await ConfigDAO.getMainParameters(dbInfos);
        const defaultMainParameters = await DefaultConfigDAO.getMainParameters(dbInfos);
        const mainParams = lodash.merge({}, defaultMainParameters, saasMainParameters);
        // On récupère les labels dus mails marketing
        const labelsData = await Promise.all([
            _retrieveLabel('fr'),
            _retrieveLabel('en')
        ]);
        const labels = {
            fr: labelsData[0],
            en: labelsData[1]
        };

        // Je boucle pour les promises du render
        const templates = users.map(function (user) {

            // Langue par défaut si pas défini
            user.lang = user.lang || Config.lang.default;

            // Ajout de 'url_server' si non présent
            if(!user.serverUrl) {
                user.serverUrl = lodash.get(mainParams, 'serverUrl');
            }
            user.type = type;

            // Calcul de l'URL
            if(typeMail === 'marketing') {
                user.url = generateUrlMarketing(subType, user.serverUrl, user.backendUrl, user.module, user.userId, user.email, user.lang, user.giftCode);
            }

            user.headerGeneric = subType === 'signin';


            // On ajoute les libellés qui vont être utilisés dans le mail
            if(labels[user.lang] && labels[user.lang][subType]) {
                var tmpLabels = _processLabel(labels[user.lang], subType, user.module, {module: user.module});
                user = lodash.extend(user, tmpLabels);
            }
            return template.render(user, user.lang);
        });

        const results = await Promise.all(templates);
        const promises = [];
        const result = {
            type: type, // Utilisé pour les tags MailChimp
            nbMailSent: 0,
            listMailSent: []
        };

        // On fait l'envoi de mail
        for(let idx = 0; idx < results.length; idx++) {

            const mailParams = {
                template: results[idx].html,
                text: results[idx].text,
                title: results[idx].subject
            };

            users[idx].tags = {type: type, module: users[idx].module};
            var recipientParams = users[idx];

            promises.push(_sendMail(dbInfos, mailParams, recipientParams));
        }
        // J'envoie chaque email
        const emailSent = await Promise.all(promises);
        result.nbMailSent = emailSent.length;
        result.listMailSent = emailSent;
        return result;
    }


    function sendGenericMail(dbInfos, mailParams, recipientData) {
        return _sendMail(dbInfos, mailParams, recipientData);
    }



    // Private member
    // function sendMail(htmlMail, userParams, title, textMail) {
    async function _sendMail(dbInfos, mailData, recipientData) {
        // return new Promise(function(resolve, reject) {
        try {
            const mailParams = mailData;

            for(let param in recipientData.data) {
                if(recipientData.data.hasOwnProperty(param)) {
                    const regex = new RegExp('\\[\\[' + param + '\\]\\]', 'g');
                    mailParams.template = mailParams.template.replace(regex, recipientData.data[param]);
                }
            }

            // Langue Envoie du mail
            mailParams.fromEmail = 'antiseches@artips.fr'; // .mail.from[Config.lang.default].email;
            mailParams.fromName = 'Antiseches'; // Config.mail.from[Config.lang.default].name;

            // TODO rendre ça paramètrable
            mailParams.trackOpen = true;
            mailParams.trackClick = true;

            if(Config.platform) {
                mailParams.title = Config.platform + mailParams.title;
            }


            // Tag du mail
            const tags = ['Antiseches'];
            if(recipientData && recipientData.data && recipientData.data.tags) {
                for(let key in recipientData.data.tags) {
                    if(recipientData.data.tags.hasOwnProperty(key) && recipientData.data.tags[key]) {
                        tags.push(key + '_' + recipientData.data.tags[key]);
                    }
                }
            }
            if(recipientData.tags) {
                for(let key in recipientData.tags) {
                    if(recipientData.tags.hasOwnProperty(key) && recipientData.tags[key]) {
                        tags.push(key + '_' + recipientData.tags[key]);
                    }
                }
            }

            mailParams.tags = tags;
            mailParams.toEmail = recipientData.email;
            if(recipientData.data) {
                mailParams.uid = recipientData.data.user_id;
            }


            mailParams.apiKey = 'g1CEilbddBDpR5qNValFVA';
            // const res = await Mandrill.sendMail(mailParams);
            const res = await Sendgrid.sendMail(mailParams);
            Logger.debug('Mail ' + mailParams.title + ' sent to : ' + mailParams.toEmail);
            return null;
        } catch(error) {
            Logger.error('Error in send-mail.service ', error);
            return false;
        }
        // });
    }

    // //////////////////////////////////
    // PRIVATE
    // //////////////////////////////////

    /**
     * @description Génère l'URL des mails marketing
     *
     * @param subTypeMail sous type du mail (signin, prompt-to-pay...) pour savoir comment générer l'URL
     * @param serverUrl URL de la plateforme
     * @param backendUrl URL du back-end
     * @param module identifiant du module
     * @param userId identifiant de l'utilisateur
     * @param email email de l'utilisateur
     * @param lang lang
     * @param giftCode code cadeau
     *
     * @returns {string} l'url
     */
    function generateUrlMarketing(subTypeMail, serverUrl, backendUrl, module, userId, email, lang, giftCode) {
        let url = '';
        switch (subTypeMail) {
            case 'signin':
                url = serverUrl;
                break;
            case 'prompt-to-pay':
                url = serverUrl + 'payment?email=' + (email || '') + '&lang=' + (lang || Config.lang.default) + '&module=' + (module || '');
                break;
            case 'gift':
                url = backendUrl + 'pdf/voucher?module=' + (module || '') + '&voucherId=' + (giftCode || '') + '&lang=' + (lang || Config.lang.default);
                break;
            case 'module-added':
            case 'payment':
                url = serverUrl + 'notions?lesson=0&module=' + (module || '') + '&user_id=' + (userId || '') + '&lang=' + (lang || Config.lang.default);
                break;
            case 'payment-signin':
                url = serverUrl + 'signin?email=' + (email || '') + '&lang=' + (lang || Config.lang.default) + '&module=' + (module || '');
                break;
            case 'payment-freetrial':
                url = serverUrl + 'notions?lesson=3&module=' + (module || '') + '&user_id=' + (userId || '') + '&lang=' + (lang || Config.lang.default);
                break;
        }
        return url;
    }

    /**
     * Récupère les fichiers de label pour le mail
     * @param lang langue
     * @returns {*}
     */
    function _retrieveLabel(lang) {
        return new Promise(function(resolve, reject) {
            const labelFilePath = path.join(__dirname, '..', 'resources', 'mail', 'lang', lang, 'label.json');
            fs.readFile(labelFilePath, 'utf8', function(err, data) {
                if(err) {
                    reject(err);
                }else {
                    resolve(JSON.parse(data));
                }
            });
        });
    }

    function _processLabel(labels, type, module, replaceData) {
        const labelsType = labels[type];
        for(let key in labelsType) {
            if(labelsType.hasOwnProperty(key)) {
                if(!labelsType[key] && labels.modules[module]) {
                    labelsType[key] = labels.modules[module][key] || '';
                }
                labelsType[key] = _replaceDataInString(labelsType[key], replaceData, labels.modules);
            }
        }
        return labelsType;
    }

    function _replaceDataInString(text, data, labels) {
        for(let key in data) {
            if(data.hasOwnProperty(key)) {
                if(labels[data[key]] && labels[data[key]][key]) {
                    text = text.replace('[[' + key + ']]', labels[data[key]][key]);
                } else {
                    text = text.replace('[[' + key + ']]', data[key]);
                }
            }
        }
        return text;
    }
})();
