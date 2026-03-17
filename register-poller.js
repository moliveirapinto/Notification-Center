// register-poller.js — Register NotificationPoller.js on a D365 form OnLoad event
// Run: node register-poller.js

const { getToken, apiRequest } = require("./auth");

const WR_NAME = "maulabs_/scripts/NotificationPoller.js";
const FUNCTION_NAME = "NotificationPoller.onLoad";

async function main() {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    // 1. Get the web resource ID
    const wrResult = await apiRequest("GET",
        "/api/data/v9.2/webresourceset?$select=webresourceid,name&$filter=name eq '" + WR_NAME + "'",
        token);
    if (!wrResult.data.value || wrResult.data.value.length === 0) {
        throw new Error("Web resource not found: " + WR_NAME);
    }
    const wrId = wrResult.data.value[0].webresourceid;
    console.log("Poller web resource ID:", wrId);

    // 2. List available main forms for common entities
    const entities = ["contact", "account", "incident", "lead", "opportunity"];
    console.log("\nSearching for main forms...\n");

    const allForms = [];
    for (const entity of entities) {
        try {
            const r = await apiRequest("GET",
                "/api/data/v9.2/systemforms?$select=name,objecttypecode,formid&$filter=type eq 2 and objecttypecode eq '" + entity + "'",
                token);
            if (r.data.value && r.data.value.length > 0) {
                for (const f of r.data.value) {
                    allForms.push(f);
                    console.log("  Found: " + f.objecttypecode + " | " + f.name + " | " + f.formid);
                }
            }
        } catch (e) {
            // Entity might not exist, skip
        }
    }

    if (allForms.length === 0) {
        // Try to get ANY main form
        console.log("No forms found for common entities. Trying all main forms...");
        const r = await apiRequest("GET",
            "/api/data/v9.2/systemforms?$select=name,objecttypecode,formid&$filter=type eq 2&$top=20",
            token);
        if (r.data.value) {
            for (const f of r.data.value) {
                allForms.push(f);
                console.log("  Found: " + f.objecttypecode + " | " + f.name + " | " + f.formid);
            }
        }
    }

    if (allForms.length === 0) {
        throw new Error("No main forms found in the environment.");
    }

    // 3. Pick the first Contact or Account form, or whatever is available
    let targetForm = allForms.find(f => f.objecttypecode === "contact")
        || allForms.find(f => f.objecttypecode === "account")
        || allForms[0];

    console.log("\nTarget form: " + targetForm.name + " (" + targetForm.objecttypecode + ") [" + targetForm.formid + "]");

    // 4. Get the form XML
    const formResult = await apiRequest("GET",
        "/api/data/v9.2/systemforms(" + targetForm.formid + ")?$select=formxml",
        token);
    let formXml = formResult.data.formxml;

    // Check if already registered
    if (formXml.indexOf(WR_NAME) >= 0 || formXml.indexOf("NotificationPoller") >= 0) {
        console.log("\n*** NotificationPoller is ALREADY registered on this form! ***");
        console.log("The poller should be running when you open a " + targetForm.objecttypecode + " record.");
        console.log("If it still doesn't work, check the browser console (F12) for [NotifPoller] logs.");
        return;
    }

    // 5. Add the web resource library and OnLoad event handler to the form XML
    console.log("\nAdding NotificationPoller to form XML...");

    // Add library reference in <form> -> <formLibraries>
    const libraryTag = '<Library name="' + WR_NAME + '" libraryUniqueId="{' + wrId + '}" />';

    if (formXml.indexOf("<formLibraries>") >= 0) {
        formXml = formXml.replace("</formLibraries>", libraryTag + "</formLibraries>");
    } else if (formXml.indexOf("</form>") >= 0) {
        formXml = formXml.replace("</form>", "<formLibraries>" + libraryTag + "</formLibraries></form>");
    }

    // Add OnLoad event handler in <events>
    const eventTag = '<Handler functionName="' + FUNCTION_NAME + '" libraryName="' + WR_NAME + '" handlerUniqueId="{' + generateGuid() + '}" enabled="true" parameters="" passExecutionContext="true" />';

    if (formXml.indexOf('<event name="onload"') >= 0) {
        // Add handler to existing onload event
        if (formXml.indexOf('<event name="onload">') >= 0) {
            formXml = formXml.replace('<event name="onload">', '<event name="onload"><Handlers>' + eventTag + '</Handlers>');
        } else {
            // Has onload with attributes - find closing > and insert handlers
            formXml = formXml.replace(/(<event name="onload"[^>]*>)/, '$1<Handlers>' + eventTag + '</Handlers>');
        }
    } else {
        // No onload event exists, add events section
        if (formXml.indexOf("<events>") >= 0) {
            formXml = formXml.replace("<events>", '<events><event name="onload" application="false" active="false"><Handlers>' + eventTag + '</Handlers></event>');
        } else if (formXml.indexOf("</form>") >= 0) {
            formXml = formXml.replace("</form>", '<events><event name="onload" application="false" active="false"><Handlers>' + eventTag + '</Handlers></event></events></form>');
        }
    }

    // 6. Update the form
    console.log("Updating form...");
    await apiRequest("PATCH",
        "/api/data/v9.2/systemforms(" + targetForm.formid + ")",
        token,
        { formxml: formXml },
        { "MSCRM.MergeLabels": "true" }
    );
    console.log("Form updated!");

    // 7. Publish
    console.log("Publishing...");
    await apiRequest("POST", "/api/data/v9.2/PublishXml", token, {
        ParameterXml: "<importexportxml><entities><entity>" + targetForm.objecttypecode + "</entity></entities></importexportxml>"
    });
    console.log("Published!\n");

    console.log("════════════════════════════════════════════════");
    console.log("  NotificationPoller.js registered on:");
    console.log("    Form: " + targetForm.name);
    console.log("    Entity: " + targetForm.objecttypecode);
    console.log("  ");
    console.log("  Open any " + targetForm.objecttypecode + " record in D365");
    console.log("  to start receiving notifications.");
    console.log("════════════════════════════════════════════════\n");
}

function generateGuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

main().catch(err => {
    console.error("\nError:", err.message);
    process.exit(1);
});
