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
} from "react-native";
import { privateApi } from "@/api/privateApi";
import { API_URL } from "@/config";
import QRCode from "react-native-qrcode-svg";

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

  // QR state
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Scanner state
  const [showScanner, setShowScanner] = useState(false);
  
  // 🔥 Thêm flag để tránh join nhiều lần
  const [isJoining, setIsJoining] = useState(false);

  // JOIN ROOM
  const handleJoinRoom = async (overrideCode?: string) => {
    const code = (overrideCode || roomCode).trim();
    if (!code) return;

    try {
      const res = await privateApi.post<JoinRoomResponse>(
        `/rooms/${code}/join?role=normal`
      );

      const participant = res.data.participant;
      const WS_URL = API_URL.replace("http", "ws");

      const wsUrl =
        `${WS_URL}/ws/rooms/${code}` +
        `?participant_id=${participant.id}` +
        `&role=${participant.role}` +
        `&display_name=${encodeURIComponent(participant.display_name)}`;

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
      console.log("Join room error:", err);
      alert("Không thể tham gia phòng. Vui lòng thử lại!");
    }
  };

  // CREATE ROOM
  const handleCreateRoom = async () => {
    try {
      const res = await privateApi.post<CreateRoomResponse>(
        "/rooms/create",
        null,
        { params: { ttl_minutes } }
      );

      const code = res.data.code;
      console.log("Create room response", res.data);

      // Chủ phòng join luôn
      await handleJoinRoom(code);

      // Lưu code & show QR để người Deaf scan
      setCreatedCode(code);
      setShowQRModal(true);
    } catch (err) {
      console.log("Create room error:", err);
      alert("Không thể tạo phòng. Vui lòng thử lại!");
    }
  };

  // HANDLE SCAN - TỰ ĐỘNG JOIN
  const handleBarCodeScanned = async (data: string | null) => {
    // 🔥 Chặn nếu đang join
    if (isJoining) {
      console.log("Already joining, ignoring scan...");
      return;
    }

    if (!data) {
      // User đóng scanner
      setShowScanner(false);
      return;
    }

    // Parse code từ URL hoặc dùng trực tiếp
    let code = data;
    try {
      if (data.startsWith("http")) {
        const url = new URL(data);
        const parts = url.pathname.split("/");
        code = parts[parts.length - 1];
      }
    } catch (e) {
      console.log("Parse URL error:", e);
    }

    console.log("Scanned code:", code);
    setIsJoining(true); // 🔥 Set flag
    
    // Join phòng ngay lập tức
    try {
      const res = await privateApi.post<JoinRoomResponse>(
        `/rooms/${code}/join?role=normal`
      );

      const participant = res.data.participant;
      const WS_URL = API_URL.replace("http", "ws");

      const wsUrl =
        `${WS_URL}/ws/rooms/${code}` +
        `?participant_id=${participant.id}` +
        `&role=${participant.role}` +
        `&display_name=${encodeURIComponent(participant.display_name)}`;

      // Đóng scanner trước khi navigate
      setShowScanner(false);

      // Navigate vào phòng
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
      console.log("Join room error:", err);
      setShowScanner(false);
      setIsJoining(false); // 🔥 Reset flag nếu lỗi
      alert("Không thể tham gia phòng. Mã QR có thể không hợp lệ!");
    }
  };

  // Nếu đang mở scanner → render full-screen scanner
  if (showScanner) {
    return <QRScanner onScanned={handleBarCodeScanned} />;
  }

  return (
    <View style={{ padding: 20, marginTop: 50 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Conversation</Text>

      {/* CREATE ROOM */}
      <TouchableOpacity onPress={handleCreateRoom} style={styles.button}>
        <Text style={styles.buttonText}>Tạo phòng mới</Text>
      </TouchableOpacity>

      {/* JOIN BY CODE */}
      <TextInput
        placeholder="Nhập mã phòng"
        value={roomCode}
        onChangeText={setRoomCode}
        style={styles.input}
        autoCapitalize="characters"
      />

      <TouchableOpacity
        onPress={() => handleJoinRoom()}
        style={[styles.button, { marginTop: 10 }]}
      >
        <Text style={styles.buttonText}>Tham gia phòng</Text>
      </TouchableOpacity>

      {/* JOIN BY QR */}
      <TouchableOpacity
        onPress={() => setShowScanner(true)}
        style={[styles.button, { marginTop: 16, backgroundColor: "#0F9CF5" }]}
      >
        <Text style={styles.buttonText}>📷 Quét mã QR để tham gia</Text>
      </TouchableOpacity>

      {/* MODAL QR CODE */}
      <Modal
        visible={showQRModal && !!createdCode}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 12 }}>
              Chia sẻ mã QR này để mời người khác
            </Text>

            {createdCode && (
              <QRCode
                value={`${API_URL}/join/${createdCode}`}
                size={220}
              />
            )}

            <Text style={{ marginTop: 12, fontSize: 16, fontWeight: "600" }}>
              Mã phòng: {createdCode}
            </Text>

            <TouchableOpacity
              style={[styles.button, { marginTop: 16 }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.buttonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 15,
    backgroundColor: "#25CCC5",
    marginTop: 20,
    borderRadius: 8,
  },
  buttonText: {
    textAlign: "center",
    color: "white",
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    padding: 10,
    marginTop: 20,
    borderRadius: 8,
    borderColor: "#ddd",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
});
