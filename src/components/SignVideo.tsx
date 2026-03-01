// SignVideo.tsx
import React from "react";
import { View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

type SignVideoProps = {
  url: string;
  width: number;
  height: number;
};

export function SignVideo({ url, width, height }: SignVideoProps) {
  const player = useVideoPlayer(url, (player) => {
    // cấu hình ban đầu
    player.loop = true;   // lặp lại
    // mặc định: không auto play, user tự bấm
  });

  return (
    <View>
      <VideoView
        style={{
          width,
          height,
          backgroundColor: "#000",
        }}
        player={player}          // 🔴 API ĐÚNG: dùng player, không dùng source/video
        contentFit="contain"     // tương đương resizeMode="contain"
        nativeControls           // = {true}
      />
    </View>
  );
}
