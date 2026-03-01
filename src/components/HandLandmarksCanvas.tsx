// import React, { useEffect, useRef } from 'react';
// import { Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
// import { StyleSheet } from 'react-native';

// type LandmarkPoint = {
//   x: number;
//   y: number;
//   z?: number;
// };

// type Props = {
//   landmarks: LandmarkPoint[][];
//   width: number;
//   height: number;
// };

// const HAND_CONNECTIONS = [
//   [0, 1], [1, 2], [2, 3], [3, 4],        // Ngón cái
//   [0, 5], [5, 6], [6, 7], [7, 8],        // Ngón trỏ
//   [0, 9], [9, 10], [10, 11], [11, 12],   // Ngón giữa
//   [0, 13], [13, 14], [14, 15], [15, 16], // Ngón áp út
//   [0, 17], [17, 18], [18, 19], [19, 20], // Ngón út
//   [5, 9], [9, 13], [13, 17]              // Lòng bàn tay
// ];

// const HandLandmarksCanvas: React.FC<Props> = ({ landmarks, width, height }) => {
//   return (
//     <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
//       {landmarks.map((hand, handIndex) => {
//         // Vẽ các đường nối
//         HAND_CONNECTIONS.forEach(([start, end], connIdx) => {
//           if (hand[start] && hand[end]) {
//             const startPoint = vec(
//               hand[start].x * width,
//               hand[start].y * height
//             );
//             const endPoint = vec(
//               hand[end].x * width,
//               hand[end].y * height
//             );

//             return (
//               <Line
//                 key={`line-${handIndex}-${connIdx}`}
//                 p1={startPoint}
//                 p2={endPoint}
//                 color="#00FF00"
//                 style="stroke"
//                 strokeWidth={2}
//               />
//             );
//           }
//         });

//         // Vẽ các điểm landmarks
//         return hand.map((point, idx) => {
//           const cx = point.x * width;
//           const cy = point.y * height;

//           let color = '#FF0000'; // Đỏ cho các điểm thông thường
//           if (idx === 0) color = '#0000FF'; // Xanh dương cho cổ tay
//           if ([4, 8, 12, 16, 20].includes(idx)) color = '#00FF00'; // Xanh lá cho đầu ngón

//           return (
//             <Circle
//               key={`point-${handIndex}-${idx}`}
//               cx={cx}
//               cy={cy}
//               r={idx === 0 ? 8 : 5} // Cổ tay to hơn
//               color={color}
//             />
//           );
//         });
//       })}
//     </Canvas>
//   );
// };

// const styles = StyleSheet.create({
//   canvas: {
//     position: 'absolute',
//     top: 0,
//     left: 0,
//   },
// });

// export default HandLandmarksCanvas;
import React, { useMemo } from 'react';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
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

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Ngón cái
  [0, 5], [5, 6], [6, 7], [7, 8],        // Ngón trỏ
  [0, 9], [9, 10], [10, 11], [11, 12],   // Ngón giữa
  [0, 13], [13, 14], [14, 15], [15, 16], // Ngón áp út
  [0, 17], [17, 18], [18, 19], [19, 20], // Ngón út
  [5, 9], [9, 13], [13, 17]              // Lòng bàn tay
];

// Màu sắc tối giản để tăng performance
const CONNECTION_COLOR = '#6366F1';
const WRIST_COLOR = '#8B5CF6';
const FINGERTIP_COLOR = '#10B981';
const JOINT_COLOR = '#F59E0B';

// Set để check fingertip nhanh hơn array.includes()
const FINGERTIP_INDICES = new Set([4, 8, 12, 16, 20]);

const HandLandmarksCanvas: React.FC<Props> = ({ landmarks, width, height }) => {
  // Tối ưu cực đại: Tính toán tất cả một lần, không có nested loops phức tạp
  const renderData = useMemo(() => {
    const paths: any[] = [];
    const circles: Array<{
      cx: number;
      cy: number;
      r: number;
      color: string;
      key: string;
    }> = [];

    landmarks.forEach((hand, handIndex) => {
      // Tạo path cho đường nối
      const path = Skia.Path.Make();
      
      HAND_CONNECTIONS.forEach(([start, end]) => {
        if (hand[start] && hand[end]) {
          path.moveTo(hand[start].x * width, hand[start].y * height);
          path.lineTo(hand[end].x * width, hand[end].y * height);
        }
      });
      
      paths.push({ path, key: `path-${handIndex}` });

      // Tạo circles cho các điểm
      hand.forEach((point, idx) => {
        const cx = point.x * width;
        const cy = point.y * height;
        
        let color: string;
        let radius: number;
        
        if (idx === 0) {
          color = WRIST_COLOR;
          radius = 7;
        } else if (FINGERTIP_INDICES.has(idx)) {
          color = FINGERTIP_COLOR;
          radius = 5;
        } else {
          color = JOINT_COLOR;
          radius = 3.5;
        }

        // Viền trắng
        circles.push({
          cx,
          cy,
          r: radius + 1,
          color: 'white',
          key: `border-${handIndex}-${idx}`,
        });

        // Điểm chính
        circles.push({
          cx,
          cy,
          r: radius,
          color,
          key: `point-${handIndex}-${idx}`,
        });
      });
    });

    return { paths, circles };
  }, [landmarks, width, height]);

  return (
    <Canvas style={[styles.canvas, { width, height }]} pointerEvents="none">
      {/* Vẽ tất cả paths */}
      {renderData.paths.map(({ path, key }) => (
        <Path
          key={key}
          path={path}
          color={CONNECTION_COLOR}
          style="stroke"
          strokeWidth={2.5}
          strokeCap="round"
          strokeJoin="round"
        />
      ))}

      {/* Vẽ tất cả circles */}
      {renderData.circles.map(({ cx, cy, r, color, key }) => (
        <Circle key={key} cx={cx} cy={cy} r={r} color={color} />
      ))}
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

// CRITICAL: So sánh shallow để tránh re-render không cần thiết
export default React.memo(
  HandLandmarksCanvas,
  (prevProps, nextProps) => {
    // Chỉ re-render nếu có thay đổi thực sự
    if (
      prevProps.width !== nextProps.width ||
      prevProps.height !== nextProps.height ||
      prevProps.landmarks.length !== nextProps.landmarks.length
    ) {
      return false;
    }

    // Check shallow equality cho landmarks
    for (let i = 0; i < prevProps.landmarks.length; i++) {
      if (prevProps.landmarks[i] !== nextProps.landmarks[i]) {
        return false;
      }
    }

    return true;
  }
);