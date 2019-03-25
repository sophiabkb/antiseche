(function() {
    'use strict';

    // External dependencies
    const lodash = require('lodash');

    // Internal dependencies
    const JsonConfig = require('../../core/conf.core').json;


    // Angular email regexp (la même que celle utilisée dans Chromium)


    // Interface
    exports.processAttributes = processAttributes;
    exports.processData = processData;
    exports.getDescriptor = getDescriptor;


    /**
     * @description
     * @param descriptor
     * @param fields
     * @return {{}|{style: {position: string, top: string, width: string, height: string}}|attributes|{style}|ActiveX.ISchemaItemCollection|boolean|*}
     */
    function processAttributes(descriptor, fields) {
        let attributes = descriptor.attributes;
        // Processing des attributs (choix)
        if(fields) {
            attributes = lodash.filter(attributes, (c) => fields.indexOf(c.id) !== -1 || c.required);
        }
        return attributes;
    }

    /**
     * @description
     * @param attributes
     * @param data
     * @return {{}}
     */
    function processData(attributes, data) {
        const result = {};
        for(let idx = 0; idx < attributes.length; idx++) {
            const attribute = attributes[idx];
            result[attribute.newPath || attribute.id] = lodash.get(data, attribute.path);
        }
        return result;
    }

    /**
     * @description
     * @param name
     * @return {*}
     */
    function getDescriptor(name) {
        const result = JsonConfig.descriptor[name];
        if(!result) {
            throw new Error('JSON descriptor ' + name + ' NOT FOUND!');
        }
        return result;
    }


})();
