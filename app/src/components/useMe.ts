"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * The one owner of the first-login provisioning protocol (codebase-design
 * review, finding 11): `me` returning null means "row not yet provisioned"
 * and this hook calls `ensureMe` exactly once. Every consumer of identity
 * uses this hook — no component-level ref-guard coordination.
 */
export function useMe() {
  const me = useQuery(api.users.me);
  const ensure = useMutation(api.users.ensureMe);
  const ensureStarted = useRef(false);

  useEffect(() => {
    if (me === null && !ensureStarted.current) {
      ensureStarted.current = true;
      void ensure();
    }
  }, [me, ensure]);

  return { me, provisioning: me === undefined || me === null };
}
