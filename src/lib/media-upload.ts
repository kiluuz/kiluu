/**
 * Image and GIF attachments are switched off in community posts and club chat
 * while media delivery is reworked, so no new files land in storage and no new
 * messages point at objects the player cannot serve yet. Existing attachments
 * keep rendering; only sending is gated.
 */
export const MEDIA_ATTACHMENTS_ENABLED: boolean = false;
