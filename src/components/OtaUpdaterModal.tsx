import { checkAndRunOTA } from "app/utils/OTAHotUpdate";
import React, { useEffect, useState } from "react";
import { Modal, View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";

const OtaUpdaterModal = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<"checking" | "downloading" | "success" | "fail" | "none">("none");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setIsVisible(true);
    
    checkAndRunOTA({
      onChecking: () => {
        setStatus("checking");
        setMessage("Đang kiểm tra cập nhật...");
      },
      onDownloading: (version) => {
        setStatus("downloading");
        setMessage(`Đang tải phiên bản mới (${version})...\nVui lòng không tắt ứng dụng.`);
      },
      onSuccess: () => {
        setStatus("success");
        setMessage("Cập nhật thành công! Đang khởi động lại...");
        setTimeout(() => setIsVisible(false), 2000); // Ẩn modal trước khi app tự restart
      },
      onFail: (error) => {
        setStatus("fail");
        setMessage(`Cập nhật thất bại:\n${error}`);
      },
      onUpToDate: () => {
        setIsVisible(false);
      },
    });
  }, []);

  if (!isVisible) return null;

  return (
    <Modal transparent animationType="fade" visible={isVisible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {(status === "checking" || status === "downloading") && (
            <ActivityIndicator size="large" color="#007AFF" style={styles.spinner} />
          )}
          
          {status === "success" && <Text style={styles.iconSuccess}>✅</Text>}
          {status === "fail" && <Text style={styles.iconFail}>❌</Text>}

          <Text style={styles.messageText}>{message}</Text>

          {status === "fail" && (
            <TouchableOpacity style={styles.button} onPress={() => setIsVisible(false)}>
              <Text style={styles.buttonText}>Đóng</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Nền tối mờ
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  spinner: {
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },
  iconSuccess: {
    fontSize: 32,
    marginBottom: 12,
  },
  iconFail: {
    fontSize: 32,
    marginBottom: 12,
  },
  button: {
    marginTop: 20,
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default OtaUpdaterModal;