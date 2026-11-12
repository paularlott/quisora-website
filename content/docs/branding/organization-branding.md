---
title: "Organization branding"
description: "Give an organization its own logos, colour and footer."
weight: 20
---

An organization can have its own logo (and a dark-theme one), a primary colour, a skin and a footer. They show on its
sign-in pages and in the console of its users. Without a logo, the server's logo and site name are shown. The skin
still decides everything else, so the logo and colour sit inside the skin's look.

Administrators of the organization and super admins set it, from the organization's page in the console (the
**Branding** card). A service account can't.

{{< screenshot name="look-branding" alt="The Branding card of an organization: light and dark logos, primary colour, skin and footer" >}}

| Setting | What it does |
| --- | --- |
| **Logo (light theme)** | PNG, JPEG, WebP or SVG, up to 256 KB. Replaces the server's logo, and the organization's display name replaces the site name. |
| **Logo (dark theme)** | Optional. Without it the light logo is shown. It needs a light logo, and removing the light one removes it too. |
| **Primary colour** | Written as `#rrggbb`. Used for buttons, links and focus rings. **Use the server's colour** removes it. |
| **Skin** | A skin, **Default**, or **Same as the primary organization**. **Preview** shows it first. |
| **Footer** | Text at the bottom of every page. Links (`<a href="...">`) and `<strong>`, `<em>`, `<small>`, `<span>` and `<br>` work. Empty uses the primary organization's footer, then the server's. |

Choose **Save branding** to keep your changes.

The colour must be dark enough for white text on it, with a contrast of at least 4.5 to 1, because buttons are filled
with it. The form tells you if it is too light.

Logos are stored in Quisora and served from it, so nothing is fetched from outside and branding works on a network
without internet access. For email, use a PNG logo: many mail clients show no SVG images.

The management API can set the same fields (`PATCH /api/orgs/{org}/branding`), and every server shows its API reference
at `/api-docs/`.
