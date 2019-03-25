/* global require*/
(function () {
    'use strict';

    // External dependencies

    // Internal dependencies
    const GroupsDAO = require('../dao/groups.dao');

    // Interface du service
    exports.getGroupById = getGroupById;
    exports.getAllGroups = getAllGroups;

    // Implémentation
    function getGroupById(dbInfos, groupId) {
        return GroupsDAO.getGroupById(dbInfos, groupId);
    }

    function getAllGroups(dbInfos) {
        return GroupsDAO.getAllGroups(dbInfos);
    }



})();