---
title: "Email templates"
description: "Rewrite the emails Quisora sends: invitations, resets, verification and codes."
weight: 30
---

Quisora sends these emails: an **invitation**, a **password reset**, an **address verification**, a notice that a
**recovery code was used**, a **sign-in code**, and three for [access requests](/docs/applications/access-requests/):
**access request** (to the approvers), **access request decided** and **access ended** (to the person who asked). Each is built from a **layout**, which holds the header and footer
shared by every email, and the email's own **subject**, **HTML body** and **plain-text body**. Every email goes out
with both an HTML and a plain-text part.

Email is sent only when the server is set up for it (see [Email](/docs/running/settings/#email)). You can edit and preview
templates without it, but test emails need it.

## Editing

An administrator opens **Emails** in the organization's menu. There is a tab for the layout and one for each email.

{{< screenshot name="look-emails" alt="The Emails page with tabs for the layout and each email, and the layout's HTML" >}}

On the tab shown:

- **Preview** shows the email as the templates are now, saved or not, for a made-up recipient (Alex Example). Its
  links do nothing.
- **Send test** asks for an address and sends the email there, with `[Test]` before the subject.
- **Save** keeps the tab. Saving needs a recent re-authentication (**Confirm it is you**), and a personal API token
  cannot do it, since templates carry every link and code the organization sends.
- **Use the default** puts the inherited parts in the editors. Save the tab to keep them.

A tab with unsaved edits is marked, and its edits stay while you save other tabs.

## What is inherited

A part an organization leaves unset is inherited, one part at a time:

1. the organization's own,
2. else the **primary organization's**,
3. else the built-in ones.

So the primary organization can give every organization one branded layout, and one organization can change only its
invitation's wording. Only a super admin changes the primary organization's templates. Its administrators can read and
preview them.

## Writing templates

Templates use Go template syntax. The HTML parts escape every field for where it stands. The layout places the
email's body with `{{template "body" .}}`, in both the HTML and plain-text layouts.

```html
<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
  {{if .LogoURL}}<img src="{{.LogoURL}}" alt="{{.Site}}" height="40">{{end}}
  <p>Hello {{.Name}},</p>
  {{template "body" .}}
  <p style="font-size:12px;color:#666">{{.Org}}</p>
</div></body></html>
```

Fields are written with capitals, such as `{{.Name}}`.

| Field | What it holds |
| --- | --- |
| `.Site` | Who the email is from: the organization's display name, else the server's site name. |
| `.Org` | The organization's display name. |
| `.Name` | The recipient's full name. |
| `.Link` | The invitation, reset or verification link, or the account page (recovery code used). Not in the sign-in code email. |
| `.Expires` | How long the link or code works, such as `1 hour`. |
| `.Code` | The sign-in code (sign-in code email only). |
| `.Left` | Recovery codes left (recovery code email only). |
| `.LogoURL` | The organization's logo, else the server's. Use a PNG for email. |
| `.PrimaryColor` | The organization's primary colour, else `#3730a3`. |

A template is checked when you save it, and refused with the part at fault unless:

- it parses and every email renders with it;
- it uses no loops or `{{define}}` and sets no variables, and calls only the tests `and`, `or`, `not`, `eq`, `ne`,
  `lt`, `le`, `gt` and `ge`, such as `{{if not .Name}}`;
- the invitation, reset and verification bodies show `{{.Link}}`, and the sign-in code body shows `{{.Code}}`, in HTML
  and plain text;
- in the HTML, the link appears only as the address of a link (`<a href="{{.Link}}">`) or as text, and the code only as
  text, never in an image address, a style or another attribute;
- no subject shows the link or the code, since subjects show on lock screens;
- each part is at most 64 KB, and all of an organization's at most 512 KB.

If a stored template ever fails to render, the email goes out from the built-in templates instead, so a password reset
or sign-in code is never held back.

## Limits

To stop the invitation and verification endpoints being used to relay mail, each organization's administration can
have the server email at most 300 invitations and verification links an hour. Past that, the request is refused and an
invitation link can still be issued without email and shared. Each administrator may also send at most 5 test emails a
minute and 30 an hour.

The management API can read, preview and send test emails from drafts.
