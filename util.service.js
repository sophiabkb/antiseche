(function() {
    'use strict';

    // External dependecies
    const lodash = require('lodash');
    const path = require('path');
    const crypto = require('crypto');
    const fs = require('fs-extra');

    // Internal dependencies
    const Config = require('../core/conf.core').config;
    const Logger = require('../core/logger.core.js');

    module.exports = {
        deleteDot: deleteDot,
        deleteUndefined: deleteUndefined,
        addDot: addDot,
        cleanFirebaseId: cleanFirebaseId,
        lowercase: lowercase,
        findCurrency: findCurrency,
        calculAmount: calculAmount,
        convertToNumber: convertToNumber,
        sectionIdWithLessonId: sectionIdWithLessonId,
        generateGiftToken: generateGiftToken,
        extractUserLang: extractUserLang,
        formattedDate: formattedDate,
        formatDate: formatDate,
        writeFile: writeFile,
        readFile: readFile,
        readJson: readJson,
        fileExist: fileExist,
        readDir: readDir,
        createDir: createDir,
        directoryExist: directoryExist,
        emptyDir: emptyDir,
        generateId: generateId,
        base64Encode: base64Encode,
        base64Decode: base64Decode,
        dateFromTimestamp: dateFromTimestamp,
        getNowUTC: getNowUTC,
        httpRequest: httpRequest,
        strReplaceLast: strReplaceLast
    };

    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&é(èçà)';
    const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    /**
     * Supprime les '.' de l'email car ils ne sont pas autorisé sur firebase
     * @param email email à transformer
     * @returns {string|null} retourne l'email avec des espace au lieu des points
     */
    function deleteDot(email) {
        if(email) {
            return email.split('.').join(' ');
        }
        return null;
    }

    /**
     * Remove all undefined property of an object
     * @param obj obect to clean
     */
    function deleteUndefined(obj) {
        if(obj) {
            for (const propName in obj) {
                if (obj.hasOwnProperty(propName) && (obj[propName] === null || obj[propName] === undefined)) {
                    delete obj[propName];
                } else if(lodash.isObject(obj[propName])) {
                    deleteUndefined(obj[propName]);
                }
            }
            return obj;
        }
        return null;
    }

    /**
     * Remplace les espace par des points pour récupérer l'email de l'identifiant firebase
     * @param email l'email avec des espaces
     * @returns {string|null} l'email avec des points
     */
    function addDot(email) {
        if(email) {
            return email.split(' ').join('.');
        }
        return null;
    }

    function cleanFirebaseId(id) {
        if(id) {
            return id.split('.').join(' ').split('#').join(' ').split('$').join(' ').split('[').join(' ').split(']').join(' ');
        }
        return null;
    }

    /**
     * Converti en
     * @param str
     * @returns {*}
     */
    function lowercase(str) {
        if(lodash.isString(str)) {
            return str.toLowerCase();
        }
        return str;
    }

    function findCurrency(cur) {
        if (cur === 'e') {
            return 'eur';
        } else if (cur === 'p') {
            return 'gbp';
        } else if (cur === 'd') {
            return 'usd';
        }
        return null;
    }

    function calculAmount(code) {
        const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
        let amount = '';
        if(code) {
            for (let i = 0; i < code.length; i++) {
                const letter = code.charAt(i);
                const letterPosition = alphabet.indexOf(letter);
                amount = amount + letterPosition.toString();
            }
            if(amount !== '') {
                amount = parseInt(amount, 10);
            } else {
                // TODO mettre la valeur par défaut à terme
                amount = null;
            }
        } else {
            // TODO mettre la valeur par défaut à terme
            amount = null;
        }
        return amount;
    }

    function convertToNumber(number) {
        try {
            return parseInt(number, 10);
        } catch (e) {
            return null;
        }
    }

    function sectionIdWithLessonId(lessonIdStr) {
        const lessonId = parseInt(lessonIdStr, 10);
        return (lessonId - lessonId % Config.module.lessonPerSection) / Config.module.lessonPerSection;
    }

    function generateGiftToken() {
        return crypto.randomBytes(4).toString('hex').toUpperCase();
    }

    function extractUserLang(moduleData, userInfos) {
        if(moduleData && moduleData.param && userInfos) {
            return moduleData.param.lang || userInfos.lang || Config.lang.default;
        } else if ((!moduleData || !moduleData.param) && userInfos) {
            return userInfos.lang || Config.lang.default;
        } else if ((!moduleData || !moduleData.param) && !userInfos) {
            return Config.lang.default;
        }
    }

    // deprecated
    function formattedDate(d) {
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear().toString().substr(2, 2);

        if (month.length < 2) {month = '0' + month;}
        if (day.length < 2) {day = '0' + day;}

        return [day, month, year].join('-');
    }

    function formatDate(d) {
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear().toString().substr(2, 2);

        if (month.length < 2) {month = '0' + month;}
        if (day.length < 2) {day = '0' + day;}

        return [year, month, day].join('-');
    }

    function writeFile(path, data, encode) {
        return new Promise(function(resolve, reject) {
            fs.writeFile(path, data, (encode || 'utf8'), function (err) {
                if (err) {
                    Logger.crit('Error writing file : ', err);
                    return reject(err);
                }
                return resolve();
            });
        });
    }

    function readFile(path) {
        return new Promise(function(resolve, reject) {
            fs.readFile(path, 'utf8', function (err, data) {
                if (err) {
                    Logger.crit('Error reading file : ', err);
                    return reject(err);
                }
                return resolve(data);
            });
        });
    }

    // async function readFile(pathFile) {
    //     try {
    //         return await fs.readFile(pathFile, 'utf8');
    //     } catch(e) {
    //         throw new Error(e);
    //     }
    // }


    async function readJson(pathFile) {
        return await fs.readJSON(pathFile, 'utf8');
    }


    function fileExist(filePath) {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(filePath, (err, file) => {
                    if (!err && file.isFile()) {
                        return resolve(true);
                    }

                    if (err && err.code === 'ENOENT') {
                        return resolve(false);
                    }
                });
            } catch (error) {
                Logger.crit('Error trying to check if a file exists', {file: filePath, error: error});
                return reject(error);
            }
        });
    }

    function readDir(dirPath) {
        return new Promise(function(resolve, reject) {
            fs.readdir(dirPath, function (err, items) {
                if (err) {
                    Logger.warning('Error reading directory : ', err);
                    return reject(err);
                }
                return resolve(items);
            });
        });
    }


    function directoryExist(dirPath) {
        return new Promise((resolve, reject) => {
            try {
                fs.stat(dirPath, (err, file) => {
                    if (!err && file.isDirectory()) {
                        return resolve(true);
                    }

                    if (err && err.code === 'ENOENT') {
                        return resolve(false);
                    }
                });
            } catch (error) {
                Logger.crit('Error trying to check if a directory exists', {directory: dirPath, error: error})
                return reject(error);
            }
        });
    }

    function emptyDir(dirPath) {
        return fs.emptyDir(dirPath);
    }

    function createDir(dirPath) {
        return new Promise((resolve, reject) => {
            fs.mkdir(dirPath, (err) => {
                if (err) {
                    Logger.crit('Error creating directory : ', err);
                    return reject(err);
                }
                Logger.info('Create directory', dirPath);
                return resolve();
            });
        });
    }

    function generateId() {
        let d = new Date();
        d = d.getTime();
        let timestamp64 = new Buffer(d.toString()).toString('base64');
        timestamp64 = timestamp64.substring(0, timestamp64.length - 2); // enlève les == dus au padding de la base 64
        let id = timestamp64;
        for(let i = 0; i < 10; i++) {
            id += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return id;
    }

    /**
     * Décodage en base 64
     * @param input la chaine à décoder
     * @returns {string} la chaine décodée
     */
    function base64Encode (input) {
        let output = '';
        let chr1, chr2, chr3 = '';
        let enc1, enc2, enc3, enc4 = '';
        let i = 0;

        do {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output
                + keyStr.charAt(enc1)
                + keyStr.charAt(enc2)
                + keyStr.charAt(enc3)
                + keyStr.charAt(enc4);
            chr1 = chr2 = chr3 = '';
            enc1 = enc2 = enc3 = enc4 = '';
        } while (i < input.length);

        return output;
    }

    /**
     * Encodage en base 64
     * @param input la chaine à encoder
     * @returns {string} la chaine encodée
     */
    function base64Decode(inputParam) {
        let output = '';
        let chr1, chr2, chr3 = '';
        let enc1, enc2, enc3, enc4 = '';
        let i = 0;

        const input = inputParam.replace(/[^A-Za-z0-9\+\/\=]/g, '');

        do {
            enc1 = keyStr.indexOf(input.charAt(i++));
            enc2 = keyStr.indexOf(input.charAt(i++));
            enc3 = keyStr.indexOf(input.charAt(i++));
            enc4 = keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 !== 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 !== 64) {
                output = output + String.fromCharCode(chr3);
            }

            chr1 = chr2 = chr3 = '';
            enc1 = enc2 = enc3 = enc4 = '';

        } while (i < input.length);

        return output;
    }

    function dateFromTimestamp(timestamp) {
        if(!timestamp) {
            return null;
        }
        try {
            return new Date(parseInt(timestamp, 10));
        } catch (e) {
            Logger.error('Error formating Date from timestamp : ', e);
            return null;
        }
    }

    function getNowUTC() {
        const now = new Date;
        return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
            now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds());
    }

    function httpRequest(http, params, postData) {
        return new Promise(function(resolve, reject) {
            var req = http.request(params, function(res) {
                // reject on bad status
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error('statusCode=' + res.statusCode));
                }
                // cumulate data
                var body = [];
                res.on('data', function(chunk) {
                    body.push(chunk);
                });
                // resolve on end
                res.on('end', function() {
                    try {
                        body = JSON.parse(Buffer.concat(body).toString());
                    } catch(e) {
                        reject(e);
                    }
                    resolve(body);
                });
            });
            // reject on request error
            req.on('error', function(err) {
                // This is not a "Second reject", just a different sort of failure
                reject(err);
            });
            if (postData) {
                req.write(postData);
            }
            // IMPORTANT
            req.end();
        });
    }

    /**
     * @description Remplace la fin d'une chaine de caractère par quelque chose.
     * Exemple :
     * - strReplaceLast('mon_draft_course_draft', '_draft', '') => "mon_draft_course"
     *
     * @param {string} string - La chaine de départ
     * @param {string} what - Ce qu'on veut remplacer
     * @param {string} replacement - Ce par quoi on veut le remplacer
     *
     * @returns {null|undefined|string} Si string est défini on retourne la string modifiée
     */
    function strReplaceLast(string, what, replacement) {
        if(!string) {
            return string;
        }
        const pcs = string.split(what);
        const lastPc = pcs.pop();
        return pcs.join(what) + replacement + lastPc;
    }

})();
