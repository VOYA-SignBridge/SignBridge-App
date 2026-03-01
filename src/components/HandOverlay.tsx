// // app/components/HandOverlay.tsx
// import React from 'react';
// import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';

// export type HandStatus = 'none' | 'bad' | 'ok';

// type Props = {
//   handStatus: HandStatus;
//   statusMsg: string;
//   isRecording: boolean;
//   currentFrames: number;
//   totalFrames: number;
// };

// const HandOverlay: React.FC<Props> = ({
//   handStatus,
//   statusMsg,
//   isRecording,
//   currentFrames,
//   totalFrames,
// }) => {
//   const { width, height } = useWindowDimensions();
//   const isLandscape = width > height;

//   // luôn dùng cạnh ngắn để làm chuẩn (đảm bảo box to nhưng không tràn)
//   const shortEdge = Math.min(width, height);
//   const longEdge = Math.max(width, height);

//   // safe box rất to
//   const boxWidth = shortEdge * 0.9;              // 90% cạnh ngắn
//   const boxHeight = (isLandscape ? shortEdge : longEdge) * 0.6;

//   return (
//     <View style={StyleSheet.absoluteFill} pointerEvents="none">
//       <View style={styles.root}>
//         {/* SAFE BOX */}
//         <View
//           style={[
//             styles.safeBox,
//             {
//               width: boxWidth,
//               height: boxHeight,
//             },
//             handStatus === 'ok'
//               ? { borderColor: '#4CAF50' }
//               : handStatus === 'bad'
//               ? { borderColor: '#FF5252' }
//               : { borderColor: 'rgba(255,255,255,0.5)' },
//           ]}
//         >
//           <Text style={styles.safeBoxText}>
//             {handStatus === 'ok'
//               ? 'Giữ tay trong khung'
//               : 'Đưa tay vào khung này'}
//           </Text>
//         </View>

//         {/* STATUS BUBBLE */}
//         <View style={styles.statusBubble}>
//           <Text style={styles.statusText}>{statusMsg}</Text>
//         </View>

//         {/* BUFFER BAR */}
//         {isRecording && (
//           <View style={styles.bufferIndicator}>
//             <View style={styles.bufferBar}>
//               <View
//                 style={[
//                   styles.bufferFill,
//                   { width: `${(currentFrames / totalFrames) * 100}%` },
//                 ]}
//               />
//             </View>
//             <Text style={styles.bufferText}>
//               {currentFrames}/{totalFrames} frames
//             </Text>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   root: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   safeBox: {
//     borderWidth: 4,
//     borderRadius: 24,
//     borderStyle: 'dashed',
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: 'rgba(0,0,0,0.08)',
//   },
//   safeBoxText: {
//     color: 'white',
//     fontSize: 16,
//     textAlign: 'center',
//     paddingHorizontal: 12,
//     textShadowColor: 'rgba(0,0,0,0.7)',
//     textShadowOffset: { width: 0, height: 1 },
//     textShadowRadius: 2,
//   },
//   statusBubble: {
//     position: 'absolute',
//     bottom: 130,
//     left: 40,
//     right: 40,
//     paddingVertical: 8,
//     paddingHorizontal: 12,
//     borderRadius: 20,
//     backgroundColor: 'rgba(0,0,0,0.7)',
//   },
//   statusText: {
//     color: 'white',
//     fontSize: 13,
//     textAlign: 'center',
//   },
//   bufferIndicator: {
//     position: 'absolute',
//     top: 80,
//     left: 40,
//     right: 40,
//     backgroundColor: 'rgba(0,0,0,0.55)',
//     padding: 10,
//     borderRadius: 10,
//   },
//   bufferBar: {
//     height: 5,
//     backgroundColor: 'rgba(255,255,255,0.25)',
//     borderRadius: 3,
//     overflow: 'hidden',
//   },
//   bufferFill: {
//     height: '100%',
//     backgroundColor: '#4dabf7',
//   },
//   bufferText: {
//     color: 'white',
//     fontSize: 12,
//     marginTop: 5,
//     textAlign: 'center',
//   },
// });

// export default HandOverlay;
