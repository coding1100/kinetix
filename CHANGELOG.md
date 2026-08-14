Change Log
==========

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

[Unreleased] - 2026-08-06
---------------------------

### Added

* Desktop (OS-level) notifications for chat DMs, channel messages, mentions, task activity, comments, shares, and invites, with a permission toggle in Settings.
* Task notifications now also fire on status change, assignee added/removed, due/start date change, priority change, and time estimate change - sent to the task's assignees and followers.
* All task comments and replies now notify assignees and followers, not just @mentioned users.
* Inbox split into Primary (unread) and Cleared (read) tabs.
* Lists, My Tasks, and All Tasks rows (Home and Space pages) now show the task's real status icon instead of a plain colored dot.

### Changed

* Sidebar nav rows (Home, Chat, Spaces) default to a lighter gray (#B4B4B4) and turn white when the row is the current route or has unread activity.

### Fixed

* Access token expiry no longer surfaces as an "invalid access token" error - the app now silently refreshes and retries; an expired refresh token forces logout instead.
* Timestamps sent to the frontend (chat, threads, DMs, task comments, notifications, invites, admin, etc.) are now correctly stamped as UTC before serializing, fixing displayed times being off by the viewer's UTC offset.
* Desktop notification clicks now open the relevant chat/channel/space inside the Home page instead of the standalone Chat/Spaces pages.
* Task/Inbox notifications now show the task's actual status icon instead of a static green checkmark implying "done".
* Scrollbars (Home/Chat/Spaces sidebars and every other scrollable panel) are visible again - a Tailwind class mismatch (`data-vertical`/`data-horizontal` instead of `data-[orientation=...]`) against the scroll area's actual `data-orientation` attribute left them at zero width/height everywhere.

[Released] - 2026-08-03
---------------------------

### Added

* Notification sound plays on new channel/DM/group chat messages, with a `soundEnabled` toggle in settings (defaults on).
* URLs in chat messages, thread replies, task comments, and task descriptions now render as clickable links instead of plain text.
* Task description in the task drawer now has a read/edit toggle: read view shows clickable links, clicking it (or pressing Enter) switches to an editable textarea with Save/Cancel.
* Save button added to the checklist "Add item" row, positioned left of the assignee picker; shown only while there's unsaved item text.

### Changed

* Task drawer description Save now also exits edit mode after saving (or when there's nothing to save).

### Fixed

* Notification sound no longer stays silent while the relevant chat is open (unlock-race fix), no longer gets skipped/truncated when messages arrive in quick succession (playback-pool fix), and now plays at the asset's authored volume/length instead of being attenuated and cut short.
