import { router, useLocalSearchParams } from "expo-router";
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
  Platform,
  KeyboardAvoidingView,
  StatusBar
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { privateApi } from "@/api/privateApi";
import { API_URL } from "@/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SignVideo } from "@/components/SignVideo";
import QRCode from "react-native-qrcode-svg";
import SignLanguageCamera from '@/components/SignLanguageCamera';
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from 'contexts/ThemeContext';
import AlphabetMode from "@/components/translation/AlphabetMode";
import WordMode from "@/components/translation/WordMode";

type Participant = {
  participant_id: number;
  user_id: number | string | null;
  display_name: string;
  role: string;
  joined_at: string;
};

export default function RoomScreen() {
  const { code, participant_id, role, display_name, wsUrl } = useLocalSearchParams();
  const { colors: theme } = useTheme();

  const isDark = theme.background === '#000000' || theme.text === '#FFFFFF';
  const borderColor = isDark ? 'transparent' : '#E5E5E5';
  const inputBackgroundColor = isDark ? '#1c1c1e' : '#F2F2F7';

  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [messages, setMessages] = useState<any[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [text, setText] = useState("");
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [translatedText, setTranslatedText] = useState(""); 
  const chatInputRef = useRef<TextInput>(null);
  const isOwner = Boolean(roomInfo && userInfo && String(roomInfo.owner_id) === String(userInfo.id));

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    async function loadRoomInfo() {
      try {
        const res = await privateApi.get(`/rooms/${code}/room`);
        setRoomInfo(res.data);
      } catch (err) { }
    }
    loadRoomInfo();
  }, [code]);

  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        const raw = await AsyncStorage.getItem("user_info");
        if (raw) {
          const parsed = JSON.parse(raw);
          setUserInfo(parsed);
        }
      } catch (err) { }
    };
    loadUserInfo();
  }, []);

  const SCREEN_WIDTH = Dimensions.get("window").width;
  const isWeb = Platform.OS === 'web';

  const getVideoWidth = () => {
    if (isWeb) {
      if (SCREEN_WIDTH < 768) {
        return SCREEN_WIDTH * 0.45;
      } else {
        return Math.min(SCREEN_WIDTH * 0.25, 250);
      }
    }
    if (SCREEN_WIDTH < 600) {
      return SCREEN_WIDTH * 0.55;
    } else {
      return SCREEN_WIDTH * 0.4;
    }
  };

  const VIDEO_WIDTH = getVideoWidth();
  const VIDEO_HEIGHT = VIDEO_WIDTH * (16 / 9);

  useEffect(() => {
    async function loadParticipants() {
      try {
        const res = await privateApi.get(`/rooms/${code}/participants`);
        const map: Record<string, Participant> = {};
        (res.data as Participant[]).forEach((p) => {
          map[String(p.participant_id)] = p;
        });
        setParticipants(map);
      } catch (err) { }
    }
    loadParticipants();
  }, [code]);

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

      if (!token) return;
      if (socket && socket.readyState === WebSocket.OPEN) return;

      socket = new WebSocket(wsUrl as string, ["jwt", token]);
      setWs(socket);

      socket.onopen = () => {
        if (!participant_id) return;
        setParticipants((prev) => ({
          ...prev,
          [String(participant_id)]: {
            participant_id: Number(participant_id),
            display_name: String(display_name),
            role: String(role),
            user_id: null, 
            joined_at: new Date().toISOString()
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

        if (msg.type === "room.ended") {
          alert("Chủ phòng đã kết thúc phiên.");
          try { socket?.close(); } catch (e) { }
          router.replace("/conversation");
          return;
        }
      };
    };

    connect();

    return () => {
      if (socket) socket.close();
    };
  }, [wsUrl, participant_id, display_name, role]);

  const sendMessage = () => {
    if (!ws || ws.readyState !== 1) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    const msg = {
      type: "chat.message",
      text: trimmed,
      no_echo: true,
    };

    ws.send(JSON.stringify(msg));
    setText("");
  };

  const handleLeaveRoom = async () => {
    try {
      await privateApi.post(`/rooms/${code}/leave`);
    } catch (err) { }
    ws?.close();
    router.replace("/conversation");
  };

  const handleEndRoom = async () => {
    try {
      await privateApi.post(`/rooms/${code}/end`);
    } catch (err) { }
    ws?.close();
    router.replace("/conversation");
  };

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };
   const closeCamera = () => {
      setShowCamera(false);
      setTranslatedText("");
  };

  
  const handleWordResult = (newWord: string) => {
  const w = (newWord || "").trim();
  if (!w) return;

  // 1) cập nhật translatedText (nếu bạn còn muốn show)
  setTranslatedText(prev => {
    const words = prev.trim().split(" ").filter(Boolean);
    const last = words[words.length - 1]?.toLowerCase();
    if (last === w.toLowerCase()) return prev;
    return prev ? `${prev} ${w}` : w;
  });

  // 2) Fill vào input chat (text)
  setText(prev => {
    const prevTrim = (prev || "").trim();
    if (!prevTrim) return w; // nếu input trống thì set luôn
    // nếu muốn: thêm vào cuối, có khoảng trắng
    // tránh duplicate cuối câu
    const parts = prevTrim.split(" ").filter(Boolean);
    const last = parts[parts.length - 1]?.toLowerCase();
    if (last === w.toLowerCase()) return prevTrim;
    return `${prevTrim} ${w}`;
  });

  // 3) Đóng camera ngay khi nhận được word
  setShowCamera(false);
  setTranslatedText(""); // optional nếu bạn muốn reset

  // 4) Focus lại input sau khi modal đóng
  requestAnimationFrame(() => {
    chatInputRef.current?.focus();
  });
};


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        
        <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: borderColor }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.text} />
          </TouchableOpacity>
          
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>
              {code}
            </Text>
            <TouchableOpacity onPress={() => setShowParticipantsModal(true)} style={styles.subtitleBtn}>
              <Text numberOfLines={1}>
                <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
                    {Object.keys(participants).length} thành viên •{" "}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.primary, fontWeight: '600' }]}>
                    Chạm để xem
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={[styles.headerBtn, { backgroundColor: theme.primary }]} 
              onPress={() => setShowQRModal(true)}
            >
              <Text style={styles.headerBtnText}>Mã QR</Text>
            </TouchableOpacity>

                         <TouchableOpacity 
               style={[styles.headerBtn, { backgroundColor: theme.icon || '#999' }]}
               onPress={handleLeaveRoom}
             >
               <Text style={styles.headerBtnText}>Rời phòng</Text>
             </TouchableOpacity>
            
          </View>
        </View>

        <FlatList
          ref={flatListRef}
          style={[styles.chatList, { backgroundColor: theme.controlBG || '#f4f4f5' }]}
          contentContainerStyle={{ paddingVertical: 16 }}
          data={messages}
          showsVerticalScrollIndicator={false}
          keyExtractor={(_, i) => i.toString()}
          
          renderItem={({ item }) => {
            const sender = item.sender || {};
            const isMe = String(sender.participant_id) === String(participant_id);

            return (
              <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
                {!isMe && (
                  <View style={[styles.avatar, { backgroundColor: '#ccc' }]}>
                    <Text style={styles.avatarText}>{getInitials(sender.display_name)}</Text>
                  </View>
                )}

                <View style={[
                  styles.bubble,
                  isMe ? { backgroundColor: theme.primary } : { backgroundColor: theme.background },
                  isMe ? styles.bubbleRight : styles.bubbleLeft
                ]}>
                  {!isMe && (
                    <Text style={[styles.senderName, { color: theme.icon }]}>
                      {sender.display_name}
                    </Text>
                  )}

                  <Text style={[styles.messageText, { color: isMe ? 'white' : theme.text }]}>
                    {item.text}
                  </Text>

                  {Array.isArray(item.videos) && item.videos.length > 0 && (
                    <View style={styles.videoGrid}>
                      {item.videos.map((v: any, idx: number) => (
                        <View key={`${v.sign_id}-${idx}`} style={styles.videoWrapper}>
                          <SignVideo
                            url={v.mp4_url}
                            width={VIDEO_WIDTH}
                            height={VIDEO_HEIGHT}
                            //style={{ borderRadius: 8 }}
                          />
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={[styles.timestamp, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.icon }]}>
                    {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[
          styles.inputContainer,
          {
            backgroundColor: theme.background,
            borderTopColor: 'transparent' 
          }
        ]}>

          <TouchableOpacity onPress={() => setShowCamera(true)} style={styles.iconBtnOutside}>
            <Ionicons name="camera" size={22} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtnOutside}>
            <Ionicons name="mic" size={22} color={theme.primary} />
          </TouchableOpacity>

          <View style={[
            styles.inputWrapper,
            {
              backgroundColor: inputBackgroundColor,
              borderColor: 'transparent'
            }
          ]}>
            <TextInput
  ref={chatInputRef}
  style={[styles.input, { color: theme.text }]}
  placeholder="Nhập tin nhắn..."
  placeholderTextColor={theme.icon}
  value={text}
  onChangeText={setText}
  multiline
/>

          </View>

          <TouchableOpacity 
            style={[
              styles.sendButton,
              {
                backgroundColor: text.trim() ? theme.primary : inputBackgroundColor,
                shadowColor: text.trim() ? theme.primary : 'transparent',
                elevation: text.trim() ? 5 : 0
              }
            ]} 
            onPress={sendMessage}
            disabled={!text.trim()}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={text.trim() ? "white" : theme.icon} 
              style={{ marginLeft: text.trim() ? 2 : 0 }}
            />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <SignLanguageCamera
          //theme={theme}
        />
        <TouchableOpacity 
                        onPress={closeCamera} 
                        style={styles.closeBtn}
                        hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                    >
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                          <WordMode onResult={handleWordResult} theme={theme} />
      

      </Modal>

      <Modal visible={showQRModal} transparent animationType="fade" onRequestClose={() => setShowQRModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Mã QR Phòng</Text>
            
            <View style={styles.qrWrapper}>
              <QRCode value={`${API_URL}/join/${code}`} size={180} />
            </View>

            <View style={styles.codeContainer}>
               <Text style={[styles.codeLabel, { color: theme.icon }]}>Mã tham gia:</Text>
               <Text style={[styles.codeValue, { color: theme.primary }]}>{code}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.modalCloseButton, { backgroundColor: theme.lightGray || '#eee' }]}
              onPress={() => setShowQRModal(false)}
            >
              <Text style={[styles.modalCloseText, { color: theme.text }]}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showParticipantsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowParticipantsModal(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>Thành viên ({Object.keys(participants).length})</Text>
                <TouchableOpacity onPress={() => setShowParticipantsModal(false)} style={styles.closeModalIcon}>
                     <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
            </View>
            
            <FlatList
                data={Object.values(participants)}
                keyExtractor={(item) => String(item.participant_id)}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => {
                    const isMe = String(item.participant_id) === String(participant_id);
                    
                    
                    return (
                        <View style={[styles.participantRow, { borderBottomColor: borderColor }]}>
                            <View style={[styles.avatarLarge, { backgroundColor: isMe ? theme.primary : '#ccc' }]}>
                                <Text style={styles.avatarTextLarge}>{getInitials(item.display_name)}</Text>
                            </View>
                            <View style={styles.participantInfo}>
                                <Text style={[styles.participantName, { color: theme.text }]}>
                                    {item.display_name} {isMe && "(Bạn)"}
                                </Text>
                                <Text style={[styles.participantRole, { color: theme.icon }]}>
                                    {isOwner ? "Chủ phòng" : "Thành viên"}
                                </Text>
                            </View>
                            {isOwner && <Ionicons name="key" size={16} color="#F59E0B" />}
                        </View>
                    );
                }}
            />
            <View style={styles.modalFooter}>
             {isOwner && (
  <TouchableOpacity 
    style={[styles.endedBtn, { backgroundColor: '#EF4444' }]} 
    onPress={handleEndRoom}
  >
    <Text style={[styles.headerBtnText]}>Kết thúc</Text>
  </TouchableOpacity>
)}
</View>
        </SafeAreaView>
        
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitleBtn: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  headerSubtitle: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  chatList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
    paddingBottom: 110,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    position: 'relative',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  videoGrid: {
    marginTop: 8,
    gap: 8,
  },
  videoWrapper: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  iconBtnOutside: {
    padding: 6,
    marginRight: 2,
  },
  inputWrapper: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    marginRight: 8,
    marginLeft: 4,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    paddingTop: 8,
    paddingBottom: 8,
    height: '100%',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    elevation: 3,
    marginBottom: 20,
  },
  codeContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  codeLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  codeValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalCloseButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeModalIcon: {
    padding: 4,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarTextLarge: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
  },
  participantRole: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
      position: 'absolute',
      top: 50, 
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100, 
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)'
  },
    modalFooter:{
    alignItems:'flex-end',
  },
  endedBtn:{
    paddingHorizontal: 14,
    paddingVertical: 9,
    
    borderRadius: 15,
    margin:14,
    marginBottom:34,
    justifyContent: 'center',
    alignItems: 'center',
  },
});