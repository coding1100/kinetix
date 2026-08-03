Change Log
==========

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

[Unreleased] - 2026-08-03
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
