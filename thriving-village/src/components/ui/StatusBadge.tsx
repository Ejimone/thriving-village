import { Badge } from "@/components/ui/Badge";

/**
 * Status pill for applications and contest entries.
 * Positive/active states read inverse (black); pending neutral; closed outline.
 */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, "neutral" | "inverse" | "outline"> = {
    Interview: "inverse",
    Shortlisted: "inverse",
    Won: "inverse",
    "In review": "neutral",
    Submitted: "neutral",
    Applied: "outline",
    Closed: "outline",
    "Not selected": "outline",
  };
  return (
    <Badge tone={map[status] ?? "neutral"} size="sm">
      {status}
    </Badge>
  );
}
