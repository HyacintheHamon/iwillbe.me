import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
  type ImageSourcePropType,
  type TextInputProps,
} from "react-native";
import { ArrowLeftIcon as ArrowLeft } from "phosphor-react-native/src/icons/ArrowLeft";
import { ArrowRightIcon as ArrowRight } from "phosphor-react-native/src/icons/ArrowRight";
import { CheckIcon as Check } from "phosphor-react-native/src/icons/Check";
import { StarFourIcon as StarFour } from "phosphor-react-native/src/icons/StarFour";
import { XIcon as X } from "phosphor-react-native/src/icons/X";
import { router } from "expo-router";
export const C = {
  paper: "#F4EFE4",
  navy: "#11162B",
  ink: "#444B61",
  gold: "#AF812C",
  goldLight: "#ECD7A7",
  line: "#DED8CC",
  muted: "#78796F",
  white: "#FFFCF6",
  blue: "#DCE7EC",
  clay: "#DFC1AA",
};
export const F = {
  serif: "Fraunces_500Medium",
  bold: "Fraunces_600SemiBold",
  sans: "DMSans_400Regular",
  medium: "DMSans_500Medium",
  strong: "DMSans_600SemiBold",
};
export const art = {
  morning: require("../assets/illustrations/morning-orbit.png"),
  evening: require("../assets/illustrations/evening-reflection.png"),
  explore: require("../assets/illustrations/exploration.png"),
  icon: require("../assets/icon.png"),
};
export function Body({
  children,
  style,
  ...props
}: {
  children: React.ReactNode;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}) {
  return (
    <Text {...props} style={[s.body, style]}>
      {children}
    </Text>
  );
}
export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Text accessibilityRole="header" style={[s.title, style]}>
      {children}
    </Text>
  );
}
export function Eyebrow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[s.eyebrow, style]}>{children}</Text>;
}
export function Button({
  label,
  onPress,
  secondary = false,
  loading = false,
  disabled = false,
  icon = true,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled || loading ? 0.6 : pressed ? 0.82 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? C.navy : C.white} />
      ) : (
        <>
          <Text style={[s.buttonText, secondary && { color: C.navy }]}>
            {label}
          </Text>
          {icon && (
            <ArrowRight
              size={22}
              color={secondary ? C.navy : C.goldLight}
              weight="light"
            />
          )}
        </>
      )}
    </Pressable>
  );
}
export function TextButton({
  label,
  onPress,
  color = C.ink,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={s.textButton}
    >
      <Body style={{ color, textAlign: "center", fontFamily: F.medium }}>
        {label}
      </Body>
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        s.chip,
        selected && { borderColor: C.gold, backgroundColor: "#EFE3C9" },
      ]}
    >
      {selected && <Check size={15} color={C.gold} />}
      <Body style={{ fontSize: 14, color: selected ? C.navy : C.ink }}>
        {label}
      </Body>
    </Pressable>
  );
}
export function Field({
  label,
  ...props
}: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 8 }}>
      {label && <Body style={s.label}>{label}</Body>}
      <TextInput
        accessibilityLabel={label || props.placeholder}
        {...props}
        placeholderTextColor="#88887F"
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({
  text,
  tone = "normal",
}: {
  text: string;
  tone?: "normal" | "error";
}) {
  return text ? (
    <View
      accessibilityRole="alert"
      style={[s.notice, tone === "error" && { backgroundColor: "#F4E6DE" }]}
    >
      <Body
        style={{
          fontSize: 13,
          lineHeight: 20,
          color: tone === "error" ? "#883F2D" : C.ink,
        }}
      >
        {text}
      </Body>
    </View>
  ) : null;
}
export function Page({
  children,
  header,
  footer,
  contentStyle,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.paper }}>
      {header}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.page, contentStyle]}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
  );
}
export function TopBar({
  title,
  right,
  back = true,
}: {
  title?: string;
  right?: React.ReactNode;
  back?: boolean;
}) {
  return (
    <View style={s.topbar}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={s.iconButton}
        >
          <ArrowLeft size={24} color={C.navy} weight="light" />
        </Pressable>
      ) : (
        <View style={s.iconButton} />
      )}
      <Body style={{ fontFamily: F.medium, color: C.navy }}>{title}</Body>
      {right || <View style={s.iconButton} />}
    </View>
  );
}
export function Illustration({
  source,
  height = 250,
}: {
  source: ImageSourcePropType;
  height?: number;
}) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={source}
      resizeMode="contain"
      style={{ width: "100%", height }}
    />
  );
}
export function ChloeMark({ small = false }: { small?: boolean }) {
  return (
    <View
      style={{
        backgroundColor: "#F1E3C6",
        padding: small ? 6 : 12,
        borderRadius: 40,
        alignSelf: "flex-start",
      }}
    >
      <StarFour size={small ? 16 : 24} weight="fill" color={C.gold} />
    </View>
  );
}
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal
      transparent
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#11162B55",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityLabel="Close details"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={{
            width: "100%",
            maxWidth: 430,
            maxHeight: "88%",
            backgroundColor: C.paper,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 24,
            paddingBottom: 36,
          }}
        >
          <View
            style={[
              s.row,
              { justifyContent: "space-between", paddingBottom: 20 },
            ]}
          >
            <Title style={{ fontSize: 27, lineHeight: 34, flex: 1 }}>
              {title}
            </Title>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={s.iconButton}
            >
              <X size={22} color={C.navy} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: 18 }}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export const s = StyleSheet.create({
  body: { fontFamily: F.sans, fontSize: 15, lineHeight: 23, color: C.ink },
  title: {
    fontFamily: F.serif,
    fontSize: 36,
    lineHeight: 43,
    color: C.navy,
    letterSpacing: -1,
  },
  eyebrow: {
    fontFamily: F.medium,
    fontSize: 10,
    letterSpacing: 2.7,
    color: C.gold,
    textTransform: "uppercase",
    lineHeight: 18,
  },
  page: { padding: 24, paddingBottom: 36, gap: 20 },
  button: {
    minHeight: 58,
    borderRadius: 30,
    backgroundColor: C.navy,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.line,
  },
  buttonText: { fontFamily: F.medium, fontSize: 18, color: C.white },
  textButton: {
    padding: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    paddingHorizontal: 15,
    minHeight: 44,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 24,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  input: {
    fontFamily: F.sans,
    fontSize: 16,
    lineHeight: 24,
    borderBottomWidth: 1,
    borderColor: C.line,
    paddingVertical: 14,
    paddingHorizontal: 4,
    color: C.navy,
    backgroundColor: "transparent",
  },
  label: {
    fontFamily: F.medium,
    fontSize: 12,
    color: C.muted,
    letterSpacing: 0.4,
  },
  notice: { padding: 14, borderRadius: 16, backgroundColor: "#EEE8DD" },
  topbar: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  section: { borderTopWidth: 1, borderColor: C.line, paddingTop: 24, gap: 16 },
  card: {
    backgroundColor: C.white,
    padding: 22,
    borderRadius: 22,
    gap: 16,
    borderWidth: 1,
    borderColor: "#E8E0D3",
  },
});
