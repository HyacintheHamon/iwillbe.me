# Authentication email branding

The hosted confirmation email still used the default subject and body, with no reference to iwillbe.me. Round 2 (developer pack PDF page 14) requires the existing sender to stay unchanged and the four user-facing authentication templates to identify the app.

The templates and `supabase/config.toml` now cover confirmation, magic link, email change and password recovery. Every subject and body names iwillbe.me; every template uses the text-based be.me logo, the Round 2 palette and an orange action button. The existing `{{ .ConfirmationURL }}` is preserved for each authentication flow.

## Hosted activation

These files do not update Supabase's hosted Auth configuration when Vercel builds the app. In project `mvhqovdznrzoduntyryh`, open Authentication > Email Templates and apply the matching subject and HTML to each of the four templates. Keep the sender, SMTP settings, URL configuration, token handling and notification settings unchanged.

| Template | Subject | HTML |
| --- | --- | --- |
| Confirm signup | Confirm your email for iwillbe.me | `supabase/templates/confirmation.html` |
| Magic link | Your iwillbe.me sign-in link | `supabase/templates/magic_link.html` |
| Change email | Confirm your email change for iwillbe.me | `supabase/templates/email_change.html` |
| Reset password | Reset your iwillbe.me password | `supabase/templates/recovery.html` |

Hosted activation is pending dashboard access. The dashboard required sign-in and the secure sign-in attempt did not establish a session. No email was sent, no sender settings were changed, and live delivery has not been verified.
