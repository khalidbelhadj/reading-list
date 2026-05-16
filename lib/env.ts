// Hard guard against MOCK_USER_ID leaking into a non-development environment.
// Module side effect: importing this file is enough to trip the check at
// startup, before any request is served.
if (process.env.MOCK_USER_ID && process.env.NODE_ENV !== "development") {
  throw new Error(
    "MOCK_USER_ID is only allowed when NODE_ENV=development. " +
      "Refusing to start to avoid granting the configured user's data to anyone.",
  );
}

export {};
