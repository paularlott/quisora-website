# Quisora website

Source for the Quisora website: a landing page and short getting-started docs for [Quisora](https://github.com/paularlott/quisora), the open source identity provider. It is built with [Hugo](https://gohugo.io/) (extended, 0.150.0 or later) and Tailwind CSS. Pages live in `content/`, layouts and shortcodes in `layouts/`.

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

## Screenshots

The screenshots in `static/images/shots/` come from Quisora's UI demo server (`go run ./tools/uidemo` in the Quisora repository), which runs on demo data held in memory. Each has a `-light.webp` and a `-dark.webp` version; the `screenshot` shortcode shows the one that matches the site's theme:

```
{{< screenshot name="login" alt="The sign-in page" >}}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Contributions require accepting the [Contributor License Agreement](CONTRIBUTOR_LICENSE_AGREEMENT.md).
