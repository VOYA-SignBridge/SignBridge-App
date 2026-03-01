import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

interface QRScannerProps {
  onScanned: (data: string | null) => void;
}

export default function QRScanner({ onScanned }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // 🔥 Thêm flag processing

  // Tự động request permission khi mount
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission]);

  // Đang load permission
  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Đang kiểm tra quyền camera...</Text>
      </View>
    );
  }

  // Chưa có quyền
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Cần quyền truy cập camera để quét QR</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Cấp quyền</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.cancelButton]} 
          onPress={() => onScanned(null)}
        >
          <Text style={styles.buttonText}>Hủy</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Có quyền rồi → hiển thị camera
  const handleScan = ({ data }: { data: string }) => {
  if (scanned || isProcessing) {
    console.log("Already scanned/processing, ignoring...");
    return;
  }

  console.log("QR scanned, calling onScanned callback");
  setScanned(true);
  setIsProcessing(true);
  onScanned(data);
};

  return (
    <View style={{ flex: 1 }}>
       {!isProcessing && (
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned || isProcessing ? undefined : handleScan}
        // ⬆ khi scanned=true hoặc isProcessing=true, CameraView sẽ KHÔNG nhận scan nữa
      />
    )}
      
      {/* Hiển thị khi đã scan */}
      {isProcessing && (
        <View style={styles.scannedOverlay}>
          <Text style={styles.scannedText}>✓ Đã quét thành công!</Text>
          <Text style={styles.scannedText}>Đang tham gia phòng...</Text>
        </View>
      )}

      {/* Overlay hướng dẫn */}
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.instructionText}>
          Đưa mã QR vào khung hình
        </Text>
      </View>

      {/* Nút đóng */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => onScanned(null)}
      >
        <Text style={styles.closeButtonText}>✕ Đóng</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  button: {
    padding: 15,
    backgroundColor: "#25CCC5",
    borderRadius: 8,
    marginTop: 10,
    minWidth: 200,
  },
  cancelButton: {
    backgroundColor: "#666",
  },
  buttonText: {
    textAlign: "center",
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  scanFrame: {
    width: 250,
    height: 250,
    borderWidth: 3,
    borderColor: "#25CCC5",
    borderRadius: 20,
    backgroundColor: "transparent",
  },
  instructionText: {
    marginTop: 20,
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  scannedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(37, 204, 197, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannedText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
    marginVertical: 5,
  },
});