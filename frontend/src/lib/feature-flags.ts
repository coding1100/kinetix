// Simple hard-coded feature flags. Flip to enable/disable a feature for everyone.
export const FEATURE_FLAGS = {
  subtasks: false,
  topBarNotifications: false,
  // Platform staff now provision workspace access from the admin portal -
  // self-serve signup, Google auth, and the demo-credentials hint are
  // switched off for the main app rather than deleted, in case that
  // changes again.
  selfSignup: false,
  googleAuth: false,
  demoCredentialsBanner: false,
} as const;
