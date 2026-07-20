/**
 * Limited member and guest now have real backend enforcement (Space-level
 * ACL via SpaceMember + is_private, see backend-py/app/services/space_permissions.py)
 * instead of behaving identically to a full member, so it's safe to offer
 * them in the invite dropdown.
 */
export const SHOW_EXTENDED_INVITE_ROLES = true;
