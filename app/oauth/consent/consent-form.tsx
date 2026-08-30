import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

import { Button } from "@/components/system/button";

import { submitOAuthDecision } from "./actions";

const scopeDescriptions: Record<string, string> = {
  openid: "verify your identity",
  profile: "view your name and avatar",
  email: "view your email address",
  phone: "view your phone number",
};

export const ConsentForm = ({
  authorizationId,
  clientName,
  redirectUri,
  scopes,
}: {
  authorizationId: string;
  clientName: string;
  redirectUri: string;
  scopes?: string[];
}) => {
  const decisionMutation = useMutation({
    mutationFn: (decision: "approve" | "deny") =>
      submitOAuthDecision({ decision, authorizationId }),
    onSuccess: ({ redirectUrl }) => {
      // The redirect target is the MCP client's callback — a full page
      // navigation out of the app.
      window.location.assign(redirectUrl);
    },
  });

  const handleDeny = useCallback(
    () => decisionMutation.mutate("deny"),
    [decisionMutation],
  );
  const handleApprove = useCallback(
    () => decisionMutation.mutate("approve"),
    [decisionMutation],
  );

  const busy = decisionMutation.isPending || decisionMutation.isSuccess;

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-lg font-medium">Authorize {clientName}</h1>
      <p className="text-sm text-muted-foreground">
        This application wants to access your reading list.
      </p>

      <div className="flex flex-col gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Redirect: </span>
          {redirectUri}
        </p>
        {scopes && scopes.length > 0 && (
          <div>
            <span className="text-muted-foreground">Permissions: </span>
            <ul className="ml-4 list-disc">
              {scopes.map((scope) => (
                <li key={scope}>
                  {scope}
                  {scopeDescriptions[scope] && (
                    <span className="text-muted-foreground">
                      , {scopeDescriptions[scope]}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={handleDeny}
        >
          Deny
        </Button>
        <Button
          variant="primary"
          className="flex-1"
          disabled={busy}
          onClick={handleApprove}
        >
          Approve
        </Button>
      </div>
    </div>
  );
};
