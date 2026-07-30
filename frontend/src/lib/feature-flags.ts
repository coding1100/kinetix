// Simple hard-coded feature flags. Flip to enable/disable a feature for everyone.
export const FEATURE_FLAGS = {
  subtasks: false,
  topBarNotifications: false,
  // Teams page is switched off for now rather than deleted, in case that
  // changes again - keep all its code, just hide the entry points.
  teams: false,
  // Platform staff now provision workspace access from the admin portal -
  // self-serve signup, Google auth, and the demo-credentials hint are
  // switched off for the main app rather than deleted, in case that
  // changes again.
  selfSignup: false,
  googleAuth: false,
  demoCredentialsBanner: false,
  // Channel "followers" (ChatChannelMember.isFollowing) has no behaviour wired
  // to it - message notifications key off notificationLevel instead, and
  // nothing filters on it. Hide every follow surface until it means something;
  // the data and endpoints stay untouched.
  channelFollowers: false,
} as const;
