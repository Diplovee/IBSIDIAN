# Markdown Basic Syntax

This document tracks Ibsidian support for the Markdown Guide basic syntax reference:
<https://www.markdownguide.org/basic-syntax/>

Ibsidian also supports Obsidian-style extensions such as wikilinks, embeds, and callouts, but those are out of scope for this page unless they affect basic Markdown behavior.

Open the full example file at `docs/markdown-basic-syntax-example.md` to test all basic syntax in one note.

## Support Summary

| Feature | Status | Notes |
| --- | --- | --- |
| Headings | supported | ATX (`#`) and setext (`===`, `---`) headings render in reading view and live preview. |
| Paragraphs | supported | Blank-line paragraph separation is preserved. |
| Line breaks | supported | Trailing-space hard breaks and `<br>` both render. |
| Emphasis | supported | Bold, italic, and bold+italic combinations render. |
| Blockquotes | supported | Standard, nested, and multi-paragraph blockquotes render. |
| Lists | supported | Ordered, unordered, nested lists, and list continuation are supported. |
| Code | supported | Inline code, escaped backticks, and indented code blocks render. |
| Horizontal rules | supported | `***`, `---`, and `___` render as rules. |
| Links | supported | Inline links, titled links, autolinks, email autolinks, and reference-style links render. |
| Images | supported | Standard images and linked images render. Obsidian embeds continue to work separately. |
| Escaping characters | supported | Backslash escapes display literal Markdown characters. |
| HTML | supported | Raw HTML inside Markdown is rendered in reading view. |

## Headings

Status: `supported`

Use number signs for ATX headings:

```md
# Heading level 1
## Heading level 2
### Heading level 3
```

Ibsidian also supports setext headings:

```md
Heading level 1
===============

Heading level 2
---------------
```

Compatibility notes:
- Put a space after `#`.
- Prefer blank lines around headings.

## Paragraphs

Status: `supported`

Separate paragraphs with a blank line:

```md
I really like using Markdown.

I think I'll use it for all of my notes.
```

Compatibility notes:
- Do not indent normal paragraphs with spaces or tabs.

## Line Breaks

Status: `supported`

To force a hard line break, end a line with two trailing spaces or use `<br>`:

```md
First line with two trailing spaces.  
Second line.

First line with HTML.<br>
Second line.
```

## Emphasis

Status: `supported`

```md
**bold**
*italic*
***bold and italic***
```

Compatibility notes:
- Prefer asterisks when emphasizing text inside words.

## Blockquotes

Status: `supported`

```md
> Single paragraph quote

> Multi-paragraph quote
>
> Second paragraph

> Nested quote
>> Child quote
```

Ibsidian also detects Obsidian callouts such as `> [!note]`, but standard blockquote syntax remains fully supported.

## Lists

Status: `supported`

Ordered lists:

```md
1. First item
2. Second item
3. Third item
```

Unordered lists:

```md
- First item
- Second item
- Third item
```

Nested lists:

```md
1. First item
2. Second item
   - Nested item
   - Nested item
```

Additional supported cases:
- `-`, `*`, and `+` unordered markers all parse correctly.
- `1.` list continuation works in the editor when you press Enter.
- Blockquote and list continuation are preserved while typing in live preview.

Compatibility notes:
- Prefer `1.` instead of `1)` for ordered lists.
- Do not mix unordered delimiters in the same list if portability matters.
- Escape `1968\.` when an unordered list item should start with a literal numbered token.

## Code

Status: `supported`

Inline code:

```md
At the command prompt, type `nano`.
```

Escaping backticks:

```md
``Use `code` in your Markdown file.``
```

Indented code blocks:

```md
    <html>
      <head>
      </head>
    </html>
```

Ibsidian also supports fenced code blocks through the underlying Markdown stack, even though fenced blocks are documented on the Markdown Guide extended syntax page rather than the basic syntax page.

## Horizontal Rules

Status: `supported`

```md
***

---

___
```

Compatibility notes:
- Leave blank lines above and below a rule so `---` is not interpreted as a setext heading underline.

## Links

Status: `supported`

Inline links:

```md
[Duck Duck Go](https://duckduckgo.com)
[Duck Duck Go](https://duckduckgo.com "Search engine")
```

Autolinks:

```md
<https://www.markdownguide.org>
<fake@example.com>
```

Reference-style links:

```md
This is a [reference link][1].

[1]: https://www.markdownguide.org "Markdown Guide"
```

Compatibility notes:
- Encode spaces as `%20` in URLs when portability matters.
- Standard Markdown links and Obsidian wikilinks can coexist in the same note.

## Images

Status: `supported`

```md
![Alt text](/assets/example.png "Optional title")
```

Linked images:

```md
[![Alt text](/assets/example.png)](https://example.com)
```

Ibsidian-specific note:
- `![[Note]]` and `![[Drawing.excalidraw]]` are treated as Obsidian embeds, not standard Markdown images.

## Escaping Characters

Status: `supported`

Use a backslash before Markdown punctuation to show it literally:

```md
\* Without the backslash, this would be a bullet.
\# This will not become a heading.
\[literal brackets\]
```

Common escapes:
- `\\`
- ``\` ``
- `\*`
- `\_`
- `\{` and `\}`
- `\[`, `\]`
- `\(`, `\)`
- `\#`
- `\+`
- `\-`
- `\.`
- `\!`
- `\|`

## HTML

Status: `supported`

Raw HTML inside Markdown is rendered in reading view:

```md
This **word** is bold. This <em>word</em> is italic.

<div>Custom HTML block</div>
```

Compatibility notes:
- Use blank lines around block HTML for predictable rendering.
- Raw HTML is a Markdown feature here, but Markdown syntax inside block HTML should not be relied on.
