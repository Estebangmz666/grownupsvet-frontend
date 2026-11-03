import { createElement, useId, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AuthenticationActionButton } from "./AuthenticationFormComponents";

interface AuthenticationSelectFieldProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/** Native browser select provides keyboard navigation, type-ahead and mobile pickers. */
export function AuthenticationSelectField({
  label,
  value,
  options,
  onChange,
  disabled,
}: AuthenticationSelectFieldProps) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);
  return (
    <View style={styles.field}>
      <Text nativeID={`${id}-label`} style={styles.label}>
        {label}
      </Text>
      {Platform.OS === "web" ? (
        createElement(
          "select",
          {
            id,
            value,
            disabled,
            "aria-labelledby": `${id}-label`,
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
              onChange(event.target.value),
            onFocus: () => setFocused(true),
            onBlur: () => setFocused(false),
            style: {
              width: "100%",
              minWidth: 0,
              minHeight: 52,
              padding: 10,
              fontSize: 18,
              color: "#1c1c1e",
              backgroundColor: "white",
              border: "2px solid #6b6f73",
              borderRadius: 8,
              ...(focused
                ? { outline: "3px solid #0066cc", outlineOffset: 3 }
                : {}),
            },
          },
          [
            createElement("option", { value: "", key: "" }, "Selecciona"),
            ...options.map((option) =>
              createElement(
                "option",
                { key: option.value, value: option.value },
                option.label,
              ),
            ),
          ],
        )
      ) : (
        <>
          <AuthenticationActionButton
            label={`${label}: ${selected?.label ?? "Selecciona"}`}
            disabled={disabled}
            kind="secondary"
            onPress={() => {
              setSearch("");
              setOpen(true);
            }}
          />
          <Modal
            visible={open}
            onRequestClose={() => setOpen(false)}
            accessibilityViewIsModal
          >
            <View style={styles.dialog}>
              <Text accessibilityRole="header" style={styles.label}>
                {label}
              </Text>
              <TextInput
                accessibilityLabel={`Buscar ${label.toLowerCase()}`}
                value={search}
                onChangeText={setSearch}
                style={styles.search}
                autoFocus
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                {options
                  .filter((option) =>
                    option.label
                      .toLocaleLowerCase("es")
                      .includes(search.toLocaleLowerCase("es")),
                  )
                  .map((option) => (
                    <AuthenticationActionButton
                      key={option.value}
                      label={option.label}
                      kind="secondary"
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                    />
                  ))}
              </ScrollView>
              <AuthenticationActionButton
                label="Cerrar selector"
                onPress={() => setOpen(false)}
              />
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexGrow: 1, flexBasis: 100, minWidth: 0, gap: 8 },
  label: { fontSize: 18, lineHeight: 27, fontWeight: "600", color: "#1c1c1e" },
  dialog: { flex: 1, padding: 20, gap: 16 },
  search: {
    minHeight: 52,
    borderWidth: 2,
    borderColor: "#6b6f73",
    padding: 12,
    fontSize: 18,
  },
});
