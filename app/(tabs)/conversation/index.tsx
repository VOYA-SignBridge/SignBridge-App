import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { privateApi } from "@/api/privateApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/config";

export default function ConversationScreen() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const ttl_minutes = 120;
  // Kiểu cho /rooms/create
type CreateRoomResponse = {
  code: string;
};

// Kiểu participant server trả về
type Participant = {
  id: string;
  role: string;
  display_name: string;
};

// Kiểu cho /rooms/{code}/join
type JoinRoomResponse = {
  participant: Participant;
};

  // ---- CREATE ROOM ----
  const handleCreateRoom = async () => {
  try {
    const res = await privateApi.post<CreateRoomResponse>("/rooms/create", null, {
      params: { ttl_minutes },
    });

    console.log("Create room response", res.data);

    handleJoinRoom(res.data.code);
  } catch (err) {
    console.log("Create room error:", err);
  }
};


  // ---- JOIN ROOM ----
  const handleJoinRoom = async (overrideCode?: string) => {
  const code = overrideCode || roomCode;
  if (!code.trim()) return;

  try {
    const res = await privateApi.post<JoinRoomResponse>(`/rooms/${code}/join?role=normal`);

    console.log("Join room response:", res.data);
    const participant = res.data.participant;
    console.log("Participant info:", participant);

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
  }
};


  return (
    
    <View style={{ padding: 20 ,  marginTop:50}}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>
        Conversation
      </Text>

      <TouchableOpacity
        onPress={handleCreateRoom}
        style={{
          padding: 15,
          backgroundColor: "#25CCC5",
          marginTop: 20,
          borderRadius: 8,
        }}
      >
        <Text style={{ textAlign: "center", color: "white", fontWeight: "700" }}>
          Create Room
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Enter room code"
        value={roomCode}
        onChangeText={setRoomCode}
        style={{
          borderWidth: 1,
          padding: 10,
          marginTop: 20,
          borderRadius: 8,
        }}
      />

      <TouchableOpacity
        onPress={() => handleJoinRoom()}
        style={{
          padding: 15,
          backgroundColor: "#25CCC5",
          marginTop: 20,
          borderRadius: 8,
        }}
      >
        <Text style={{ textAlign: "center", color: "white", fontWeight: "700" }}>
          Join Room
        </Text>
      </TouchableOpacity>
    </View>
  );
  
}

