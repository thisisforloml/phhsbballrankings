import { AdminAlert } from "@/components/admin/AdminAlert";

export type AdminFormFeedbackState = {
  ok: boolean;
  message: string;
};

export function AdminFormFeedback({ state }: { state: AdminFormFeedbackState }) {
  if (!state.message) return null;

  return (
    <AdminAlert variant={state.ok ? "success" : "error"} size="sm">
      {state.message}
    </AdminAlert>
  );
}
