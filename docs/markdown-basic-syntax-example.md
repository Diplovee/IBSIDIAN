# Markdown Basic Syntax Example

This file demonstrates the Markdown Guide basic syntax in one place.

Heading Level 2 via Setext
--------------------------

## Paragraphs

This is the first paragraph.

This is the second paragraph.

## Line Breaks

This line ends with two spaces.  
This line appears immediately below it.

This line uses HTML.<br>
This line also appears immediately below it.

## Emphasis

This text is **bold**.

This text is *italic*.

This text is ***bold and italic***.

## Blockquotes

> This is a blockquote.
>
> This is a second paragraph inside the same blockquote.
>
>> This is a nested blockquote.

## Lists

### Ordered List

1. First item
2. Second item
3. Third item

### Unordered List

- First bullet
- Second bullet
- Third bullet

### Nested List

1. Parent item
2. Another parent item
   - Nested bullet
   - Another nested bullet

### Escaped Number in a Bullet

- 1968\. A great year!
- 1969 was also good.

## Code

Use `nano` to edit a file from the terminal.

To show backticks literally, write ``Use `code` here.``.

Indented code block:

    <html>
      <head>
        <title>Example</title>
      </head>
    </html>

## Horizontal Rules

***

---

___

## Links

Inline link: [Markdown Guide](https://www.markdownguide.org)

Inline link with title: [Duck Duck Go](https://duckduckgo.com "Search engine")

Autolink URL: <https://www.markdownguide.org/basic-syntax/>

Autolink email: <fake@example.com>

Reference link: [basic syntax guide][guide]

[guide]: https://www.markdownguide.org/basic-syntax/ "Markdown Guide Basic Syntax"

## Images

Standard image:

![Example image](https://via.placeholder.com/320x120 "Placeholder image")

Linked image:

[![Clickable image](https://via.placeholder.com/240x100 "Linked placeholder")](https://www.markdownguide.org)

## Escaping Characters

\* This is not a list item.

\# This is not a heading.

\[These brackets are literal\]

## HTML

This **word** is bold. This <em>word</em> is italic.

<div>Simple HTML block inside Markdown.</div>
