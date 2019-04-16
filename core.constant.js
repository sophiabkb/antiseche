(function() {
    'use strict';

    angular
        .module('artips.admin.core')
        .constant('ADMIN', {
            module: {
                sectionPerModule: 4,
                lessonPerSection: 4,
                sectionPrefix: 'section_',
                lessonPrefix: 'lesson_',
                status: {
                    locked: 'anecdote',
                    unlocked: 'notions',
                    completed: 'completed'
                },
                feedback: {
                    toLearn: 'veuxLapprendre',
                    known: 'savaisDeja',
                    dontCare: 'menFous'
                }
            },
            roles: {
                admin: 'ADMIN',
                supervisor: 'SUPERVISOR'
            },
            userInfosItems: [
                'firstname',
                'lastname',
                'email',
                'lang',
                'group'
            ],
            gauge: {
                size: 130,
                thick: 15,
                type: 'arch',
                cap: 'round',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                foregroundGreen: '#02C385',
                foregroundYellow: '#FFE176'
            },
            grid: {rowHeight: 36},
            chart: {
                feedback: {
                    data: {
                        save: {
                            label: 'core.feedback.learn',
                            color: '#02C385'
                        },
                        ok: {
                            label: 'core.feedback.known',
                            color: '#FFE176'
                        },
                        ko: {
                            label: 'core.feedback.dontcare',
                            color: '#FF6C6C'
                        }
                    },
                    options: {cutoutPercentage: 70}
                }
            }
        });

})();