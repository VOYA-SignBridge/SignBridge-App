import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Dimensions,
  Modal,
  Platform
} from "react-native";
import { privateApi } from "@/api/privateApi";
import { API_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SignVideo } from "@/components/SignVideo";
import QRCode from "react-native-qrcode-svg";

export default function RoomScreen() {
  const { code, participant_id, role, display_name, wsUrl } = useLocalSearchParams();
  
  const [participants, setParticipants] = useState<Record<string, any>>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [text, setText] = useState("");
  
  // 🔥 Modal QR state
  const [showQRModal, setShowQRModal] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);

  console.log("RoomScreen mounted");

  type Participant = {
    participant_id: number;
    user_id: number | string | null;
    display_name: string;
    role: string;
    joined_at: string;
  };
  
  // 🔥 Responsive video size theo platform
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const isWeb = Platform.OS === 'web';
  
  const getVideoWidth = () => {
    if (isWeb) {
      // Web: phân biệt mobile/desktop
      if (SCREEN_WIDTH < 768) {
        return SCREEN_WIDTH * 0.45; // Web mobile: 45%
      } else {
        // Web desktop: 25% nhưng max 250px
        return Math.min(SCREEN_WIDTH * 0.25, 250);
      }
    }
    // Native app
    if (SCREEN_WIDTH < 600) {
      return SCREEN_WIDTH * 0.49; // Phone: 49%
    } else {
      return SCREEN_WIDTH * 0.35; // Tablet: 35%
    }
  };
  
  const VIDEO_WIDTH = getVideoWidth();
  const VIDEO_HEIGHT = VIDEO_WIDTH * (16 / 9);

  useEffect(() => {
    async function loadParticipants() {
      try {
        const res = await privateApi.get(`/rooms/${code}/participants`);

        const map: Record<string, Participant> = {};
        console.log("Participants loaded:", res.data);
        (res.data as Participant[]).forEach((p) => {
          map[String(p.participant_id)] = p;  
        });

        setParticipants(map);
      } catch (err) {
        console.log("Load participants error:", err);
      }
    }

    loadParticipants();
  }, [code]); // 🔥 Thêm dependency

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    let socket: WebSocket | null = null;

    const connect = async () => {
      const token = await AsyncStorage.getItem("access_token");

      if (!token) {
        console.log("No token found!");
        return;
      }

      // 🔥 Tránh connect nhiều lần
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("WebSocket already connected");
        return;
      }

      console.log("Connecting WebSocket...");
      socket = new WebSocket(wsUrl as string, ["jwt", token]);
      setWs(socket);

      socket.onopen = () => {
        console.log("WS Connected");

        if (!participant_id) return;

        setParticipants((prev) => ({
          ...prev,
          [String(participant_id)]: {
            participant_id,
            display_name,
            role,
          },
        }));
      };

      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === "presence.join") {
          setParticipants((prev) => ({
            ...prev,
            [msg.participant_id]: msg,
          }));
        }

        if (msg.type === "presence.leave") {
          setParticipants((prev) => {
            const cp = { ...prev };
            delete cp[msg.participant_id];
            return cp;
          });
        }

        if (msg.type === "chat.message") {
          setMessages((prev) => [...prev, msg]);
        }
      };

      socket.onclose = () => {
        console.log("WS Closed");
      };

      socket.onerror = (error) => {
        console.log("WS Error:", error);
      };
    };

    connect();

    return () => {
      console.log("Cleanup: Closing WebSocket");
      if (socket) {
        socket.close();
      }
    };
  }, [wsUrl, participant_id, display_name, role]); // 🔥 Thêm dependencies

  const sendMessage = () => {
    if (!ws || ws.readyState !== 1) return;

    const msg = {
      type: "chat.message",
      text,
      no_echo: true,
    };

    ws.send(JSON.stringify(msg));
    setText("");
  };

  return (
    <View style={styles.container}>
      {/* HEADER với nút QR */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>
              Room: {code}
            </Text>
            <Text style={styles.headerSub}>
              {Object.keys(participants).length} member(s): {Object.values(participants)
                .map((p: any) => p.display_name)
                .join(", ")}
            </Text>
          </View>
          
          {/* Nút hiển thị QR */}
          <TouchableOpacity 
            style={styles.qrButton}
            onPress={() => setShowQRModal(true)}
          >
            <Text style={styles.qrButtonText}>📱 QR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CHAT */}
      <FlatList
        ref={flatListRef}
        style={styles.chatContainer}
        data={messages}
        showsVerticalScrollIndicator={false}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => {
          const sender = item.sender || {};
          const isMe = String(sender.participant_id) === String(participant_id);

          return (
            <View style={isMe ? styles.bubbleRight : styles.bubbleLeft}>
              <Text style={{ fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
                {sender.display_name ?? "Unknown"} ({sender.role ?? "normal"})
              </Text>

              <Text style={styles.bubbleText}>{item.text}</Text>

              {Array.isArray(item.videos) && item.videos.length > 0 && (
                <View style={{ marginTop: 8, width: "100%", alignItems: isMe ? "flex-end" : "flex-start" }}>
                  {item.videos.map((v: any) => (
                    <View
                      key={`${v.sign_id}-${v.key}`}
                      style={{ marginBottom: 8, alignItems: "center" }}
                    >
                      <SignVideo
                        url={v.mp4_url}
                        width={VIDEO_WIDTH}
                        height={VIDEO_HEIGHT}
                      />
                      <Text style={{ fontSize: 11, marginTop: 4, paddingHorizontal: 4, backgroundColor: "#eee" }}>
                        {v.key}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.timeText}>
                {new Date(item.timestamp * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          );
        }}
      />

      {/* INPUT */}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type message..."
          style={styles.input}
        />

        <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>

      {/* 🔥 MODAL HIỂN THỊ QR CODE */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Chia sẻ mã phòng
            </Text>

            {/* QR Code */}
            <View style={styles.qrContainer}>
              <QRCode
                value={`${API_URL}/join/${code}`}
                size={200}
              />
            </View>

            {/* Room Code */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Mã phòng:</Text>
              <Text style={styles.codeText}>{code}</Text>
            </View>

            <Text style={styles.modalInstruction}>
              Người khác có thể quét mã QR hoặc nhập mã phòng để tham gia
            </Text>

            {/* Nút đóng */}
            <TouchableOpacity
              style={styles.closeModalBtn}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={styles.closeModalText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F6F6F6" 
  },

  header: {
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },

  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerName: { 
    fontSize: 20, 
    fontWeight: "700",
    marginBottom: 4,
  },

  headerSub: { 
    color: "#888",
    fontSize: 13,
  },

  qrButton: {
    backgroundColor: "#25CCC5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },

  qrButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },

  chatContainer: {
    flex: 1,
    padding: 15,
  },

  bubbleLeft: {
    maxWidth: "90%",
    backgroundColor: "white",
    padding: 12,
    borderRadius: 16,
    borderTopLeftRadius: 0,
    marginBottom: 10,
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },

  bubbleRight: {
    maxWidth: "90%",
    backgroundColor: "#D1F7F2",
    padding: 12,
    borderRadius: 16,
    borderTopRightRadius: 0,
    marginBottom: 10,
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },

  bubbleText: {
    fontSize: 15,
    color: "#222",
  },

  timeText: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
    alignSelf: "flex-end",
  },

  inputRow: {
    flexDirection: "row",
    padding: 10,
    alignItems: "center",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#DDD",
  },

  input: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 25,
    backgroundColor: "#FAFAFA",
  },

  sendBtn: {
    marginLeft: 10,
    padding: 12,
    backgroundColor: "#25CCC5",
    borderRadius: 50,
  },

  sendIcon: {
    color: "white",
    fontWeight: "800",
  },

  // 🔥 MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },

  modalContent: {
    backgroundColor: "white",
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    width: "85%",
    maxWidth: 400,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    color: "#333",
  },

  qrContainer: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E0E0E0",
    marginBottom: 20,
  },

  codeBox: {
    backgroundColor: "#F0F0F0",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },

  codeLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },

  codeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#25CCC5",
    letterSpacing: 2,
  },

  modalInstruction: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 10,
  },

  closeModalBtn: {
    backgroundColor: "#25CCC5",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
  },

  closeModalText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
});