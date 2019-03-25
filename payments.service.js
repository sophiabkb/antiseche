(function () {
    'use strict';

    // External dependencies
    const Promise = require('promise');
    const path = require('path');
    const fs = require('fs');
    const lodash = require('lodash');

    // Internal dependencies
    // core
    const Config = require('./../core/conf.core').config;
    const Logger = require('./../core/logger.core.js');
    // dao
    const PaymentsDAO = require('../dao/payments.dao.js');
    const ProspectsDAO = require('../dao/prospects.dao');
    const UsersDAO = require('../dao/users.dao');
    const GroupsDAO = require('../dao/groups.dao');
    // services
    const UsersSvc = require('./users.service.js');
    const UtilSvc = require('./util.service');
    const toolsSendMail = require('./send-mail.service.js');
    // error
    const GiftMatchingError = require('./errors/gift-matching.error');



    // API du service
    // payment management
    exports.saveGiftPayment = saveGiftPayment;
    exports.savePayment = savePayment;
    // gift management
    exports.checkGift = checkGift;
    exports.getFreeGift = getFreeGift;
    exports.generateMultipleGift = generateMultipleGift;
    // payment infos
    exports.extractPaymentInfo = extractPaymentInfo;
    exports.getPaymentInfo = getPaymentInfo;


    //
    // Implémentation
    //

    function saveGiftPayment(dbInfos, user, address, payment, params) {
        var _giftToken = null;

        // Create order
        return _newOrder(dbInfos, payment.ref, params.module, payment.amount, payment.currency, user.userId, user.email, user.firstname, user.lastname, address, params.lang, payment.type).then(function(order) {
            // Create GIFT Token
            return _generateGiftToken(dbInfos);
        }).then(function(giftToken) {
            _giftToken = giftToken;
            // On ajoute le gift pour l'utilisateur
            return _addGift(dbInfos, _giftToken, user.email, payment.ref, params.module, user.userId);
        }).then(function() {
            params.giftCode = _giftToken;
            // Envoie du mail pour télécharger le pdf avec le bon cadeau
            return _sendMailMarketing(dbInfos, 'gift', user, params).then(function(res) {
                return Promise.resolve({msg: 'Gift mail sent', data: {ref:payment.ref, module:params.module, giftToken: _giftToken}});
            }, function(error) {
                Logger.error('Error sending gift mail', error);
                return Promise.reject(error);
            });
        }, function (error) {
            Logger.error('Error creating order for a gift', error);
            return Promise.reject(error);
        });
    }

    /**
     * Enregistre dans firebase les infos relative au paiemen
     * @param dbInfos information de la base de données
     * @param user information sur l'utilisateur
     * @param address addresse à conserver dans la cvommande
     * @param payment infos sur le paiement (mon tant, devise, référence...)
     * @param params paramètre divers (module, token stripe, lang, group)
     * @returns {*}
     */
    function savePayment(dbInfos, user, address, payment, params) {
        var _pendingRef = null;

        // Création d'une commande
        return ProspectsDAO.getProspect(dbInfos, params.module, user.email).then(function(prospectData) {
            var originOrder = '';
            if(prospectData) {
                originOrder = prospectData.group;
            }
            // Format des paramètres :  {email: string, amount: number, module: string, currency: string,type: string,ref: string}
            return _newOrder(dbInfos, payment.ref, params.module, payment.amount, payment.currency, user.userId, user.email, user.firstname, user.lastname, address, params.lang, payment.type || 'order', originOrder);
        }).then(function(order) {
            // Création d'un paiement en pending
            return _addPending(dbInfos, user.email, params.module, payment.ref);
        }).then(function(pendingRef) {
            _pendingRef = pendingRef;
            // On supprime le prospect
            return ProspectsDAO.removeProspect(dbInfos, params.module, user.email);
        }).then(function() {
            // Si l'utilisateur existe déjà
            if(user.userId) {
                // On ajoute le module au status "non activé" si l'utilisateur n'a pas déjà  le module
                return UsersSvc.addNotInitModuleIfNotExist(dbInfos, user.userId, params.module).then(function() {
                    // On supprime le pending
                    return PaymentsDAO.removePending(dbInfos, _pendingRef);
                }).then(function() {
                    // On supprime le group de l'utilisateur (pour ne plus qu'il soit en free-trial)
                    return UsersDAO.updateModuleParam(dbInfos, user.userId, params.module, {group:null});
                }).then(function() {
                    // On récupère les infos de module de l'utilisateur
                    return UsersDAO.getOneModule(dbInfos, user.userId, params.module);
                }).then(function(moduleData) {
                    if(!moduleData
                        || !moduleData.mailing
                        || !moduleData.mailing.status
                        || moduleData.mailing.status.lessonID === -1) {
                        // Send mail 4 :  Paiement post inscription sans free trial (voir: http://51.254.143.139:8282/gitlab/Artips/antiseche/wikis/list-email#email-4-paiement-post-inscription-sans-free-trial)
                        // On fait le resolve dans tous les cas car même si le mail ne part pas il faut quand même que le paiement
                        // fonctionne (peut être indiquer le problème à l'utilisateur et à nous)
                        _sendMailMarketing(dbInfos, 'payment', user, params).then(function() {
                        }, function(error) {
                            Logger.error('Error sending payment mail', error);
                        });
                        return Promise.resolve({code:'START_MODULE', msg: 'Start the new module', data: {ref:payment.ref, module: params.module}});
                    } else {
                        // Send mail 3 : Paiement post free trial (voir http://51.254.143.139:8282/gitlab/Artips/antiseche/wikis/list-email#email-3-paiement-post-free-trial-1)
                        // On fait le resolve dans tous les cas car même si le mail ne part pas il faut quand même que le paiement
                        // fonctionne (peut être indiquer le problème à l'utilisateur et à nous)
                        _sendMailMarketing(dbInfos, 'payment-freetrial', user, params).then(function() {
                        }, function(error) {
                            Logger.error('Error sending payment-freetrial mail', error);
                        });
                        return Promise.resolve({code:'MODULE', msg: 'Go to module home page', data: {ref:payment.ref, module: params.module, lastUnlockedLesson:moduleData.mailing.status.lessonID}});
                    }
                }, function(error) {
                    return Promise.reject(error);
                }).catch(function(error) {
                    return Promise.reject(error);
                });
            } else {
                // Envoie du mail indiquant qu'il a payé et qu'il doit se signin
                return _sendMailMarketing(dbInfos, 'payment', user, params).then(function() {
                    return Promise.resolve({code:'SIGNIN', msg: 'User without account, needs to sign in', data: {ref:payment.ref, module: params.module, pendingRef:_pendingRef}});
                }, function(error) {
                    // On fait quand même le resolve
                    Logger.error('Error sending payment-signin mail', error);
                    return Promise.resolve({code:'SIGNIN', msg: 'User without account, needs to sign in', data: {ref:payment.ref, module: params.module, pendingRef:_pendingRef}});
                });
            }
        }, function (error) {
            Logger.error('Error creating an order ', error);
            return Promise.reject(error);
        });
    }

    /**
     * @param dbInfos
     * @param uid
     * @param email
     * @param gift
     * @param module
     * @param freeGift
     * @returns {*}
     */
    function checkGift(dbInfos, uid, email, gift, module, freeGift) {
        var _pendingRef = null;
         // Si on est sur la cas avec le code cadeau générique sans que l'utilisateur soit loggué
        if(gift && email && freeGift && freeGift.length > 0 && freeGift.indexOf(gift) !== -1 && !uid) {
            Logger.info('Add gift for email=', email, ' (user doesn\'t exist) with free code ', gift);
            var ref = gift + '_' + module + '_' + UtilSvc.deleteDot(email),
                amount = 0,
                currency = 'eur',
                lang = 'fr',
                type = 'gift',
                firstname = '',
                name = '',
                address = '',
                prospectGroup = null;

            // On créé une nouvelle commande avec ce code cadeau
            return _newOrder(dbInfos, ref, module, amount, currency, uid, email, firstname, name, address, lang, type, prospectGroup).then(function() {
                return _addPending(dbInfos, email, module, ref, null, null, null);
            }).then(function(refPending) {
                _pendingRef = refPending;
                return PaymentsDAO.addUsedGift(dbInfos, gift, email, module);
            }).then(function() {
                return {pendingRef: _pendingRef};
            });
        } else if(gift && email && freeGift && freeGift.length > 0 && freeGift.indexOf(gift) !== -1 && uid) {
            // Cas d'un code cadeau générique, mais avec utilisateur loggué
            Logger.info('Add gift for user: ', uid, ' with free code ', gift);
            return PaymentsDAO.addUsedGift(dbInfos, gift, email, module).then(function() {
                return {pendingRef: _pendingRef};
            });
        } else if(uid && email) {
            return PaymentsDAO.getGiftByCode(dbInfos, gift).then(function (data) {
                if (data) {
                    _orderRef = data.ref;
                    return _addPending(dbInfos, email, module, _orderRef, data.unlimited, data.email, data.fromUid, gift);
                } else {
                    return Promise.reject(new GiftMatchingError(gift + ' and ' + email + ' doesn\'t match'));
                }
            }).then(function(refPending) {
                _pendingRef = refPending;
                return PaymentsDAO.updateOrder(dbInfos, _orderRef, {'giftTokenConsumedBy': email});
            }).then(function() {
                return PaymentsDAO.removeGift(dbInfos, gift);
            }).then(function() {
                return {pendingRef: _pendingRef};
            });
        } else {
            var _orderRef = null;
            return UsersDAO.getUserIdByMail(dbInfos, email).then(function(userData) {

                if(!userData) {
                    // Cas d'un code cadeau "classique"
                    // TODO voir ce qu'on fait si l'utilisateur est loggué, autant lui ajouter le module directement sans passer par un pending
                    Logger.info('Add gift for email=', email, ' (user doesn\'t exist) with gift code ', gift);

                    return PaymentsDAO.getGiftByCode(dbInfos, gift);
                } else {
                    Logger.info('Error trying to enter gift code but already existing user for email=', email);
                    return Promise.reject({message:'ALREADYEXISTING'});
                }
            }).then(function (data) {
                if (data) {
                    console.log('GIFT DETECTED');
                    _orderRef = data.ref;
                    return _addPending(dbInfos, email, module, _orderRef, data.unlimited, data.email, data.fromUid, gift);
                } else {
                    console.log('DETECTED PB CODE');
                    return Promise.reject(new GiftMatchingError(gift + ' and ' + email + ' doesn\'t match'));
                }
            }).then(function(refPending) {
                _pendingRef = refPending;
                return PaymentsDAO.updateOrder(dbInfos, _orderRef, {'giftTokenConsumedBy': email});
            }).then(function() {
                return PaymentsDAO.removeGift(dbInfos, gift);
            }).then(function() {
                return {pendingRef: _pendingRef};
            });
        }
    }

    /**
     * Extrait les informations de paiement de la requete
     * @param body body de le requête au format {module: string, email: string, cur:string, code:string, group:string}
     * @returns {{module: *, email: *, currency: *, amount: *, group: *}}
     */
    function extractPaymentInfo(body) {
        return {
            module: body.module || null,
            email: body.email || null,
            currency: UtilSvc.findCurrency(body.cur) || null,
            amount: UtilSvc.calculAmount(body.code),
            group: body.group || null,
            // Permet de faire un check entre les données front et back en conservant ces infos
            frontAmount: body.amount ? body.amount * 100 : null,
            frontCurrency: body.currency
        };
    }

    /**
     * Récupère les infos de paiements pour un utilisateur
     * @param dbInfos info sur la database à requeter (saas)
     * @param uid identifiant de l'utilisateur
     * @param module nom du module
     * @param email email de l'utilisateur
     * @param currency currency envoyé depuis l'appli
     * @param amount  prix envoyé depuis l'appli
     * @param groupId group envoyé depuis l'appli
     * @returns {*} un promise contenant les données de payement à renvoyer
     */
    function getPaymentInfo(dbInfos, uid, module, email, currency, amount, groupId) {
        var _amountData = null;

        // On recherche le prospect par user et module
        return ProspectsDAO.getProspect(dbInfos, module, email).then(function(amountData) {
            if(amountData) {
                _amountData = amountData;
            }
            // On l'id du group
            return UsersDAO.getUserGroup(dbInfos, uid);
        }).then(function(groupIdUser) {
            groupId = groupId || groupIdUser;
            // On récupère également le groupe
            return GroupsDAO.getGroupById(dbInfos, groupId);
        }).then(function(groupData) {
            if(!_amountData) {
                _amountData = groupData || {};
            } else {
                _amountData = lodash.extend({}, groupData, _amountData) || {} ;
            }
            // Gestion de la devise
            if(currency) {
                _amountData.currency = currency;
            } else if (!_amountData.currency && (groupData && groupData.currency)) {
                _amountData.currency = groupData.currency;
            } else if (!_amountData.currency && (!groupData || !groupData.currency)) {
                _amountData.currency = Config.amount.defaultCurrency;
            }
            // Gestion du montant
            if(amount) {
                _amountData.amount = amount;
            } else if (!_amountData.amount && (groupData && groupData.amount)) {
                _amountData.amount = groupData.amount;
            } else if (!_amountData.amount && (!groupData || !groupData.amount)) {
                _amountData.amount = Config.amount.defaultAmount;
            }

            // Ajout du group et du module pour le prospect
            if(groupId) _amountData.group = groupId;
            if(module) _amountData.module = module;

            // On vérifie qu'on a bien réussi à récupérer un montant et une devise pour la transaction
            if(!_amountData.currency && !_amountData.amount && !_amountData.module) {
                // Si au final on n'a pas réussi
                return reject({code: 'ERROR', msg: 'Aucune information de paiement disponible (prospect='
                + _amountData + ' ,currency=' + currency + ' ,amount=' + amount + ')'});
            }
            return _amountData;
        });
    }

    /**
     * Récupère la liste des free gift
     */
    function getFreeGift(dbInfos) {
        return PaymentsDAO.getFreeGifts(dbInfos).then(function(freeGifts) {
            return freeGifts || [];
        });
    }

    /**
     * Génère une liste de code cadeaux associés à un utilisateur
     * @param dbInfos
     * @param nbGift
     * @param email
     * @param orderRef
     * @param module
     * @param unlimited
     * @param fromUid
     */
    function generateMultipleGift(dbInfos, nbGift, email, orderRef, module, unlimited, fromUid) {
        var tokPromises = [];
        var giftPromises = [];
        var giftTokens = [];
        for(var idx = 0 ; idx < nbGift ; idx++) {
            tokPromises.push(_generateGiftToken(dbInfos));
        }
        return Promise.all(tokPromises).then(function(_giftTokens) {
            giftTokens = _giftTokens;
            for(idx = 0; idx < giftTokens.length ; idx++) {
                giftPromises.push(_addGift(dbInfos, giftTokens[idx], email, orderRef, module, unlimited, fromUid));
            }
            return Promise.all(giftPromises);
        }).then(function() {
            return giftTokens;
        });
    }

    // ----------------------------------
    // PRIVATE MEMBERS
    // ----------------------------------
    function _sendMailMarketing(dbInfos, subType, user, params) {
        var tmpUsr = {
            lang: user.lang || params.lang,
            module: params.module,
            userId: user.userId,
            email: UtilSvc.lowercase(user.email),
            firstname: user.firstname,
            lastname: user.lastname,
            giftCode: params.giftCode,
            serverUrl: dbInfos.serverUrl ? dbInfos.serverUrl : null
        };
        return toolsSendMail.sendOneInternalMailToList(dbInfos, 'marketing', subType, [tmpUsr]);
    }

    function _newOrder(dbInfos, ref, module, amount, currency, uid, email, firstname, lastname, address, lang, type, prospectGroup) {
        // On check si l'order existe déjà
        return PaymentsDAO.getOrder(dbInfos, ref).then(function(existingOrder) {
            if(!existingOrder) {


                // Note: duplicate module and moduleTitle to handle legacy - correct wording is 'module', moduleTitle should be removed
                var orderData = {
                    amount: amount,
                    currency: currency,
                    email: UtilSvc.lowercase(email),
                    firstname: firstname || null,
                    lastname: lastname || null,
                    lang: lang || null,
                    moduleTitle:  module,
                    module:  module,
                    ref: ref,
                    type:type,
                    address: address || null,
                    createdAt: new Date().getTime(),
                    prospectGroup: prospectGroup || null
                };
                Logger.debug(orderData);
                return PaymentsDAO.createOrder(dbInfos, ref, orderData);
            } else {
                Logger.error('Reference already existing ' + ref);
                return Promise.reject('Reference already existing ' + ref);
            }
        }).then(function() {
            if(uid)
            return UsersDAO.createOrder(dbInfos, uid, ref, module);
        }).catch(function(error) {
            Logger.error('Error setting order (value=',ref,')', error);
            return Promise.reject(error);
        });
    }


    function _generateGiftToken(dbInfos) {
        return new Promise(function(resolve, reject) {
            var token = null;

            // On boucle jusqu'à ce qu'on trouve un token non utilisé
            setImmediate(function myPromise() {
                token = UtilSvc.generateGiftToken();
                return existingToken(dbInfos, token).then(function(existingGift) {
                    if(existingGift) {
                        setImmediate(myPromise);
                    } else {
                        resolve(token);
                    }
                }).catch(function(error) {
                    reject(error);
                });
            });

            function existingToken(dbInfos, token) {
                return PaymentsDAO.getGiftByCode(dbInfos, token);
            }
        });
    }


    function _addGift(dbInfos, giftToken, email, orderRef, module, unlimited, fromUid) {
        return PaymentsDAO.createGift(dbInfos, giftToken, {email: UtilSvc.lowercase(email), ref: orderRef, module: module || null, unlimited: unlimited || null, fromUid: fromUid || null});
    }

    function _addPending(dbInfos, email, module, orderRef, unlimited, fromEmail, fromUid, fromGiftToken) {
        var pendingData = {
            email: UtilSvc.lowercase(email),
            orderRef: orderRef || null,
            module: module || null,
            unlimited: unlimited || null,
            fromEmail: fromEmail || null,
            fromUid: fromUid || null,
            fromGiftToken: fromGiftToken || null
        };
        return PaymentsDAO.createPending(dbInfos, pendingData).then(function(ref) {
            return ref.key;
        });
    }

})();