import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { colors } from "@grownupsvet/accessibility-kit";
import type { AuthenticationScreenProps } from "../../navigation/AuthenticationNavigator";
import {
  AuthenticationActionButton,
  AuthenticationFormLayout,
  AuthenticationFormText,
} from "./AuthenticationFormComponents";

const contactEmail = "esteban.gomezl@uqvirtual.edu.co";

export function PrivacyNoticeScreen({
  navigation,
}: AuthenticationScreenProps<"PrivacyNotice">) {
  const openEmail = async () => {
    try {
      await Linking.openURL(`mailto:${contactEmail}`);
    } catch {
      Alert.alert("Escríbenos", `Puedes escribir a ${contactEmail}.`);
    }
  };

  return (
    <AuthenticationFormLayout
      title="Tratamiento de datos personales"
      description="Conoce qué información usa GrownupsVet y cómo consultar tus datos."
    >
      <View style={styles.section}>
        <Text accessibilityRole="header" aria-level={2} style={styles.heading}>
          ¿Qué información utilizamos?
        </Text>
        <AuthenticationFormText>
          Al crear una cuenta, nos proporcionas tu nombre, correo electrónico,
          fecha de nacimiento, número de teléfono y contraseña. También puedes
          agregar una foto y registrar información de tus mascotas, citas y
          atenciones veterinarias.
        </AuthenticationFormText>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" aria-level={2} style={styles.heading}>
          ¿Para qué la usamos?
        </Text>
        <AuthenticationFormText>
          Usamos esta información para crear y administrar tu cuenta, permitirte
          recuperar el acceso, gestionar tus mascotas y citas, conservar las
          atenciones veterinarias y enviar avisos relacionados con el servicio.
        </AuthenticationFormText>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" aria-level={2} style={styles.heading}>
          ¿Quién puede acceder?
        </Text>
        <AuthenticationFormText>
          El acceso depende de la cuenta, sus permisos y la relación con la
          información. El personal autorizado consulta lo necesario para sus
          funciones; la información clínica tiene permisos específicos.
          GrownupsVet utiliza servicios de Cloudflare, Google Cloud y Render
          para ofrecer la aplicación y almacenar la información.
        </AuthenticationFormText>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" aria-level={2} style={styles.heading}>
          ¿Por cuánto tiempo conservamos tus datos?
        </Text>
        <AuthenticationFormText>
          Está previsto eliminar los datos personales cuando venza la base de
          datos alojada en Render. Esta eliminación también debe abarcar las
          copias de respaldo.
        </AuthenticationFormText>
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" aria-level={2} style={styles.heading}>
          Tus derechos y contacto
        </Text>
        <AuthenticationFormText>
          Puedes solicitar información sobre tus datos, su actualización,
          corrección o eliminación, y formular consultas o reclamos de acuerdo
          con la normativa aplicable, incluida la Ley 1581 de 2012. La
          desactivación de la cuenta no significa que sus datos se eliminen
          automáticamente.
        </AuthenticationFormText>
        <AuthenticationFormText>
          Responsable: Esteban Gómez León. Para presentar una solicitud,
          escríbenos a {contactEmail}.
        </AuthenticationFormText>
        <AuthenticationActionButton
          label={`Escribir a ${contactEmail}`}
          kind="link"
          onPress={() => void openEmail()}
        />
      </View>
      <AuthenticationActionButton
        label="Volver"
        kind="secondary"
        onPress={() => navigation.goBack()}
      />
    </AuthenticationFormLayout>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 28,
  },
});
