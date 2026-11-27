import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { accountKey, type Account } from "@/features/auth";
import { onApiError } from "@/services/api/apiClient";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";

const READ_ONLY = "subscription.read_only";

/**
 * When the server refuses a write because the account is read-only (D-162, D-176), shows one friendly dialog with
 * «اشترك» instead of a bare error, and refreshes the account so the banners follow. Renders nothing.
 */
export function ReadOnlyWatcher() {
  const confirm = useConfirm();
  const navigate = useNavigate();
  const client = useQueryClient();
  const open = useRef(false);

  useEffect(
    () =>
      onApiError((error) => {
        if (error.code !== READ_ONLY || open.current) return;
        open.current = true;
        // Refresh the account first so the banners follow and the dialog fits the status (a suspension is not fixed by paying).
        void client
          .refetchQueries({ queryKey: accountKey })
          .then(() => {
            const suspended = client.getQueryData<Account>(accountKey)?.business?.subscription?.status === "suspended";
            return confirm({
              title: suspended ? "حسابك موقوف" : "حسابك للقراءة فقط",
              message: error.message,
              icon: "lock",
              tone: "warning",
              confirmLabel: suspended ? "التفاصيل" : "اشترك الآن",
              cancelLabel: suspended ? "سكّر" : "لاحقًا",
            });
          })
          .then((yes) => {
            open.current = false;
            if (yes) navigate("/subscription");
          });
      }),
    [client, confirm, navigate],
  );

  return null;
}
