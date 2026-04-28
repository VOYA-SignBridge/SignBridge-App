import { useRouter } from "expo-router";
import React, { useState } from "react";
import QRScanner from "@/components/QRScanner";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from "react-native";
import { privateApi } from "@/api/privateApi";
import { API_URL, WS_BASE } from "@/config";
import QRCode from "react-native-qrcode-svg";
import { useTheme } from "contexts/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
type CreateRoomResponse = {
  code: string;
};

type Participant = {
  id: string;
  role: string;
  display_name: string;
};

type JoinRoomResponse = {
  participant: Participant;
};

export default function ConversationScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const ttl_minutes = 120;
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { colors: theme } = useTheme();

  const handleJoinRoom = async (overrideCode?: string) => {
    const code = (overrideCode || roomCode).trim();
    if (!code) return;

    try {
      const res = await privateApi.post<JoinRoomResponse>(
        `/rooms/${code}/join?role=normal`
      );

      const participant = res.data.participant;
     // Cắt bỏ phần /api/v1 đi, chỉ lấy base URL
const token = await AsyncStorage.getItem("access_token");
const wsUrl =
  `${WS_BASE}/ws/rooms/${code}` +
  `?participant_id=${participant.id}` +
  `&role=${participant.role}` +
  `&display_name=${encodeURIComponent(participant.display_name)}`+`&token=${token}`;

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
    } catch (err) {
      alert("Không thể tham gia phòng. Vui lòng thử lại!");
    }
  };

  const handleCreateRoom = async () => {
    try {
      const res = await privateApi.post<CreateRoomResponse>(
        "/rooms/create",
        null,
        { params: { ttl_minutes } }
      );

      const code = res.data.code;
      await handleJoinRoom(code);
    } catch (err) {
      alert("Không thể tạo phòng. Vui lòng thử lại!");
    }
  };

  const handleBarCodeScanned = async (data: string | null) => {
    if (isJoining) return;

    if (!data) {
      setShowScanner(false);
      return;
    }

    let code = data;
    try {
      if (data.startsWith("http")) {
        const url = new URL(data);
        const parts = url.pathname.split("/");
        code = parts[parts.length - 1];
      }
    } catch (e) { }

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
        params: {
          code,
          participant_id: participant.id,
          role: participant.role,
          display_name: participant.display_name,
          wsUrl,
        },
      });
    } catch (err) {
      setShowScanner(false);
      setIsJoining(false);
      alert("Không thể tham gia phòng. Mã QR có thể không hợp lệ!");
    }
  };

  if (showScanner) {
    return <QRScanner onScanned={handleBarCodeScanned} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.content}>
            
            <View style={styles.headerSection}>
              <Text style={[styles.title, { color: theme.text }]}>Trò chuyện</Text>
              <Text style={[styles.subtitle, { color: theme.icon }]}>
                Bắt đầu trò chuyện bằng cách nhập mã hoặc quét QR.
              </Text>
            </View>

            <View style={[styles.inputGroup, { backgroundColor: theme.controlBG || '#f9f9f9' }]}>
              <TextInput
                placeholder="Nhập mã phòng (VD: ABC12)"
                placeholderTextColor={theme.icon}
                value={roomCode}
                onChangeText={setRoomCode}
                style={[
                  styles.input, 
                  { 
                    color: theme.text, 
                    backgroundColor: theme.background,
                    borderColor: theme.lightGray || '#e0e0e0'
                  }
                ]}
                autoCapitalize="characters"
              />
              
              <TouchableOpacity
                onPress={() => handleJoinRoom()}
                style={[styles.mainButton, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.mainButtonText}>Tham gia ngay</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.divider}>
              <View style={[styles.line, { backgroundColor: theme.lightGray || '#eee' }]} />
              <Text style={[styles.orText, { color: theme.icon }]}>Hoặc</Text>
              <View style={[styles.line, { backgroundColor: theme.lightGray || '#eee' }]} />
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={handleCreateRoom}
                style={[styles.filledButton, { backgroundColor: '#34D399' }]}
              >
                <Text style={styles.filledButtonText}>Tạo phòng mới</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowScanner(true)}
                style={[styles.filledButton, { backgroundColor: '#3B82F6' }]}
              >
                <Text style={styles.filledButtonText}>Quét mã QR</Text>
              </TouchableOpacity>
            </View>

          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <Modal
        visible={showQRModal && !!createdCode}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              Mã phòng
            </Text>
            
            <View style={styles.qrContainer}>
              {createdCode && (
                <QRCode
                  value={`${API_URL}/join/${createdCode}`}
                  size={200}
                  backgroundColor="white"
                  color="black"
                />
              )}
            </View>

            <Text style={[styles.codeText, { color: theme.primary }]}>
              {createdCode}
            </Text>

            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: theme.lightGray || '#eee' }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={[styles.closeButtonText, { color: theme.text }]}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  headerSection: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 24,
    opacity: 0.8,
  },
  
  inputGroup: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 16,
  },
  mainButton: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mainButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: "700",
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    paddingHorizontal: 10,
  },
  line: {
    flex: 1,
    height: 1,
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: "600",
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Other Actions
  actionButtons: {
    gap: 14,
  },
  filledButton: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Tạo hiệu ứng nổi nhẹ
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  filledButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: "700",
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 20,
    elevation: 2,
  },
  codeText: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 24,
  },
  closeButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
