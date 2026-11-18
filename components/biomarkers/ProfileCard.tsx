import { Text } from "react-native";

import { Card } from "@/components/ui/primitives";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { HealthProfile } from "@/services/health/types";

/**
 * Asks once for birth year and sex when the health source doesn't share them
 * (always the case on Health Connect). Saved only on this device.
 */
export function ProfileCard({ profile }: { profile: HealthProfile }) {
  return (
    <Card>
      <Text className="type-subheading text-text">
        Personalise your ratings
      </Text>
      <Text className="type-body-small text-text-muted mt-xs mb-lg">
        VO₂ max, body fat and Fitness Age are compared with people of your age
        and sex. Your health app doesn&apos;t share these, so add them here.
      </Text>
      <ProfileForm initial={profile} />
    </Card>
  );
}
