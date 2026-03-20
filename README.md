# Supervisor Notification Center

A real-time notification system for **Dynamics 365** that enables supervisors to create, schedule, and send notifications directly to agents — with acknowledgment tracking, category management, and analytics.

![Agent View](img/Agent.jpeg)

![Supervisor View](img/Supervisor.jpeg)

![Dashboard](img/dash.jpeg)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Solution Components](#solution-components)
- [Entities](#entities)
- [Installation](#installation)
- [Add to the Sitemap (Admin Center)](#add-to-the-sitemap-admin-center)
- [Usage Guide](#usage-guide)
  - [Creating Notifications](#creating-notifications)
  - [Managing Categories](#managing-categories)
  - [Reports & Analytics](#reports--analytics)
- [Agent Experience](#agent-experience)
- [Solution Export](#solution-export)
- [License](#license)

---

## Overview

The Supervisor Notification Center is a custom Dynamics 365 solution that provides a centralized hub for supervisors to communicate with agents in real time. Agents receive native D365 in-app notification toasts and global banners, with optional acknowledgment tracking — giving supervisors full visibility into who has read each message.

The solution is fully portable — no hardcoded environment values. All API calls use relative OData paths and the org URL is resolved at runtime via `Xrm.Utility.getGlobalContext().getClientUrl()`.

---

## Features

- **Real-time delivery** — Agents receive native D365 in-app notification toasts plus a global banner visible on every D365 page
- **Scheduling** — Schedule notifications for future delivery with timezone support (19+ timezones including UTC, US, Americas, Europe, Asia/Pacific)
- **Acknowledgment tracking** — Track which agents have acknowledged each notification with timestamps and drill-down agent lists
- **Categories** — Organize notifications by type with custom emoji icons and color-coded badges
- **Queue targeting** — Send to specific queues (multi-select with search) or broadcast to all agents
- **Rich content** — Attach images (via URL paste or drag-and-drop upload as D365 web resources) and action links
- **Priority levels** — Normal, Important, and Urgent with visual indicators and banner escalation
- **Reports dashboard** — KPI cards, acknowledgment rate charts, timeline charts, and per-notification drill-down (D3.js v7)
- **Draft management** — Save as draft, edit later, send when ready
- **Clone notifications** — Duplicate a sent notification to quickly compose a similar one
- **Preview** — See exactly how agents will see the notification before sending
- **Responsive design** — Works across desktop and tablet screen sizes
- **Built-in help** — Learn modal explaining app usage

---

## How It Works

```
┌─────────────────────────────────────┐
│        NotificationCenter           │  ← Supervisor admin UI (3 tabs)
│  Notifications │ Categories │Reports│
└────────────┬────────────────────────┘
             │ Creates records + sends native
             │ D365 in-app notifications
             ▼
┌─────────────────────────────────────┐
│         Dynamics 365 Dataverse      │
│  maulabs_supervisornotification     │
│  maulabs_notificationack            │
│  maulabs_notificationcategory       │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│      NotificationPoller.js          │  ← Runs on every D365 form
│  Polls every 15s for unacked        │
│  notifications, shows global banner │
└────────────┬────────────────────────┘
             │ Agent clicks "View Details"
             ▼
┌─────────────────────────────────────┐
│        NotificationAlert            │  ← Agent popup dialog
│  Shows full content + image + link  │
│  with Acknowledge button            │
└─────────────────────────────────────┘
```

1. **Supervisor creates a notification** in the Notification Center (draft, scheduled, or immediate send)
2. **On send**, the system creates native D365 `appnotification` records for all target users (or queue members), each with a "View Details" action
3. **NotificationPoller.js** runs on every form load across D365, polling the Dataverse every 15 seconds for unacknowledged notifications
4. **Agents see a global banner** at the top of any D365 page. Clicking "View Details" opens the rich notification popup
5. **Agent acknowledges** — an ack record is created with a timestamp, and the supervisor can track this in the Reports tab

---

## Solution Components

| Component | D365 Name | Type | Purpose |
|-----------|-----------|------|---------|
| Supervisor Notification | `maulabs_supervisornotification` | Table (Entity) | Stores notifications created by supervisors — title, message, priority, status, scheduling, and targeting |
| Notification Ack | `maulabs_notificationack` | Table (Entity) | Tracks agent acknowledgments with timestamps |
| Notification Category | `maulabs_notificationcategory` | Table (Entity) | Defines notification categories with emoji icons and colors |
| Notification Center | `new_NotificationCenter` | HTML Web Resource | Supervisor admin interface — create, manage, and analyze notifications |
| Notification Alert | `new_NotificationAlert` | HTML Web Resource | Agent-facing popup showing full notification content with acknowledge button |
| Notification Poller | `maulabs_/scripts/NotificationPoller.js` | JS Web Resource | Background polling script — shows global banners on all D365 pages |
| Alert icon | `maulabs_ic_fluent_alert_on_24_regular` | SVG Web Resource | Fluent UI alert icon |
| Edit icon | `maulabs_ic_fluent_edit_48_regular` | SVG Web Resource | Fluent UI edit icon |
| Delete icon | `maulabs_ic_fluent_delete_48_regular2` | SVG Web Resource | Fluent UI delete icon |

---

## Entities

### maulabs_supervisornotification
Stores all notifications created by supervisors.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_title` | String | Notification title (max 500 chars) |
| `maulabs_message` | Memo | Notification body (max 10,000 chars) |
| `maulabs_priority` | Integer | 0 = Normal, 1 = Important, 2 = Urgent |
| `maulabs_status` | Integer | 0 = Draft, 1 = Scheduled, 2 = Sent |
| `maulabs_category` | String | Category name (denormalized) |
| `maulabs_categoryid` | Lookup | Reference to notification category |
| `maulabs_imageurl` | String | Image URL or uploaded web resource path |
| `maulabs_linkurl` | String | Optional action link URL |
| `maulabs_linktext` | String | Link button label |
| `maulabs_senton` | DateTime | When the notification was sent |
| `maulabs_scheduledon` | DateTime | Scheduled delivery time (UTC) |
| `maulabs_targetqueue` | String | Comma-separated queue GUIDs (empty = broadcast to all) |

### maulabs_notificationack
Tracks agent acknowledgments.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_name` | String | Auto-generated: "{username} - {title}" |
| `maulabs_notificationid` | String | Notification ID (lowercase GUID) |
| `maulabs_acknowledgedon` | DateTime | When the agent acknowledged |

### maulabs_notificationcategory
Defines notification categories.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_name` | String | Category name |
| `maulabs_emoji` | String | Display emoji icon |
| `maulabs_color` | String | Hex color code |
| `maulabs_description` | String | Optional description |

---

## Installation

### Prerequisites
- Dynamics 365 environment with Dataverse
- System Administrator or System Customizer security role

### Steps

1. **Download** the latest solution zip file from the [Releases](../../releases) page

2. **Go to** [Power Apps](https://make.powerapps.com) and select your target environment

3. **Navigate to Solutions** — click **Solutions** in the left navigation pane

4. **Import the solution**:
   - Click **Import solution** in the command bar
   - Click **Browse** and select the downloaded `.zip` file
   - Click **Next**
   - Review the solution details and click **Import**
   - Wait for the import to complete — you will see a success notification

5. **Publish all customizations** — after the import completes, click **Publish all customizations** in the command bar to make all components active

---

## Add to the Sitemap (Admin Center)

After importing the solution, create a menu item so supervisors can access the Notification Center directly from the D365 navigation.

1. **Go to** [Power Apps](https://make.powerapps.com) and select your environment

2. **Open the App Designer**:
   - Click **Apps** in the left navigation pane
   - Find the model-driven app you want to add the menu item to (e.g., **Customer Service Admin Center** or any other app)
   - Click the **...** (More options) menu next to the app and select **Edit** to open the App Designer

3. **Edit the Sitemap**:
   - In the App Designer, click the **Navigation** tab (pencil icon on the sitemap area)
   - Choose the **Area** and **Group** where you want the menu item to appear (e.g., under **Service** or create a new group)

4. **Add a new Subarea**:
   - Click **+ Add** → **Subarea**
   - Configure the subarea properties:
     - **Content Type**: Web Resource
     - **URL**: `new_NotificationCenter`
     - **Title**: `Notification Center` (or your preferred label)

5. **Set the icon**:
   - In the subarea properties, look for the **Icon** field
   - Select **Use a web resource**
   - Search for and select: **`ic_fluent_alert_on_24_regular`** — this Fluent UI alert icon is included in the solution

6. **Save and Publish**:
   - Click **Save** in the App Designer
   - Click **Publish** to make the changes live

Supervisors will now see the **Notification Center** menu item in the D365 left navigation and can access it directly.

---

## Usage Guide

### Creating Notifications

1. Click **+ New Notification** to open the compose modal
2. Fill in **Title** and **Message** (required)
3. Optionally configure:
   - **Category** — select from your custom categories
   - **Priority** — Normal, Important, or Urgent
   - **Target Queue** — search and select specific queues, or leave empty to broadcast to everyone
   - **Image** — paste a URL or drag-and-drop upload (PNG, JPG, GIF, SVG up to 5MB — uploaded as a D365 web resource)
   - **Link** — add a URL with custom button text
4. Choose an action:
   - **Save Draft** — save without sending
   - **Schedule** — pick a future date/time and timezone
   - **Preview** — see how agents will see it
   - **Send Now** — deliver immediately via native D365 in-app notifications + global banners

Additional actions on existing notifications:
- **Edit** or **Delete** drafts
- **Send Now** or **Cancel** scheduled notifications
- **View Details** or **Clone** sent notifications

### Managing Categories

1. Go to the **Categories** tab
2. Click **+ New Category**
3. Set a **name**, pick an **emoji** (from the grid or type your own), choose a **color** (presets or custom picker), and add an optional **description**
4. Categories appear as colored badges with emoji on notifications throughout the app

### Reports & Analytics

1. Go to the **Reports** tab
2. Filter by date range using the From/To inputs
3. View **KPI cards**: Total Sent, Scheduled, Drafts, Acknowledgments, and Total Notifications
4. Analyze the **Acknowledgment Rate Chart** — horizontal bars color-coded by rate (green ≥80%, orange 50–79%, red <50%). Click any bar to drill down
5. Review the **Acknowledgments Over Time** chart — stacked daily view of sent vs. acknowledged
6. Browse the **notification card list** — click any card to drill down into:
   - Acknowledged vs. Pending agent counts
   - Acknowledgment timeline chart (hourly breakdown)
   - Searchable agent lists showing who acknowledged and who hasn't

---

## Agent Experience

When a notification is sent, agents see it in two ways:

1. **Native D365 in-app notification toast** — appears in the D365 notification bell. Priority maps to notification severity (Info, Warning, Error)
2. **Global banner** — a colored banner at the top of any D365 page, shown by the poller. Urgent notifications appear as red error-level banners, Important as yellow warnings

Clicking **"View Details"** on either opens a styled popup dialog showing:
- Category badge and priority indicator
- Full message with preserved formatting
- Attached image (if any)
- Action link button (if any)
- **Acknowledge** button — creates a timestamped ack record and shows a success confirmation

The poller deduplicates notifications using both `window.top` memory and `localStorage`, so agents won't see the same notification banner twice even after navigating between pages.

---

## Solution Export

This solution is fully portable across D365 environments:

- ✅ No hardcoded org URLs or environment GUIDs
- ✅ Dynamic base URL via `Xrm.Utility.getGlobalContext()`
- ✅ Entity schema names are consistent across environments
- ✅ All API calls use relative OData paths

To export, use the standard D365 solution export process.

---

## License

MIT
