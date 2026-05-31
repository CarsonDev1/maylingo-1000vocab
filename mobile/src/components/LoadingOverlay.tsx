import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { MASCOT } from "@/logo";
import { C } from "@/theme";

const RING = 132; // diameter of the spinner ring
const MASCOT_SIZE = 76; // mascot sits inside the ring
const STROKE = 6;

/**
 * Full-screen white loading overlay: the Maylingo mascot in the centre with a
 * spinner ring rotating around it. Rendered as a Modal so it covers everything
 * (tab bar, headers, other sheets). Shown while data is being saved/loaded.
 */
export function LoadingOverlay({ visible, message }: { visible: boolean; message?: string }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0);
    const anim = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [visible, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.badge}>
          {/* faint full track */}
          <View style={styles.track} />
          {/* bright arc that spins around the mascot */}
          <Animated.View style={[styles.arc, { transform: [{ rotate }] }]} />
          {/* mascot, centred and static */}
          <Image source={MASCOT} style={styles.mascot} contentFit="contain" />
        </View>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  badge: { width: RING, height: RING, alignItems: "center", justifyContent: "center" },
  track: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: STROKE,
    borderColor: C.greenSoft,
  },
  arc: {
    position: "absolute",
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: STROKE,
    borderColor: "transparent",
    borderTopColor: C.green,
    borderRightColor: C.green,
  },
  mascot: { width: MASCOT_SIZE, height: MASCOT_SIZE },
  message: { color: C.neutral800, fontSize: 15, fontWeight: "700" },
});
