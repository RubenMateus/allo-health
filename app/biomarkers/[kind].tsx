import { Redirect, useLocalSearchParams } from "expo-router";

import { BiomarkerDetailScreen } from "@/components/biomarkers/BiomarkerDetailScreen";
import { biomarkerKinds } from "@/services/health/biomarkers";
import type { BiomarkerKind } from "@/services/health/types";

export default function BiomarkerDetailRoute() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (!biomarkerKinds.includes(kind as BiomarkerKind))
    return <Redirect href="/biomarkers" />;
  return <BiomarkerDetailScreen kind={kind as BiomarkerKind} />;
}
