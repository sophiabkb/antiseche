(function() {
    'use strict';

    // External dependencies
    const parse = require('csv').parse;
    const stringify = require('csv').stringify;
    const Promise = require('promise');
    const lodash = require('lodash');
    const dateFormat = require('dateformat');

    // Internal dependencies
    const Logger = require('../../core/logger.core');
    const CsvConfig = require('../../core/conf.core').csv;
    const Config = require('../../core/conf.core').config;
    const CsvParseError = require('../errors/csv-parse.error');
    const CsvContentError = require('../errors/csv-content.error');
    const CsvGenerateError = require('../errors/csv-generate.error');


    // Angular email regexp (la même que celle utilisée dans Chromium)
    const EMAIL_REGEXP = /^(?=.{1,254}$)(?=.{1,64}@)[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+(\.[-!#$%&'*+/0-9=?A-Z^_`a-z{|}~]+)*@[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;
    // Options par défaut pour l'export
    const DEFAULT_EXP_OPT = {header: true, delimiter: CsvConfig.option.delimiter};

    // Interface
    exports.generateCsv = generateCsv;
    exports.processColumn = processColumn;
    exports.processData = processData;
    exports.getDescriptor = getDescriptor;
    exports.parseCsvStr = parseCsvStr;
    exports.validateAndTransformCsv = validateAndTransformCsv;


    function generateCsv(data, csvDescriptor, option) {
        // On utilise cette notation pour pouvoir avoir une promise à la fin
        const options = lodash.merge({}, DEFAULT_EXP_OPT, {columns: csvDescriptor.columns}, option);
        if(!data) {
            data = [];
        }
        return new Promise(function(resolve, reject) {
            // Voir http://csv.adaltas.com/stringify/ pour comprendre la configuration
            stringify(data, options, function(error, output) {
                if(error) {
                    reject(new CsvGenerateError('Error generating CSV', error));
                } else {
                    resolve(output);
                }
            });
        });
    }

    /**
     *
     * @param name
     * @return {*}
     */
    function getDescriptor(name) {
        const result = CsvConfig.descriptor[name];
        if(!result) {
            throw new Error('CSV descriptor ' + name + ' NOT FOUND!');
        }
        return result;
    }

    function processColumn(descriptor, fields) {
        let columns = descriptor.column;
        // Processing des colonnes (ordre et choix)
        if(fields) {
            columns = lodash.filter(columns, (c) => fields.indexOf(c.id) !== -1);
            for(let idxField = 0; idxField < fields.length; idxField++) {
                const colIdx = lodash.findIndex(columns, (c) => c.id === fields[idxField]);
                if(colIdx >= 0) {
                    columns[colIdx].order = idxField;
                }
            }
        }
        columns.sort((c1, c2) => c1.order - c2.order);
        return columns;
    }

    function processData(columns, data) {
        const result = [];
        // Processing des données (formattage)
        for(let idx = 0; idx < data.length; idx++) {
            result.push([]);
            for(let idxCol = 0; idxCol < columns.length; idxCol++) {
                let value = data[idx][columns[idxCol].id];
                const format = lodash.get(columns[idxCol], 'format');
                if(format) {
                    if(format === 'boolean') {
                        value = value ? 'X' : null;
                    } else if(format === 'date') {
                        value = dateFormat(value, 'yyyy-mm-dd H:MM:ss');
                    } else if(format === 'duration') {
                        if(value === 0) {
                            value = '0:00:00';
                        } else {
                            value = dateFormat(value, 'H:MM:ss', true);
                        }

                    } else if(format === 'percent') {
                        value = value ? (value * 100).toFixed(2) + '%' : null;
                    }
                }
                result[idx].push(value);
            }
        }
        return result;
    }

    /**
     *
     * @param csvString
     * @return {*}
     */
    function parseCsvStr(csvString) {
        // On utilise cette notation pour pouvoir avoir une promise à la fin
        return new Promise(function(resolve, reject) {
            // Voir http://csv.adaltas.com/parse/ pour comprendre la configuration
            parse(csvString, CsvConfig.option, function(error, output) {
               if(error) {
                   reject(new CsvParseError('Error parsing CSV', error));
               } else {
                   resolve(output);
               }
            });
        });
    }

    /**
     * Validation et transformation d'un CSV
     * @param csvData
     * @param csvDescriptor
     * @return {{errors: Array, output: Array}}
     */
    function validateAndTransformCsv(csvData, csvDescriptor) {
        var result = {
            errors:[],
            output: []
        };

        for(var lineIdx = 0 ; lineIdx < csvData.length ; lineIdx++) {
            var lResult = _valideAndTransformLine(lineIdx, csvData[lineIdx], csvDescriptor.column);
            if(lResult.errors && lResult.errors.length > 0) {
                result.errors.push(lResult.errors);
            } else {
                result.output.push(lResult.output);
            }
        }
        if(result.errors && result.errors.length > 0) {
            throw new CsvContentError('CSV is not valid regarding to its descriptor', result.errors);
        } else {
            return result;
        }
    }


    /**
     * Validation et transformation d'une ligne
     * @param lineIdx
     * @param line
     * @param colDescriptor
     * @return {{errors: Array, output: Array}}
     * @private
     */
    function _valideAndTransformLine(lineIdx, line, colDescriptor) {
        var result = {
            errors: [],
            output: []
        };
        colDescriptor = colDescriptor.sort(_compareColDesc);
        // Pas le bon nombre de colonnes
        if(line.length !== colDescriptor.length) {
            result.errors.push(_createError(lineIdx, 'NB_COL', {descCol: colDescriptor.length, csvCol: line.length}));
        }
        for(var colIdx = 0 ; colIdx < colDescriptor.length ; colIdx++) {
            var desc = colDescriptor[colIdx];
            var value = line[desc.position];
            var vResult = _valideAndTransformValue(lineIdx, value, desc.name, desc.validator);
            if(vResult.errors && vResult.errors.length > 0) {
                result.errors = result.errors.concat(vResult.errors);
            } else {
                result.output.push(vResult.output);
            }
        }
        return result;
    }

    /**
     * Validation et transformation d'une valeur
     * @param lineIdx
     * @param value
     * @param colName
     * @param validator
     * @return {{errors: Array, output: *}}
     * @private
     */
    function _valideAndTransformValue(lineIdx, value, colName, validator) {
        var result = {
            errors: [],
            output: value
        };
        if(validator.required && (!value || value === '')) {
            result.errors.push(_createError(lineIdx, 'VALUE_REQUIRED', {colName:colName, value: value}));
        }
        if(validator.minLength && value && value.length && value.length < validator.minLength) {
            result.errors.push(_createError(lineIdx, 'VALUE_MIN_LENGTH', {colName:colName, value: value, minLength: validator.minLength}));
        }
        if(validator.maxLength && value && value.length && value.length > validator.maxLength) {
            result.errors.push(_createError(lineIdx, 'VALUE_MAX_LENGTH', {colName:colName, value: value, minLength: validator.minLength}));
        }
        if(validator.format === 'email' && value && !EMAIL_REGEXP.test(value)) {
            result.errors.push(_createError(lineIdx, 'VALUE_FORMAT', {colName:colName, value: value, format: 'email'}));
        }
        if(validator.format === 'lang' && value && Config.lang.list.indexOf(value) === -1) {
            result.errors.push(_createError(lineIdx, 'VALUE_FORMAT', {colName:colName, value: value, format: 'lang'}));
        }

        // Transformation
        if(validator.format === 'array' && value) {
            result.output = value.split(CsvConfig.default_array_delimiter);
            for(var i = 0 ; i < result.output.length ; i++) {
                result.output[i] = result.output[i].trim();
            }
        }
        if(validator.format === 'boolean' && value) {
            result.output = (result.output == "true" || result.output == "1");
        }


        // TODO ajouter la gestion de format 'number', 'float' et 'date'
        return result;
    }



    function _createError(lineIdx, code, data) {
        return {
            lineIdx: lineIdx,
            code: code,
            data: data
        }
    }

    function _compareColDesc(a, b) {
        return a.position - b.position;
    }

})();
