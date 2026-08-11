// App name, userData location and custom-protocol registration. Both calls
// must run before requestSingleInstanceLock() — see configureAppIdentity.
import path from "node:path";

import { app } from "electron";

import { devPort, isDev, PROTOCOL } from "./env";

/**
 * Use a distinct identity in dev so the dev Electron and the packaged app
 * don't share a userData dir (which would also share the single-instance
 * lock — launching the packaged app while dev is running would otherwise
 * trigger requestSingleInstanceLock() === false and silently quit).
 *
 * The name is further suffixed with the dev port, so two dev instances on
 * different ports get distinct userData dirs and therefore distinct
 * single-instance locks. Without this, the second `electron .` would fail
 * requestSingleInstanceLock() and merely refocus the first window instead of
 * opening its own. As a bonus, each instance gets isolated cookies/localStorage.
 *
 * MUST run before the single-instance lock is requested: the lock file lives
 * inside userData, so requesting it first takes the *wrong* app's lock.
 */
export const configureAppIdentity = () => {
  if (!isDev) {
    app.setName("Reading List");
    return;
  }
  const devName = `Reading List Dev ${devPort}`;
  app.setName(devName);
  app.setPath("userData", path.join(app.getPath("appData"), devName));
};

/**
 * Custom protocol registration. macOS dispatches via open-url; Windows/Linux
 * pass the URL as a process argument and we forward via the single-instance
 * lock — so this has to be registered before the lock too.
 */
export const registerProtocolClient = () => {
  const appEntryArg = process.argv[1];
  if (process.defaultApp && appEntryArg !== undefined) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(appEntryArg),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(PROTOCOL);
};
