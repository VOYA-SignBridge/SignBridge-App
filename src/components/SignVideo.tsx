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
    player.loop = true;
    player.play();
  });

  return (
    <View>
      <VideoView
        style={{
          width,
          height,
          backgroundColor: "#000",
        }}
        player={player}
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}
