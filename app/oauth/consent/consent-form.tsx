"use client";

import { Button } from "@/components/ui/button";

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
                <li key={scope}>{scope}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form action="/api/oauth/decision" method="POST" className="flex gap-2">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <Button
          type="submit"
          name="decision"
          value="deny"
          variant="outline"
          className="flex-1"
        >
          Deny
        </Button>
        <Button type="submit" name="decision" value="approve" className="flex-1">
          Approve
        </Button>
      </form>
    </div>
  );
};
