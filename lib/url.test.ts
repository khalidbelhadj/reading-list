import { describe, expect, test } from "bun:test";

import { urlMatchKey } from "./url";

// urlMatchKey decides whether an open browser tab is "the same page" as a
// reading-list item. Over-normalizing collapses distinct pages into one row;
// under-normalizing means the tab you're staring at never matches.
describe("urlMatchKey", () => {
  test("collapses protocol, www., trailing slash and hash", () => {
    const key = urlMatchKey("https://example.com/post");
    expect(urlMatchKey("http://www.example.com/post/")).toBe(key);
    expect(urlMatchKey("https://example.com/post#section")).toBe(key);
    expect(urlMatchKey("https://EXAMPLE.com/post")).toBe(key);
  });

  test("drops tracking params but keeps meaningful ones", () => {
    expect(urlMatchKey("https://example.com/a?utm_source=news&gclid=x")).toBe(
      urlMatchKey("https://example.com/a"),
    );
    expect(urlMatchKey("https://example.com/a?page=2")).not.toBe(
      urlMatchKey("https://example.com/a"),
    );
  });

  test("ignores query ordering", () => {
    expect(urlMatchKey("https://example.com/a?b=2&a=1")).toBe(
      urlMatchKey("https://example.com/a?a=1&b=2"),
    );
  });

  test("distinct paths and pages stay distinct", () => {
    expect(urlMatchKey("https://example.com/a")).not.toBe(
      urlMatchKey("https://example.com/b"),
    );
    expect(urlMatchKey("https://example.com/a")).not.toBe(
      urlMatchKey("https://other.com/a"),
    );
  });

  test("YouTube URL shapes collapse to the video id", () => {
    const key = urlMatchKey("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(urlMatchKey("https://youtu.be/dQw4w9WgXcQ")).toBe(key);
    expect(urlMatchKey("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(key);
    expect(
      urlMatchKey("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123"),
    ).toBe(key);
    // Different video, different key — `?v=` must survive param stripping.
    expect(urlMatchKey("https://www.youtube.com/watch?v=oHg5SJYRHA0")).not.toBe(
      key,
    );
  });

  test("non-http URLs never match an item", () => {
    expect(urlMatchKey("chrome://newtab")).toBeNull();
    expect(urlMatchKey("about:blank")).toBeNull();
    expect(urlMatchKey("file:///Users/me/notes.pdf")).toBeNull();
    expect(urlMatchKey("   ")).toBeNull();
    expect(urlMatchKey("not a url")).toBeNull();
  });
});
