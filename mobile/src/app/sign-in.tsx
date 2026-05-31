import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { useAuth, useSignIn, useSignUp, useSSO } from "@clerk/clerk-expo";
import { Redirect, useRouter } from "expo-router";
import { Button } from "@/components/ui";
import { MASCOT } from "@/logo";
import { C, radius } from "@/theme";

// Required for the OAuth browser redirect to close and hand control back.
WebBrowser.maybeCompleteAuthSession();

type Mode = "signIn" | "signUp";

function clerkError(e: unknown): string {
  const err = e as { errors?: { message?: string; longMessage?: string }[]; message?: string };
  return err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || "Đã có lỗi xảy ra.";
}

export default function SignInScreen() {
  const { isSignedIn } = useAuth();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingCode, setPendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Warm up the browser for a faster OAuth flow (no-op on iOS).
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  if (isSignedIn) return <Redirect href="/(tabs)" />;

  async function onGoogle() {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      const { createdSessionId, setActive: ssoSetActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
      // else: user cancelled or extra steps required — stay on screen.
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function doSignIn() {
    if (!signInLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await signIn.create({ identifier: email.trim(), password });
      if (res.status === "complete" && res.createdSessionId) {
        await setSignInActive({ session: res.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Tài khoản cần thêm bước xác thực. Hãy đăng nhập trên web trước.");
      }
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setLoading(false);
    }
  }

  async function doSignUp() {
    if (!signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingCode(true);
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!signUpLoaded) return;
    setLoading(true);
    setError(null);
    try {
      const res = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (res.status === "complete" && res.createdSessionId) {
        await setSignUpActive({ session: res.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Mã xác thực chưa đúng.");
      }
    } catch (e) {
      setError(clerkError(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: C.white }}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={MASCOT} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>Maylingo</Text>
        <Text style={styles.subtitle}>1000 từ vựng cơ bản</Text>

        {pendingCode ? (
          <View style={styles.form}>
            <Text style={styles.label}>Nhập mã xác thực đã gửi tới email của bạn</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="Mã 6 số"
              keyboardType="number-pad"
              autoFocus
              placeholderTextColor={C.muted}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button title="Xác nhận" variant="secondary" loading={loading} onPress={verifyCode} />
            <Button
              title="Quay lại"
              variant="ghost"
              onPress={() => {
                setPendingCode(false);
                setError(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <Pressable
              onPress={onGoogle}
              disabled={googleLoading}
              style={({ pressed }) => [styles.googleBtn, pressed && { opacity: 0.85 }, googleLoading && { opacity: 0.6 }]}
            >
              <Ionicons name="logo-google" size={20} color="#EA4335" />
              <Text style={styles.googleText}>{googleLoading ? "Đang mở Google..." : "Tiếp tục với Google"}</Text>
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divLine} />
              <Text style={styles.divText}>hoặc</Text>
              <View style={styles.divLine} />
            </View>

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor={C.muted}
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Mật khẩu"
              secureTextEntry
              autoCapitalize="none"
              placeholderTextColor={C.muted}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <Button
              title={mode === "signIn" ? "Đăng nhập" : "Đăng ký"}
              variant="secondary"
              loading={loading}
              disabled={!email || !password}
              onPress={mode === "signIn" ? doSignIn : doSignUp}
            />
            <Button
              title={mode === "signIn" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
              variant="ghost"
              onPress={() => {
                setMode(mode === "signIn" ? "signUp" : "signIn");
                setError(null);
              }}
            />
          </View>
        )}

        <Text style={styles.hint}>Dùng chung tài khoản với phiên bản web.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 6 },
  logo: { width: 96, height: 96, alignSelf: "center", marginBottom: 8 },
  title: { fontSize: 36, fontWeight: "900", color: C.green600, textAlign: "center", letterSpacing: 0.5 },
  subtitle: { fontSize: 15, color: C.muted, textAlign: "center", marginBottom: 24 },
  form: { gap: 12 },
  label: { fontSize: 14, color: C.text, fontWeight: "600", textAlign: "center" },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    fontSize: 16,
    color: C.textDark,
    backgroundColor: C.white,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: C.border,
    backgroundColor: C.white,
  },
  googleText: { fontSize: 15, fontWeight: "800", color: C.textDark },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 },
  divLine: { flex: 1, height: 1, backgroundColor: C.border },
  divText: { color: C.muted, fontSize: 13, fontWeight: "600" },
  error: { color: C.rose600, fontSize: 14, textAlign: "center" },
  hint: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 16 },
});
