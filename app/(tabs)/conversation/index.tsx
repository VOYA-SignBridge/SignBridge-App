import { useRouter } from "expo-router";
import React, { useState } from "react";
import QRScanner from "@/components/QRScanner";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { privateApi } from "@/api/privateApi";
import { WS_BASE } from "@/config";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from "@/contexts/ThemeContext";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

type CreateRoomResponse = { code: string };
type Participant = { id: string; role: string; display_name: string };
type JoinRoomResponse = { participant: Participant };

export default function ConversationScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { colors, theme: themeMode } = useTheme();
  const { t } = useTranslation();

  const isDark = themeMode === "dark";

  const handleJoinRoom = async (overrideCode?: string) => {
    const code = (overrideCode || roomCode).trim();
    if (!code) return;

    try {
      const res = await privateApi.post<JoinRoomResponse>(
        `/rooms/${code}/join?role=normal`
      );
      const participant = res.data.participant;
      const token = await AsyncStorage.getItem("access_token");
      const wsUrl =
        `${WS_BASE}/ws/rooms/${code}` +
        `?participant_id=${participant.id}` +
        `&role=${participant.role}` +
        `&display_name=${encodeURIComponent(participant.display_name)}` +
        `&token=${token}`;

      router.push({
        pathname: "/conversation/room/[code]",
        params: {
          code,
          participant_id: participant.id,
          role: participant.role,
          display_name: participant.display_name,
          wsUrl,
        },
      });
    } catch {
      alert(t("conversation.joinFailed"));
    }
  };

  const handleCreateRoom = async () => {
    try {
      const res = await privateApi.post<CreateRoomResponse>(
        "/rooms/create",
        null,
        { params: { ttl_minutes: 120 } }
      );
      await handleJoinRoom(res.data.code);
    } catch {
      alert(t("conversation.createFailed"));
    }
  };

  const handleBarCodeScanned = async (data: string | null) => {
    if (isJoining) return;
    if (!data) { setShowScanner(false); return; }

    let code = data;
    try {
      if (data.startsWith("http")) {
        const parts = new URL(data).pathname.split("/");
        code = parts[parts.length - 1];
      }
    } catch { }

    setIsJoining(true);
    try {
      const res = await privateApi.post<JoinRoomResponse>(
        `/rooms/${code}/join?role=normal`
      );
      const participant = res.data.participant;
      const token = await AsyncStorage.getItem("access_token");
      const wsUrl =
        `${WS_BASE}/ws/rooms/${code}` +
        `?participant_id=${participant.id}` +
        `&role=${participant.role}` +
        `&display_name=${encodeURIComponent(participant.display_name)}` +
        `&token=${token}`;

      setShowScanner(false);
      router.push({
        pathname: "/conversation/room/[code]",
        params: { code, participant_id: participant.id, role: participant.role, display_name: participant.display_name, wsUrl },
      });
    } catch {
      setShowScanner(false);
      setIsJoining(false);
      alert(t("conversation.qrInvalid"));
    }
  };

  if (showScanner) return <QRScanner onScanned={handleBarCodeScanned} />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>

            {/* ── Header ── */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t("conversation.title")}
              </Text>
              <Text style={[styles.subtitle, { color: colors.mediumGray }]}>
                {t("conversation.subtitle")}
              </Text>
            </View>

            {/* ── Join by code card ── */}
            <View style={[styles.card, { backgroundColor: colors.cardBG }]}>
              <Text style={[styles.cardLabel, { color: colors.mediumGray }]}>
                {t("conversation.enterCode")}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="VD: ABCD12"
                  placeholderTextColor={colors.mediumGray}
                  value={roomCode}
                  onChangeText={setRoomCode}
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.textInputBG,
                      borderColor: colors.borderColor,
                    },
                  ]}
                  autoCapitalize="characters"
                  selectionColor={colors.primary}
                />
                <TouchableOpacity
                  onPress={() => handleJoinRoom()}
                  disabled={!roomCode.trim()}
                  style={[
                    styles.joinBtn,
                    {
                      backgroundColor: roomCode.trim() ? colors.primary : colors.lightGray,
                    },
                  ]}
                >
                  <Ionicons
                    name="arrow-forward"
                    size={22}
                    color={roomCode.trim() ? "#fff" : colors.mediumGray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Divider ── */}
            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: colors.lightGray }]} />
              <Text style={[styles.orText, { color: colors.mediumGray }]}>
                {t("conversation.or")}
              </Text>
              <View style={[styles.line, { backgroundColor: colors.lightGray }]} />
            </View>

            {/* ── Action cards ── */}
            <View style={styles.actionRow}>
              {/* Tạo phòng */}
              <TouchableOpacity
                onPress={handleCreateRoom}
                activeOpacity={0.75}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? colors.cardBG : colors.success + "18",
                    borderColor: colors.success,
                  },
                ]}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: colors.success + "25" }]}>
                  <Ionicons name="add-circle-outline" size={30} color={colors.success} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.success }]}>
                  {t("conversation.createRoom")}
                </Text>
                <Text style={[styles.actionSub, { color: colors.mediumGray }]}>
                  {t("conversation.createRoomSub")}
                </Text>
              </TouchableOpacity>

              {/* Quét QR */}
              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                activeOpacity={0.75}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? colors.cardBG : colors.primary + "18",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={[styles.actionIconCircle, { backgroundColor: colors.primary + "25" }]}>
                  <Ionicons name="qr-code-outline" size={30} color={colors.primary} />
                </View>
                <Text style={[styles.actionTitle, { color: colors.primary }]}>
                  {t("conversation.scanQR")}
                </Text>
                <Text style={[styles.actionSub, { color: colors.mediumGray }]}>
                  {t("conversation.scanQRSub")}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  // Join card
  card: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
  },
  joinBtn: {
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  // Divider
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 22,
  },
  line: { flex: 1, height: 1 },
  orText: {
    paddingHorizontal: 14,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Action cards
  actionRow: {
    flexDirection: "row",
    gap: 14,
  },
  actionCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
  },
  actionIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  actionSub: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
});
