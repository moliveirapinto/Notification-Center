// check-appnotif.js — Check if D365 in-app notification entity is available
const { getToken, apiRequest } = require("./auth");

async function main() {
    const token = await getToken();

    // 1. Check entity metadata
    console.log("Checking appnotification entity...");
    try {
        const meta = await apiRequest("GET",
            "/api/data/v9.2/EntityDefinitions(LogicalName='appnotification')?$select=LogicalName,SchemaName,EntitySetName",
            token);
        console.log("Entity found:", meta.data.LogicalName);
        console.log("Entity set:", meta.data.EntitySetName);
    } catch (e) {
        console.log("Entity NOT found:", e.message.substring(0, 200));
        return;
    }

    // 2. Check columns
    console.log("\nChecking columns...");
    try {
        const cols = await apiRequest("GET",
            "/api/data/v9.2/EntityDefinitions(LogicalName='appnotification')/Attributes?$select=LogicalName,AttributeType&$filter=LogicalName eq 'title' or LogicalName eq 'body' or LogicalName eq 'ownerid' or LogicalName eq 'icontype' or LogicalName eq 'toasttype' or LogicalName eq 'data' or LogicalName eq 'ttlinseconds' or LogicalName eq 'priority'",
            token);
        cols.data.value.forEach(c => console.log("  " + c.LogicalName + " (" + c.AttributeType + ")"));
    } catch (e) {
        console.log("Column check error:", e.message.substring(0, 200));
    }

    // 3. Try creating a test notification for current user
    console.log("\nQuerying current user...");
    const me = await apiRequest("GET", "/api/data/v9.2/WhoAmI", token);
    const userId = me.data.UserId;
    console.log("User ID:", userId);

    console.log("\nCreating test in-app notification...");
    try {
        const notif = await apiRequest("POST", "/api/data/v9.2/appnotifications", token, {
            title: "Test Notification from Node.js",
            body: "If you see this toast in D365, the in-app notification system works!",
            "ownerid@odata.bind": "/systemusers(" + userId + ")",
            icontype: 100000000, // Info
            toasttype: 200000000, // Timed
            ttlinseconds: 120
        });
        console.log("SUCCESS! Notification created. Status:", notif.status);
        console.log("Check your D365 now - you should see a toast notification!");
    } catch (e) {
        console.log("Create error:", e.message.substring(0, 300));
    }
}

main().catch(e => {
    console.error("Error:", e.message);
    process.exit(1);
});
