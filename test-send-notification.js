// test-send-notification.js — End-to-end test: create a notification and push native D365 in-app notifications
const { getToken, apiRequest } = require("./auth");

async function main() {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    // 1. Get current user
    const me = await apiRequest("GET", "/api/data/v9.2/WhoAmI", token);
    const userId = me.data.UserId;
    console.log("Current user ID:", userId);

    // 2. Check if test notification already exists
    const existing = await apiRequest("GET",
        "/api/data/v9.2/maulabs_supervisornotifications?$filter=maulabs_title eq 'End-to-End Test Notification'&$select=maulabs_supervisornotificationid",
        token);

    let notifId;
    if (existing.data.value && existing.data.value.length > 0) {
        notifId = existing.data.value[0].maulabs_supervisornotificationid;
        console.log("Using existing test notification:", notifId);
        // Update it to Sent status
        await apiRequest("PATCH",
            "/api/data/v9.2/maulabs_supervisornotifications(" + notifId + ")",
            token,
            { maulabs_status: 2, maulabs_senton: new Date().toISOString() }
        );
    } else {
        // Create new notification
        console.log("\nCreating test notification...");
        const create = await apiRequest("POST",
            "/api/data/v9.2/maulabs_supervisornotifications",
            token,
            {
                maulabs_title: "End-to-End Test Notification",
                maulabs_message: "This is an automated test.\nIf you see this as a toast in D365, the full notification pipeline is working!",
                maulabs_priority: 1, // Important
                maulabs_status: 2,   // Sent
                maulabs_senton: new Date().toISOString()
            }
        );
        console.log("Notification created. Status:", create.status);

        // Get the ID
        const lookup = await apiRequest("GET",
            "/api/data/v9.2/maulabs_supervisornotifications?$filter=maulabs_title eq 'End-to-End Test Notification'&$select=maulabs_supervisornotificationid&$orderby=createdon desc&$top=1",
            token);
        notifId = lookup.data.value[0].maulabs_supervisornotificationid;
    }
    console.log("Notification ID:", notifId);

    // 3. Build action data (same format as NotificationCenter uses)
    const actionData = JSON.stringify({
        actions: [{
            title: "View Details",
            data: {
                url: "?pagetype=webresource&webresourceName=new_NotificationAlert&data=" + notifId,
                navigationTarget: "dialog"
            }
        }]
    });

    // 4. Send native D365 in-app notification to current user
    console.log("\nPushing native in-app notification to current user...");
    try {
        const result = await apiRequest("POST", "/api/data/v9.2/appnotifications", token, {
            title: "End-to-End Test Notification",
            body: "This is an automated test. If you see this as a toast in D365, the full notification pipeline is working!",
            "ownerid@odata.bind": "/systemusers(" + userId + ")",
            icontype: 100000002,    // Warning (Important)
            toasttype: 200000000,   // Timed
            ttlinseconds: 300,      // 5 minutes
            data: actionData
        });
        console.log("Native notification created! Status:", result.status);
    } catch (e) {
        console.error("Failed:", e.message);
        return;
    }

    // 5. Verify by querying recent appnotifications for this user
    console.log("\nVerifying appnotifications...");
    try {
        const verify = await apiRequest("GET",
            "/api/data/v9.2/appnotifications?$select=title,body,icontype,toasttype&$filter=title eq 'End-to-End Test Notification'&$orderby=createdon desc&$top=3",
            token);
        console.log("Found", verify.data.value.length, "notification(s) in appnotifications:");
        verify.data.value.forEach(n => {
            console.log("  Title:", n.title);
            console.log("  Body:", n.body);
            console.log("  Icon:", n.icontype);
            console.log("  ---");
        });
    } catch (e) {
        console.log("Verify error:", e.message.substring(0, 200));
    }

    console.log("\n════════════════════════════════════════════════");
    console.log("  TEST COMPLETE");
    console.log("  Check your D365 browser tab NOW.");
    console.log("  You should see a toast notification appear.");
    console.log("  Also check the bell icon in the D365 header.");
    console.log("════════════════════════════════════════════════\n");
}

main().catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
});
