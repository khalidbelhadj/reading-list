import { createServerFn } from "@tanstack/react-start";

// Approve or deny an MCP client's OAuth authorization request. Returns the
// URL to send the browser to (the client's callback); the form navigates
// there with window.location since it leaves the app entirely.
const submitOAuthDecisionFn = createServerFn({ method: "POST" })
  .validator(
    (input: { decision: "approve" | "deny"; authorizationId: string }) => input,
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    if (data.decision === "approve") {
      const { data: result, error } =
        await supabase.auth.oauth.approveAuthorization(data.authorizationId);
      if (error) throw new Error(error.message);
      return { redirectUrl: result.redirect_url };
    }

    const { data: result, error } = await supabase.auth.oauth.denyAuthorization(
      data.authorizationId,
    );
    if (error) throw new Error(error.message);
    return { redirectUrl: result.redirect_url };
  });

export const submitOAuthDecision = (input: {
  decision: "approve" | "deny";
  authorizationId: string;
}) => submitOAuthDecisionFn({ data: input });
