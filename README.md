# Quisora website

Source for the Quisora website and its documentation: a landing page, short getting-started guides, and the full reference for [Quisora](https://github.com/paularlott/quisora), the open source identity provider. This site is where the docs live; edit them here. It is built with [Hugo](https://gohugo.io/) (extended, 0.150.0 or later) and Tailwind CSS. Pages live in `content/`, layouts and shortcodes in `layouts/`.

The look follows Quisora's default skin: glass panels over a drifting aurora, in light and dark. Everything is served from the site itself: no web fonts, scripts or trackers from anywhere else.

## Local development

Install the Node dependencies (Tailwind and FlexSearch) once, then run the Hugo dev server:

```sh
npm install
hugo server --buildDrafts --disableFastRender
```

The site is served at <http://localhost:1313/>.

## Building

```sh
task build
```

This runs `hugo` and writes the site to `public/`. Extra Hugo flags can be passed with `HUGO_ARGS`, for example `HUGO_ARGS="--minify" task build`.

## Docs

`content/docs/*.md` are the short guides. Each folder under `content/docs/` is a reference section, shown in the sidebar under **Reference**: running Quisora, replication, signing in, connecting applications, automation, SSH certificates, security and compliance, look and email, and internals.

The reference was imported from the `docs/` folder (and `web/skins/README.md`) of the Quisora repository at commit `a2eb326`. The long guides were split into one page per section, links between docs were turned into site links, and links to code or other files still point at GitHub. Until the copies in the Quisora repository are removed, `git diff a2eb326 -- docs web/skins/README.md` there shows what has changed since.

## Screenshots

The screenshots in `static/images/shots/` come from Quisora's UI demo server (`go run ./tools/uidemo` in the Quisora repository), which runs on demo data held in memory. Each has a `-light.webp` and a `-dark.webp` version; the `screenshot` shortcode shows the one that matches the site's theme:

```
{{< screenshot name="login" alt="The sign-in page" >}}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions require accepting the [Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md).
