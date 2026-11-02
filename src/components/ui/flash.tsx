import { Notice } from "@/components/ui/feedback";

export function Flash({
  ok,
  error,
}: {
  ok?: string | string[];
  error?: string | string[];
}) {
  const okText = Array.isArray(ok) ? ok[0] : ok;
  const errorText = Array.isArray(error) ? error[0] : error;

  if (!okText && !errorText) return null;

  return (
    <div className="mb-4 space-y-2">
      {errorText ? <Notice tone="danger">{errorText}</Notice> : null}
      {okText ? <Notice tone="success">{okText}</Notice> : null}
    </div>
  );
}

export function flashParams(searchParams: {
  ok?: string | string[];
  error?: string | string[];
}) {
  return { ok: searchParams.ok, error: searchParams.error };
}
