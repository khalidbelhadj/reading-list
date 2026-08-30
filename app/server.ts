// Custom server entry: identical to Start's default, plus the MOCK_USER_ID
// environment guard, which must trip at startup — before any request is
// served (it used to ride along with middleware.ts).
import "@/lib/env";

import defaultEntry from "@tanstack/react-start/server-entry";

export default defaultEntry;
