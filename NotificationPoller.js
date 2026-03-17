/// <reference path="Xrm" />
// Supervisor Notification Poller - Global edition
// Register on ANY form OnLoad event (Contact, Account, Dashboard, etc.).
// The polling timer is stored on window.top so it survives page navigation.
// Notifications appear as a global app banner visible on EVERY D365 page
// using Xrm.App.addGlobalNotification(). Clicking "View Details" opens the
// rich popup.

var NotificationPoller = (function () {
    "use strict";

    var NOTIF_ENTITY = "maulabs_supervisornotification";
    var ACK_ENTITY = "maulabs_notificationack";
    var POLL_INTERVAL_MS = 15000;
    var STORAGE_KEY = "_notifPollerShown";
    var TOP_TIMER_KEY = "_notifPollerTimer";
    var TOP_MAP_KEY = "_notifPollerShownMap";
    var TOP_BANNER_KEY = "_notifPollerBanners";
    var TOP_QUEUES_KEY = "_notifPollerUserQueues";

    // -- Duplicate prevention: window.top + localStorage --
    function _topMap() {
        try {
            if (!window.top[TOP_MAP_KEY]) window.top[TOP_MAP_KEY] = {};
            return window.top[TOP_MAP_KEY];
        } catch (e) { return null; }
    }

    function isNotifShown(notifId) {
        var key = notifId.toLowerCase();
        try { var tm = _topMap(); if (tm && tm[key]) return true; } catch (e) {}
        try {
            var map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            if (map[key]) {
                try { var tm2 = _topMap(); if (tm2) tm2[key] = map[key]; } catch (e2) {}
                return true;
            }
        } catch (e) {}
        return false;
    }

    function markNotifShown(notifId) {
        var key = notifId.toLowerCase();
        var ts = Date.now();
        try { var tm = _topMap(); if (tm) tm[key] = ts; } catch (e) {}
        try {
            var map = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            var keys = Object.keys(map);
            if (keys.length > 200) {
                keys.sort(function (a, b) { return map[a] - map[b]; });
                for (var i = 0; i < keys.length - 150; i++) delete map[keys[i]];
            }
            map[key] = ts;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
        } catch (e) {}
    }

    // -- Entry point --
    function onLoad(executionContext) {
        console.log("[NotifPoller] onLoad fired");
        startPolling();
    }

    function startPolling() {
        try {
            if (window.top[TOP_TIMER_KEY]) {
                console.log("[NotifPoller] Global polling already running (window.top)");
                return;
            }
        } catch (e) {}

        var userId = Xrm.Utility.getGlobalContext()
            .userSettings.userId.replace(/[{}]/g, "").toLowerCase();
        console.log("[NotifPoller] Global polling started for userId: " + userId);

        try { if (!window.top[TOP_BANNER_KEY]) window.top[TOP_BANNER_KEY] = {}; } catch (e) {}

        // Load user's queue memberships before starting to poll
        loadUserQueues(userId, function () {
            checkForNotifications(userId);
            var timerId = setInterval(function () {
                checkForNotifications(userId);
            }, POLL_INTERVAL_MS);

            try { window.top[TOP_TIMER_KEY] = timerId; } catch (e) {}
        });
    }

    function loadUserQueues(userId, callback) {
        try {
            if (window.top[TOP_QUEUES_KEY]) {
                console.log("[NotifPoller] User queues already cached");
                callback();
                return;
            }
        } catch (e) {}

        var fetchXml = '<fetch>' +
            '<entity name="queue">' +
            '<attribute name="queueid" />' +
            '<link-entity name="queuemembership" from="queueid" to="queueid" intersect="true">' +
            '<filter><condition attribute="systemuserid" operator="eq" value="' + userId + '" /></filter>' +
            '</link-entity>' +
            '</entity>' +
            '</fetch>';

        Xrm.WebApi.retrieveMultipleRecords(
            "queue",
            "?fetchXml=" + encodeURIComponent(fetchXml)
        ).then(
            function (results) {
                var qMap = {};
                if (results.entities) {
                    results.entities.forEach(function (q) {
                        qMap[q.queueid.toLowerCase()] = true;
                    });
                }
                try { window.top[TOP_QUEUES_KEY] = qMap; } catch (e) {}
                console.log("[NotifPoller] User queue memberships loaded: " + Object.keys(qMap).length);
                callback();
            },
            function (err) {
                console.error("[NotifPoller] Failed to load user queues: " + err.message);
                try { window.top[TOP_QUEUES_KEY] = {}; } catch (e) {}
                callback();
            }
        );
    }

    function isUserInTargetQueues(targetQueue) {
        if (!targetQueue) return true; // No queue targeting = show to everyone
        var qMap;
        try { qMap = window.top[TOP_QUEUES_KEY]; } catch (e) { return true; }
        if (!qMap) return true;
        var ids = targetQueue.split(',');
        for (var i = 0; i < ids.length; i++) {
            if (qMap[ids[i].trim().toLowerCase()]) return true;
        }
        return false;
    }

    function checkForNotifications(userId) {
        var now = new Date().toISOString();
        var select = "$select=maulabs_supervisornotificationid,maulabs_title,maulabs_priority,maulabs_status,maulabs_targetqueue";
        var filter = "$filter=(maulabs_status eq 2) or (maulabs_status eq 1 and maulabs_scheduledon le " + now + ")";
        var orderby = "$orderby=createdon desc";

        Xrm.WebApi.retrieveMultipleRecords(
            NOTIF_ENTITY,
            "?" + select + "&" + filter + "&" + orderby
        ).then(
            function (results) {
                if (!results.entities || results.entities.length === 0) return;
                checkNextUnacked(results.entities, 0, userId);
            },
            function (err) {
                console.error("[NotifPoller] Poll error: " + err.message);
            }
        );
    }

    function checkNextUnacked(notifications, idx, userId) {
        if (idx >= notifications.length) return;

        var notif = notifications[idx];
        var notifId = notif.maulabs_supervisornotificationid.toLowerCase();

        if (isNotifShown(notifId)) {
            checkNextUnacked(notifications, idx + 1, userId);
            return;
        }

        // Skip if notification targets specific queues and user is not a member
        if (!isUserInTargetQueues(notif.maulabs_targetqueue)) {
            markNotifShown(notifId);
            checkNextUnacked(notifications, idx + 1, userId);
            return;
        }

        Xrm.WebApi.retrieveMultipleRecords(
            ACK_ENTITY,
            "?$select=maulabs_notificationackid&$filter=maulabs_notificationid eq '" + notifId + "' and _ownerid_value eq " + userId + "&$top=1"
        ).then(
            function (ackResult) {
                if (ackResult.entities && ackResult.entities.length > 0) {
                    markNotifShown(notifId);
                } else {
                    showGlobalBanner(notif);
                }
                checkNextUnacked(notifications, idx + 1, userId);
            },
            function (err) {
                console.error("[NotifPoller] Ack check error: " + err.message);
                checkNextUnacked(notifications, idx + 1, userId);
            }
        );
    }

    // -- Global notification banner (visible on ALL D365 pages) --
    function showGlobalBanner(notif) {
        var notifId = notif.maulabs_supervisornotificationid.toLowerCase();
        markNotifShown(notifId);

        try {
            if (window.top[TOP_BANNER_KEY] && window.top[TOP_BANNER_KEY][notifId]) return;
        } catch (e) {}

        // Map priority to Xrm level: 4=Info, 3=Warning, 2=Error
        var priorityLevelMap = [4, 3, 2];
        var priorityPrefixMap = ["", "IMPORTANT: ", "URGENT: "];
        var priority = notif.maulabs_priority || 0;
        var level = priorityLevelMap[priority] || 4;
        var prefix = priorityPrefixMap[priority] || "";

        var title = notif.maulabs_title || "Notification";
        var message = prefix + title;

        console.log("[NotifPoller] Showing global banner: " + message);

        Xrm.App.addGlobalNotification({
            type: 2,
            level: level,
            message: message,
            showCloseButton: true,
            action: {
                actionLabel: "View Details",
                eventHandler: function () {
                    openNotificationPopup(notifId);
                }
            }
        }).then(
            function (bannerId) {
                console.log("[NotifPoller] Banner shown: " + bannerId);
                try { window.top[TOP_BANNER_KEY][notifId] = bannerId; } catch (e) {}
            },
            function (err) {
                console.error("[NotifPoller] Banner error: " + err.message);
                openNotificationPopup(notifId);
            }
        );
    }

    // -- Detail popup (opened from banner action on any page) --
    function openNotificationPopup(notifId) {
        console.log("[NotifPoller] Opening popup: " + notifId);

        Xrm.Navigation.navigateTo(
            {
                pageType: "webresource",
                webresourceName: "new_NotificationAlert",
                data: notifId
            },
            {
                target: 2,
                position: 1,
                width: { value: 400, unit: "px" },
                height: { value: 560, unit: "px" },
                title: "Supervisor Notification"
            }
        ).then(
            function () {
                try {
                    var bannerId = window.top[TOP_BANNER_KEY][notifId];
                    if (bannerId) {
                        Xrm.App.clearGlobalNotification(bannerId);
                        delete window.top[TOP_BANNER_KEY][notifId];
                    }
                } catch (e) {}
            },
            function (err) { console.error("[NotifPoller] Popup error: " + err.message); }
        );
    }

    return {
        onLoad: onLoad
    };
})();