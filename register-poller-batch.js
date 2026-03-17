// register-poller-batch.js — Register NotificationPoller.js on multiple forms
// Run: node register-poller-batch.js

const { getToken, apiRequest } = require("./auth");

const WR_NAME = "maulabs_/scripts/NotificationPoller.js";
const FUNCTION_NAME = "NotificationPoller.onLoad";

function generateGuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

async function registerOnForm(token, wrId, formId, formName, entity) {
    const formResult = await apiRequest("GET",
        "/api/data/v9.2/systemforms(" + formId + ")?$select=formxml", token);
    let xml = formResult.data.formxml;

    if (xml.indexOf("NotificationPoller") >= 0) {
        console.log("  [SKIP] Already registered: " + formName);
        return false;
    }

    const lib = '<Library name="' + WR_NAME + '" libraryUniqueId="{' + wrId + '}" />';
    const handler = '<Handler functionName="' + FUNCTION_NAME + '" libraryName="' + WR_NAME
        + '" handlerUniqueId="{' + generateGuid() + '}" enabled="true" parameters="" passExecutionContext="true" />';

    // Add library
    if (xml.indexOf("<formLibraries>") >= 0) {
        xml = xml.replace("</formLibraries>", lib + "</formLibraries>");
    } else {
        xml = xml.replace("</form>", "<formLibraries>" + lib + "</formLibraries></form>");
    }

    // Add onload handler
    if (xml.indexOf('<event name="onload"') >= 0) {
        xml = xml.replace(/<event name="onload"([^>]*)>/, '<event name="onload"$1><Handlers>' + handler + '</Handlers>');
    } else if (xml.indexOf("<events>") >= 0) {
        xml = xml.replace("<events>",
            '<events><event name="onload" application="false" active="false"><Handlers>' + handler + '</Handlers></event>');
    } else {
        xml = xml.replace("</form>",
            '<events><event name="onload" application="false" active="false"><Handlers>' + handler + '</Handlers></event></events></form>');
    }

    await apiRequest("PATCH",
        "/api/data/v9.2/systemforms(" + formId + ")",
        token,
        { formxml: xml },
        { "MSCRM.MergeLabels": "true" }
    );
    console.log("  [OK] Registered: " + formName + " (" + entity + ")");
    return true;
}

async function main() {
    console.log("Authenticating...");
    const token = await getToken();
    console.log("Authenticated.\n");

    // Get poller web resource ID
    const wrResult = await apiRequest("GET",
        "/api/data/v9.2/webresourceset?$select=webresourceid&$filter=name eq '" + WR_NAME + "'",
        token);
    const wrId = wrResult.data.value[0].webresourceid;
    console.log("Poller WR ID:", wrId, "\n");

    // Target forms — key Contact, Account, Case forms
    const targets = [
        { id: "1fed44d1-ae68-4a41-bd2b-f13acac4acfa", name: "Contact", entity: "contact" },
        { id: "894cc46a-b0cb-4ab0-8bf6-200544e46a2d", name: "Information (Contact)", entity: "contact" },
        { id: "8448b78f-8f42-454e-8e2a-f8196b0419af", name: "Account", entity: "account" },
        { id: "b053a39a-041a-4356-acef-ddf00182762b", name: "Information (Account)", entity: "account" },
        { id: "4a63c8d1-6c1e-48ec-9db4-3e6c7155334c", name: "Case", entity: "incident" },
        { id: "cd0d48a0-10c6-ec11-a7b5-000d3a58b83a", name: "Case form", entity: "incident" },
    ];

    const modified = new Set();
    for (const t of targets) {
        try {
            const ok = await registerOnForm(token, wrId, t.id, t.name, t.entity);
            if (ok) modified.add(t.entity);
        } catch (e) {
            console.log("  [ERR] " + t.name + ": " + e.message.substring(0, 120));
        }
    }

    // Publish modified entities
    if (modified.size > 0) {
        console.log("\nPublishing...");
        const pubXml = "<importexportxml><entities>"
            + Array.from(modified).map(e => "<entity>" + e + "</entity>").join("")
            + "</entities></importexportxml>";
        await apiRequest("POST", "/api/data/v9.2/PublishXml", token, { ParameterXml: pubXml });
        console.log("Published: " + Array.from(modified).join(", "));
    }

    console.log("\n════════════════════════════════════════════════");
    console.log("  Done! Open any Contact, Account, or Case record");
    console.log("  in D365 to trigger the notification poller.");
    console.log("════════════════════════════════════════════════\n");
}

main().catch(err => {
    console.error("\nError:", err.message);
    process.exit(1);
});
