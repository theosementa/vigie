# Security policy

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub's private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**.

Include the affected version, steps to reproduce and the impact you see. You will get an answer as soon as possible, and the fix is released before the details are made public.

## Rules for contributors

Apply these to every change; they come from the security reviews of this repo.

- **No account oracle.** An endpoint must never reveal whether an email has an account (or already has a resource): same status, same body shape and same wording for known and unknown addresses. Applies to share, invitations, login, register and password reset. Tests assert the identical response.
- **Scope every query by `user_id`**, and check ownership before acting on an id from the client. Admin routes use `require_admin` (404 for others).
- **Outbound requests** go through `safe_fetch` (public IPs only, pinned, redirects re-validated). Never call `httpx` directly on a user-supplied URL.
- **Bind parameters only** in SQL; no f-string with request data. Escape LIKE input.
- **No `dangerouslySetInnerHTML`** with fetched or user content. Fetched metadata stays text.
- **No secrets in code**; settings come from `.env`. `ALLOWED_EMAILS` stays enforced on every authenticated request.
