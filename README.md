# Supervisor Notification Center

A real-time notification system for **Dynamics 365** that enables supervisors to create, schedule, and send notifications directly to agents — with acknowledgment tracking, category management, and analytics.

![Agent View](img/Agent.jpeg)

![Supervisor View](img/Supervisor.jpeg)

![Dashboard](img/dash.jpeg)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Web Resources](#web-resources)
- [Entities](#entities)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
  - [Notifications](#notifications)
  - [Categories](#categories)
  - [Reports](#reports)
- [Screenshots](#screenshots)
- [Solution Export](#solution-export)
- [License](#license)

---

## Overview

The Supervisor Notification Center is a custom Dynamics 365 solution that provides a centralized hub for supervisors to communicate with agents in real time. Agents receive in-app pop-up alerts with optional acknowledgment tracking, giving supervisors visibility into who has read each message.

The solution is fully portable — no hardcoded environment values — and can be exported and imported across D365 environments.

---

## Features

- **Real-time notifications** — Agents receive pop-up alerts via D365 native in-app notifications and a global banner system
- **Scheduling** — Schedule notifications for future delivery with timezone support
- **Acknowledgment tracking** — Require agents to acknowledge notifications; track who has and hasn't responded
- **Categories** — Organize notifications by type with custom emojis and colors
- **Queue targeting** — Send notifications to specific queues or broadcast to all agents
- **Rich content** — Include images (URL or direct upload), links, and formatted messages
- **Image upload** — Upload images directly as D365 web resources via drag-and-drop
- **Priority levels** — Normal, Important, and Urgent with visual indicators
- **Reports dashboard** — Analytics with KPI cards, acknowledgment timelines (D3.js charts), and per-notification drill-down
- **Draft management** — Save notifications as drafts and edit before sending
- **Responsive design** — Works across desktop and tablet screen sizes
- **Learn modal** — Built-in help guide explaining app usage

---

## Architecture

```
┌─────────────────────────────────────┐
│       NotificationCenter.htm        │  ← Admin UI (3 tabs)
│  Notifications │ Categories │Reports│
└────────────┬────────────────────────┘
             │ OData v9.2 API
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
│  Polls for new notifications every  │
│  15 seconds, shows global banners   │
└────────────┬────────────────────────┘
             │ Opens on "View Details"
             ▼
┌─────────────────────────────────────┐
│      NotificationAlert.htm          │  ← Agent popup
│  Shows full notification content    │
│  with Acknowledge button            │
└─────────────────────────────────────┘
```

---

## Web Resources

| File | D365 Name | Type | Purpose |
|------|-----------|------|---------|
| `NotificationPoller.js` | `maulabs_/scripts/NotificationPoller.js` | JavaScript | Polls for new notifications, shows global banners on all D365 pages |
| `new_NotificationCenter.htm` | `new_NotificationCenter` | HTML | Admin interface for managing notifications, categories, and viewing reports |
| `new_NotificationAlert.htm` | `new_NotificationAlert` | HTML | Agent-facing popup displaying notification content with acknowledge button |

---

## Entities

### maulabs_supervisornotification
Stores all notifications created by supervisors.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_title` | Text | Notification title |
| `maulabs_message` | Text | Notification body |
| `maulabs_priority` | OptionSet | 0 = Normal, 1 = Important, 2 = Urgent |
| `maulabs_status` | OptionSet | 0 = Draft, 1 = Scheduled, 2 = Sent |
| `maulabs_imageurl` | Text | Image URL or web resource path |
| `maulabs_linkurl` | Text | Optional action link URL |
| `maulabs_linktext` | Text | Link button label |
| `maulabs_senton` | DateTime | When the notification was sent |
| `maulabs_scheduledon` | DateTime | Scheduled delivery time |
| `maulabs_targetqueue` | Text | Comma-separated queue GUIDs (empty = all agents) |
| `maulabs_categoryid` | Lookup | Reference to notification category |

### maulabs_notificationack
Tracks agent acknowledgments.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_notificationid` | Lookup | Reference to the notification |
| `maulabs_acknowledgedon` | DateTime | When the agent acknowledged |

### maulabs_notificationcategory
Defines notification categories for organization.

| Field | Type | Description |
|-------|------|-------------|
| `maulabs_name` | Text | Category name |
| `maulabs_emoji` | Text | Display emoji |
| `maulabs_color` | Text | Hex color code |
| `maulabs_description` | Text | Optional description |

---

## Installation

### Prerequisites
- Dynamics 365 environment with Dataverse
- System Administrator or System Customizer security role
- Node.js (for deployment scripts only)

### Steps

1. **Create the entities** listed above in your D365 environment with the `maulabs` publisher prefix.

2. **Upload the web resources** to your D365 environment:
   - `NotificationPoller.js` → JavaScript web resource
   - `new_NotificationCenter.htm` → HTML web resource
   - `new_NotificationAlert.htm` → HTML web resource

3. **Register the poller** on form `OnLoad` events for any entity forms where agents work (e.g., Contact, Account, Case).

4. **Open the Notification Center** by navigating to the `new_NotificationCenter` web resource URL in your environment.

---

## Configuration

The solution uses the D365 OData v9.2 API with dynamic base URLs — no configuration files are needed. All environment-specific values (org URL, user context) are resolved at runtime via `Xrm.Utility.getGlobalContext().getClientUrl()`.

### Poller Settings (in NotificationPoller.js)
| Setting | Default | Description |
|---------|---------|-------------|
| `POLL_INTERVAL_MS` | `15000` | How often to check for new notifications (ms) |

---

## Usage Guide

### Notifications

1. Click **+ New Notification** to open the compose modal
2. Fill in the required fields: **Title** and **Message**
3. Optionally set:
   - **Category** and **Priority**
   - **Target Queue** (leave empty to send to everyone)
   - **Image** (paste a URL or upload a file)
   - **Link** with custom button text
4. Choose an action:
   - **Save Draft** — Save without sending
   - **Schedule** — Set a future date/time with timezone
   - **Preview** — See how agents will see it
   - **Send Now** — Deliver immediately

### Categories

1. Go to the **Categories** tab
2. Click **+ New Category** to create one
3. Set a name, emoji icon, color, and optional description
4. Categories appear as colored badges on notifications

### Reports

1. Go to the **Reports** tab
2. View KPI cards: Sent, Scheduled, Drafts, Acknowledgments, Total
3. Browse the notification list with acknowledgment rates
4. Click any notification to drill down:
   - Acknowledgment timeline chart
   - Acknowledged vs. pending agent lists
   - Search and filter agents

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
