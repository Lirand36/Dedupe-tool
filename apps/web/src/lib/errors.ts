/** An error whose message is written for the admin and safe to show in the UI. */
export class UserFacingError extends Error {
  override readonly name = "UserFacingError";
}
