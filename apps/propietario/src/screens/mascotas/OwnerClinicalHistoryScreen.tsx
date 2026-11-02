import { ScrollView } from "react-native";
import { ClinicalHistoryScreen } from "@application/clinical/ClinicalHistoryScreen";
import type { MascotasStackScreenProps } from "../../navigation/MascotasStack";
import { petStyles as styles } from "./petStyles";

export function OwnerClinicalHistoryScreen({
  route,
  navigation,
}: MascotasStackScreenProps<"ClinicalHistory">) {
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ClinicalHistoryScreen
        petId={route.params.petId}
        petName={route.params.petName}
        onBack={() => navigation.goBack()}
      />
    </ScrollView>
  );
}
