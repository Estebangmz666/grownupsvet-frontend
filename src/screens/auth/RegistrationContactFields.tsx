import { forwardRef, useState } from "react";
import { TextInput, View } from "react-native";
import type { CountryCode } from "libphonenumber-js";
import {
  AuthenticationActionButton,
  AuthenticationTextField,
} from "./AuthenticationFormComponents";
import { AuthenticationSelectField } from "./AuthenticationSelectField";
import {
  registrationDateToIso,
  registrationInternationalPhone,
  registrationPhoneCountries,
} from "./registrationContactModel";
import { registrationTodayInBogota } from "./registrationForm";

interface RegistrationContactFieldProps {
  id: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmitEditing: () => void;
}

export const RegistrationBirthDateField = forwardRef<
  TextInput,
  RegistrationContactFieldProps
>(function RegistrationBirthDateField(
  { id, error, disabled, onChange, onSubmitEditing },
  ref,
) {
  const [input, setInput] = useState("");
  const [choosing, setChoosing] = useState(false);
  const todayYear = Number(registrationTodayInBogota().slice(0, 4));
  const [day = "", month = "", year = ""] = input.split("/");
  const change = (value: string) => {
    setInput(value);
    onChange(registrationDateToIso(value));
  };
  const choose = (part: "day" | "month" | "year", value: string) => {
    change(
      `${part === "day" ? value : day}/${part === "month" ? value : month}/${part === "year" ? value : year}`,
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <AuthenticationTextField
        ref={ref}
        id={id}
        label="Fecha de nacimiento"
        helperText="Día/mes/año (DD/MM/AAAA). Por ejemplo, 04/07/1958. Puedes escribirla o elegir día, mes y año."
        error={error}
        value={input}
        onChangeText={change}
        placeholder="DD/MM/AAAA"
        autoComplete="birthdate-full"
        textContentType="birthdate"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={!disabled}
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
      />
      <AuthenticationActionButton
        label={choosing ? "Ocultar selector de fecha" : "Elegir día, mes y año"}
        kind="secondary"
        disabled={disabled}
        onPress={() => setChoosing((value) => !value)}
      />
      {choosing ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <AuthenticationSelectField
            label="Día de nacimiento"
            value={day.padStart(2, "0")}
            disabled={disabled}
            onChange={(value) => choose("day", value)}
            options={Array.from({ length: 31 }, (_, index) => ({
              value: String(index + 1).padStart(2, "0"),
              label: String(index + 1),
            }))}
          />
          <AuthenticationSelectField
            label="Mes de nacimiento"
            value={month.padStart(2, "0")}
            disabled={disabled}
            onChange={(value) => choose("month", value)}
            options={Array.from({ length: 12 }, (_, index) => ({
              value: String(index + 1).padStart(2, "0"),
              label: new Intl.DateTimeFormat("es", {
                month: "long",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(2000, index, 1))),
            }))}
          />
          <AuthenticationSelectField
            label="Año de nacimiento"
            value={year}
            disabled={disabled}
            onChange={(value) => choose("year", value)}
            options={Array.from({ length: 132 }, (_, index) => ({
              value: String(todayYear - index),
              label: String(todayYear - index),
            }))}
          />
        </View>
      ) : null}
    </View>
  );
});

export const RegistrationPhoneField = forwardRef<
  TextInput,
  RegistrationContactFieldProps
>(function RegistrationPhoneField(
  { id, error, disabled, onChange, onSubmitEditing },
  ref,
) {
  const [country, setCountry] = useState<CountryCode>("CO");
  const [nationalNumber, setNationalNumber] = useState("");
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: 12,
      }}
    >
      <View style={{ flexBasis: 180, flexGrow: 1, minWidth: 0 }}>
        <AuthenticationSelectField
          label="País y código de teléfono"
          value={country}
          options={registrationPhoneCountries}
          disabled={disabled}
          onChange={(value) => {
            if (
              !registrationPhoneCountries.some(
                (option) => option.value === value,
              )
            )
              return;
            const nextCountry = value as CountryCode;
            setCountry(nextCountry);
            onChange(
              registrationInternationalPhone(nextCountry, nationalNumber),
            );
          }}
        />
      </View>
      <View style={{ flexBasis: 220, flexGrow: 2, minWidth: 0 }}>
        <AuthenticationTextField
          ref={ref}
          id={id}
          label="Número de teléfono"
          helperText="Escribe tu número nacional. También puedes pegar el número completo con + y el prefijo del país elegido."
          error={error}
          value={nationalNumber}
          onChangeText={(value) => {
            setNationalNumber(value);
            onChange(registrationInternationalPhone(country, value));
          }}
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          keyboardType="phone-pad"
          editable={!disabled}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
        />
      </View>
    </View>
  );
});
