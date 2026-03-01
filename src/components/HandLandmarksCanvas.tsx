// app/components/HandLandmarksCanvas.tsx
import React, { useEffect, useRef } from 'react';
import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

type LandmarkPoint = {
  x: number;
  y: number;
  z?: number;
};

type Props = {
  landmarks: LandmarkPoint[][];
  width: number;
  height: number;
};

// Các kết nối giữa các điểm tạo thành bàn tay
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Ngón cái
  [0, 5], [5, 6], [6, 7], [7, 8],        // Ngón trỏ
  [0, 9], [9, 10], [10, 11], [11, 12],   // Ngón giữa
  [0, 13], [13, 14], [14, 15], [15, 16], // Ngón áp út
  [0, 17], [17, 18], [18, 19], [19, 20], // Ngón út
  [5, 9], [9, 13], [13, 17]              // Lòng bàn tay
];

const HandLandmarksCanvas: React.FC<Props> = ({ landmarks, width, height }) => {
  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      {landmarks.map((hand, handIndex) => {
        // Vẽ các đường nối
        HAND_CONNECTIONS.forEach(([start, end], connIdx) => {
          if (hand[start] && hand[end]) {
            const startPoint = vec(
              hand[start].x * width,
              hand[start].y * height
            );
            const endPoint = vec(
              hand[end].x * width,
              hand[end].y * height
            );

            return (
              <Line
                key={`line-${handIndex}-${connIdx}`}
                p1={startPoint}
                p2={endPoint}
                color="#00FF00"
                style="stroke"
                strokeWidth={2}
              />
            );
          }
        });

        // Vẽ các điểm landmarks
        return hand.map((point, idx) => {
          const cx = point.x * width;
          const cy = point.y * height;

          // Màu sắc khác nhau cho các loại điểm
          let color = '#FF0000'; // Đỏ cho các điểm thông thường
          if (idx === 0) color = '#0000FF'; // Xanh dương cho cổ tay
          if ([4, 8, 12, 16, 20].includes(idx)) color = '#00FF00'; // Xanh lá cho đầu ngón

          return (
            <Circle
              key={`point-${handIndex}-${idx}`}
              cx={cx}
              cy={cy}
              r={idx === 0 ? 8 : 5} // Cổ tay to hơn
              color={color}
            />
          );
        });
      })}
    </Canvas>
  );
};

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default HandLandmarksCanvas;