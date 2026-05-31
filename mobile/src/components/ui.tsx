import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { C, radius } from "@/theme";

// ---------------------------------------------------------------------------
// Button — chunky Duolingo-style with a bottom bevel (border-b-4) that
// collapses on press.
// ---------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "primaryOutline" | "secondaryOutline" | "danger" | "ghost";

const VARIANTS: Record<Variant, { bg: string; bevel: string; text: string; border?: string }> = {
  primary: { bg: C.sky, bevel: C.sky500, text: C.white },
  secondary: { bg: C.green, bevel: C.green600, text: C.white },
  danger: { bg: C.rose, bevel: C.rose600, text: C.white },
  primaryOutline: { bg: C.white, bevel: C.border, text: C.sky500, border: C.border },
  secondaryOutline: { bg: C.white, bevel: C.border, text: C.green600, border: C.border },
  ghost: { bg: "transparent", bevel: "transparent", text: C.text },
};

export function Button({
  title,
  onPress,
  variant = "secondary",
  disabled,
  loading,
  style,
  textStyle,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const v = VARIANTS[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: v.bg,
          borderBottomColor: v.bevel,
          borderColor: v.border ?? v.bevel,
          borderWidth: v.border ? 2 : 0,
          borderBottomWidth: pressed ? 2 : 4,
          marginTop: pressed ? 2 : 0,
          opacity: off ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={[styles.btnText, { color: v.text }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card — white surface with a 2px border.
// ---------------------------------------------------------------------------
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// ProgressBar — green fill on a light track.
// ---------------------------------------------------------------------------
export function ProgressBar({
  value, // 0..100
  height = 12,
  track = C.slate100,
  fill = C.green,
  style,
}: {
  value: number;
  height?: number;
  track?: string;
  fill?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[{ height, backgroundColor: track, borderRadius: radius.pill, overflow: "hidden" }, style]}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: fill, borderRadius: radius.pill }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Badge — small rounded label.
// ---------------------------------------------------------------------------
export function Badge({
  label,
  color = C.green,
  bg,
  textColor = C.white,
  style,
}: {
  label: string;
  color?: string;
  bg?: string;
  textColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg ?? color }, style]}>
      <Text style={[styles.badgeText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnText: {
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    textAlign: "center",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: C.border,
    padding: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
});
