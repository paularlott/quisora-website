---
title: "Skins and themes"
description: "Change the look of the UI with a skin, and choose light or dark."
weight: 10
---

A skin replaces the look of the UI without touching its content. Without one, Quisora has its own liquid glass look.
Skins are chosen in the console, not in the configuration.

## Managing skins

Super admins keep the server's skins on **Skins** (System menu).

{{< screenshot name="look-skin" alt="The Matte skin open in the Skins page: display name, name and the stylesheet" class="max-w-2xl" >}}

- **Built-in skins** can be viewed and copied. The one that ships is **Matte**: opaque surfaces with hairline borders,
  one royal-blue accent, square-ish corners and a solid header.
- **Custom skins** are stylesheets you add, change and remove in the console. Every node uses a change as soon as it has
  replicated there.

To make a custom skin, start from a copy: use **Start from** when adding one, or **Copy to a new skin** on a built-in
one. **Default** can be copied too, which gives you all of Quisora's own design tokens to change.

| Field | Rules |
| --- | --- |
| **Name** | Lowercase letters, digits and dashes, at most 40, such as `acme-dark`. Not a built-in skin's or `default`. It can't be changed later. |
| **Display name** | What administrators see when picking a skin. |
| **Stylesheet** | At most 256 KB. A stylesheet that only styles another skin's name is refused. |

Removing a skin leaves the organizations that chose it on the primary organization's skin until they choose another.

## Choosing a skin

Each organization chooses its skin on its branding (see [Organization branding](/docs/branding/organization-branding/)):
a skin, **Default** (Quisora's own look), or **Same as the primary organization**, which is the default. The primary
organization's choice is the look of every organization that has not chosen its own, so only a super admin can
change it.

The **Preview** buttons on the Skins page and on the branding card show the organization's sign-in page in the skin,
saved or not.

## Light, dark or system

Every page has a light and a dark theme. `ui.default_theme` picks which one a browser gets until its user chooses:

```toml
[ui]
default_theme = "system"           # the default: follow the device's light or dark mode
# default_theme = "dark"           # or always "light" or "dark"
```

You can also set it with `--default-theme` or `QUISORA_DEFAULT_THEME`.

The switch in the header is the user's own choice, kept in that browser. It wins over the default. **Match system
theme** in the user menu forgets it again. The default is the server's: organizations don't set one.
