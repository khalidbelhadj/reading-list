// The app-wide zoom factor and the traffic-light geometry that tracks it.
//
// This module owns `zoomFactor` — it is a single factor applied to every window
// (main and any secondary item/review windows) so the whole app scales
// together. Nothing outside this file names the variable; read it through
// getZoomFactor().
import { BrowserWindow } from "electron";

import { APP_CHANNELS } from "./channels";

// Traffic-light geometry. The native macOS window buttons are a fixed physical
// size and don't scale with the renderer's page zoom, so we move them ourselves
// to track the (zoom-scaled) toolbar content. The toolbar scales about the
// top-left origin, so a content point at inset I (at zoom 1) sits at I*zoom when
// zoomed. To keep the dot's *center* on that point — without the dot itself
// growing — the top-left inset is (BASE + RADIUS)*zoom - RADIUS: the radius is
// scaled into the anchor, then subtracted back so it stays a fixed offset.
// At zoom 1 this is exactly BASE (18), matching the tuned default. The CSS
// toolbar clearance in globals.css mirrors this with the same coefficients.
export const BASE_TRAFFIC_LIGHT_INSET = 18;
const TRAFFIC_LIGHT_RADIUS = 6;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
export const ZOOM_RATIO = 1.2;

let zoomFactor = 1;

const clampZoom = (value: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

export const trafficLightInset = (zoom: number) =>
  Math.round(
    (BASE_TRAFFIC_LIGHT_INSET + TRAFFIC_LIGHT_RADIUS) * zoom -
      TRAFFIC_LIGHT_RADIUS,
  );

export const getZoomFactor = () => zoomFactor;

// Applies the factor to the page, repositions the traffic lights to track the
// scaled content, and tells the renderer so its CSS can widen the toolbar's
// left clearance (gap = clearance / zoom).
export const applyZoomToWindow = (win: BrowserWindow) => {
  win.webContents.setZoomFactor(zoomFactor);
  if (process.platform === "darwin") {
    const inset = trafficLightInset(zoomFactor);
    win.setWindowButtonPosition({ x: inset, y: inset });
  }
  win.webContents.send(APP_CHANNELS.zoom, zoomFactor);
};

/** Single source of truth for zoom — every change goes through here. */
export const setZoom = (next: number) => {
  zoomFactor = clampZoom(next);
  BrowserWindow.getAllWindows().forEach(applyZoomToWindow);
};
