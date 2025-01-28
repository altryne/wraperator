# Wraperator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Wraperator** is an all-in-one Electron-based wrapper around OpenAI's Operator tool, enriched with native desktop notifications and a Raycast extension for quick access and scheduling tasks. It also features a convenient menu bar icon on macOS showing active/unread conversations.

![Wraperator Screenshot](assets/icon_active@2x.png)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Raycast Extension](#raycast-extension)
- [Menu Bar Integration](#menu-bar-integration)
- [Notifications](#notifications)
- [Important Note on Google Login](#important-note-on-google-login)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Wraperator** provides an Electron-based desktop experience for Operator (https://operator.chatgpt.com), letting you focus on your conversations and tasks without constantly switching back to a web browser. With native notifications, real-time updates in the menu bar, and a handy Raycast extension, you can quickly schedule new tasks or see your runs — all while staying informed on your Operator activities.

---

## Features

1. **Native Desktop Wrapper**
   - Wraps the https://operator.chatgpt.com experience in an Electron shell for faster workflows and convenient app-like usage.

2. **Native Notifications**
   - Receive immediate desktop notifications for new messages or updates.
   - Reply to notifications directly from the desktop without needing to switch tabs or windows.

3. **Menu Bar Integration**
   - Quickly view your active tasks and unread messages in your menu bar (macOS).
   - Red or distinct icons appear when you have unread conversations, keeping you updated at a glance.

4. **Raycast Extension**
   - Schedule tasks with Operator and list your runs right from Raycast.
   - Instantly open tasks/conversations without navigating the website manually.
   - Perfect for command-line power users.

5. **Real-Time Updates**
   - Keep track of new Operator messages and statuses, ensuring you never miss an important update.

6. **Local Express API**
   - Exposes data for the Raycast extension to consume via a local server (`http://127.0.0.1:3001`).

---

## Installation

### Using npm
1. **Clone this repository**:

   ```bash
   git clone https://github.com/yourusername/wraperator.git
   ```

2. **Install dependencies**:

   ```bash
   cd wraperator
   npm install
   ```

3. **Run the app**:

   ```bash
   npm start
   ```

4. **(Optional) Build**:

   ```bash
   npm run build
   ```

This will create a distributable app for your platform (macOS, etc.).

---

## Usage

Once the app is running, it will load https://operator.chatgpt.com in an Electron window. You can:

- Focus on tasks in a dedicated window.
- View the tray icon for quick info on active and unread tasks.
- Automatically receive desktop notifications whenever there's a new update or message.

---

## Raycast Extension

Inside the `raycast-extension` folder, you'll find a separate project that integrates with Wraperator:

1. **Install** the Raycast extension dependencies:

   ```bash
   cd raycast-extension
   npm install
   ```

2. **Build** or **Develop** the extension:

   ```bash
   npm run build
   # or
   npm run dev
   ```

3. **Load** the extension in Raycast (follow Raycast docs on how to load custom extensions).
4. Use:
   - **Schedule Operator Task** to create new tasks in Operator from Raycast.
   - **List Operator Runs** to see recent or active tasks, then jump directly into the conversation in Wraperator.

---

## Menu Bar Integration

A tray icon (on macOS) or system tray icon (on other platforms) is set up via `Tray` in `main.js`. It shows:

- **Unread Count**
  If there's any unread conversation, the icon changes to indicate unread messages.
- **Active Conversations**
  Quick shortcuts to jump into individual tasks.

Right-clicking or clicking this icon shows a menu listing your Operator conversations (up to 10 most recent).

---

## Notifications

Wraperator sets up native OS notifications by intercepting messages in `preload.js` and `main.js`:

- **When new messages arrive**:
  - A desktop notification is displayed, including the message body.
  - You can directly reply to certain notifications, sending your reply back to Operator.
- **Focus Detection**:
  The wrapper checks if you're currently focused on the conversation. If yes, it suppresses notifications to avoid duplicates.

---

## Important Note on Google Login

At this time, **logging into OpenAI via Google inside the Electron wrapper** is not supported, as the in-app browser flow often blocks or misdirects the Google OAuth popup. **If you created your OpenAI account via Google**, consider the following workaround:

1. **Log in to a service that uses the same Google SSO** first (e.g., Anthropic, a different site), where you can open a Google login in a separate external window.
2. Once your browser session is validated with Google, returning to Operator inside the Electron wrapper may bypass the OAuth popup issue.
3. Alternatively, use a standard email/password with Operator if possible.

This is a known limitation and may be resolved in future updates if/when the underlying login flows are updated.

---

## Contributing

We welcome contributions! Feel free to open issues or pull requests:

1. Fork this repo
2. Create a new feature or fix branch
3. Submit a pull request

---

## License

This project is available under the [MIT License](LICENSE). See the LICENSE file for details.

---

## Author
Made with ❤️ by [@altryne](https://x.com/altryne).  
- GitHub: [github.com/altryne](https://github.com/altryne)  
- X (formerly Twitter): [x.com/altryne](https://x.com/altryne)

---

**Enjoy using Wraperator** for a more streamlined Operator experience, complete with native notifications and Raycast support!