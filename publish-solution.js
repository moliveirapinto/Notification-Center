// publish-solution.js — Creates/updates web resources in D365 and publishes.
// Run: node publish-solution.js

const { getToken, apiRequest } = require("./auth");
const fs = require("fs");
const path = require("path");

const SOLUTION_NAME = "SupervisorNotifications";

// Web resources to deploy
const WEB_RESOURCES = [
    { file: "NotificationPoller.js",      name: "maulabs_/scripts/NotificationPoller.js", type: 3, display: "Notification Poller" },
    { file: "new_NotificationAlert.htm",  name: "new_NotificationAlert",                type: 1, display: "Notification Alert Popup" },
    { file: "new_NotificationCenter.htm", name: "new_NotificationCenter",               type: 1, display: "Notification Center Admin" },
];

async function main() {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    const wrIds = [];

    for (const wr of WEB_RESOURCES) {
        console.log(`── ${wr.display} (${wr.name}) ──`);

        // Read local file & base64 encode
        const filePath = path.join(__dirname, wr.file);
        const content = fs.readFileSync(filePath, "utf-8");
        const base64 = Buffer.from(content, "utf-8").toString("base64");

        // Check if web resource already exists
        const lookup = await apiRequest("GET",
            `/api/data/v9.2/webresourceset?$filter=name eq '${wr.name}'&$select=webresourceid,name`,
            token);

        let wrId;
        if (lookup.data.value && lookup.data.value.length > 0) {
            // Update existing
            wrId = lookup.data.value[0].webresourceid;
            console.log(`  Found existing: ${wrId}`);
            console.log("  Updating content...");
            await apiRequest("PATCH",
                `/api/data/v9.2/webresourceset(${wrId})`, token,
                { content: base64, webresourcetype: wr.type });
            console.log("  ✔ Updated");
        } else {
            // Create new
            console.log("  Creating new web resource...");
            const createResult = await apiRequest("POST",
                "/api/data/v9.2/webresourceset", token, {
                    name: wr.name,
                    displayname: wr.display,
                    content: base64,
                    webresourcetype: wr.type
                });

            // Extract ID from OData-EntityId header or re-query
            const reQuery = await apiRequest("GET",
                `/api/data/v9.2/webresourceset?$filter=name eq '${wr.name}'&$select=webresourceid`,
                token);
            wrId = reQuery.data.value[0].webresourceid;
            console.log(`  ✔ Created: ${wrId}`);
        }

        wrIds.push(wrId);

        // Add to solution
        console.log("  Adding to solution...");
        try {
            await apiRequest("POST", "/api/data/v9.2/AddSolutionComponent", token, {
                ComponentId: wrId,
                ComponentType: 61,   // Web Resource
                SolutionUniqueName: SOLUTION_NAME,
                AddRequiredComponents: false,
                IncludedComponentSettingsValues: null
            });
            console.log("  ✔ Added to solution");
        } catch (err) {
            if (/already exists/i.test(err.message)) {
                console.log("  – Already in solution");
            } else {
                throw err;
            }
        }
    }

    // Publish
    console.log("\n── Publishing ──");
    const publishXml = `<importexportxml><webresources>${wrIds.map(id => `<webresource>{${id}}</webresource>`).join("")}</webresources></importexportxml>`;
    await apiRequest("POST", "/api/data/v9.2/PublishXml", token, {
        ParameterXml: publishXml
    });
    console.log("  ✔ Published!\n");

    console.log("════════════════════════════════════════════════");
    console.log("  ✅ Web resources deployed and published!");
    console.log("  Web resources:");
    WEB_RESOURCES.forEach(wr => console.log(`     • ${wr.name}`));
    console.log("════════════════════════════════════════════════\n");
}

main().catch(err => {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
});
