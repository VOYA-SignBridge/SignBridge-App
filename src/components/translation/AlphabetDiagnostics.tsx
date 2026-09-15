import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import type { AlphabetCapture } from '@/utils/alphabetCamera';

type Clip = AlphabetCapture & { expectedLabel: string };
const LABELS = new Set('A Â Ă B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y Z'.split(' '));

export default function AlphabetDiagnostics({ snapshot }: { snapshot: () => AlphabetCapture | null }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('A');
  const [message, setMessage] = useState('');
  const [count, setCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const clips = useRef<Clip[]>([]);

  const record = () => {
    const expectedLabel = label.trim().toLocaleUpperCase('vi-VN');
    if (!LABELS.has(expectedLabel)) { setMessage('Nhập một ký tự trong bảng chữ cái.'); return; }
    const value = snapshot();
    if (!value) { setMessage('Đưa tay vào khung, giữ ký hiệu 3 giây rồi bấm Ghi mẫu.'); return; }
    if (clips.current.length >= 30) { setMessage('Đã đủ 30 mẫu. Lưu file trước khi ghi tiếp.'); return; }
    clips.current.push({ ...value, expectedLabel });
    setCount(clips.current.length);
    setMessage(`Đã ghi ${expectedLabel} → ${value.prediction.label} (${Math.round(value.prediction.confidence * 100)}%).`);
  };

  const save = async () => {
    if (saving || !clips.current.length) return;
    setSaving(true);
    try {
      const json = JSON.stringify({ schemaVersion: 1, clips: clips.current });
      const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) { setMessage('Chưa lưu; các mẫu vẫn còn trong phiên này.'); return; }
      const name = `alphabet-errors-${Date.now()}`;
      const uri = await StorageAccessFramework.createFileAsync(permission.directoryUri, name, 'application/json');
      await StorageAccessFramework.writeAsStringAsync(uri, json);
      clips.current = [];
      setCount(0);
      setMessage(`Đã lưu ${name}.json vào thư mục bạn chọn.`);
    } catch (error) {
      setMessage(`Không lưu được: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setSaving(false); }
  };

  return <View style={styles.panel}>
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
      <Text style={styles.link}>{open ? 'Đóng ghi mẫu lỗi' : 'Ghi mẫu nhận diện sai'}</Text>
    </Pressable>
    {open && <>
      <Text style={styles.text}>Nhập ký tự đúng, giữ ký hiệu 3 giây, rồi Ghi mẫu. Chỉ lưu tọa độ tay, không lưu ảnh/video.</Text>
      <View style={styles.row}>
        <TextInput accessibilityLabel="Ký tự đúng" value={label} onChangeText={setLabel} maxLength={3} autoCapitalize="characters" style={styles.input} />
        <Pressable onPress={record} disabled={saving} style={styles.button}><Text style={styles.text}>Ghi mẫu ({count}/30)</Text></Pressable>
        <Pressable onPress={save} disabled={saving || !count} style={[styles.button, (!count || saving) && styles.disabled]}><Text style={styles.text}>{saving ? 'Đang lưu…' : 'Lưu JSON'}</Text></Pressable>
      </View>
      <Text style={styles.text}>{message || 'Mẫu chưa lưu sẽ mất khi rời alphabet mode.'}</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  panel: { width: '94%', backgroundColor: '#172132', borderRadius: 12, padding: 10, marginTop: 8, gap: 8 },
  link: { color: '#7dd3fc', textAlign: 'center', fontWeight: '600' },
  text: { color: 'white', fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { width: 48, color: 'white', borderWidth: 1, borderColor: '#94a3b8', borderRadius: 6, padding: 6, textAlign: 'center' },
  button: { padding: 10, borderRadius: 6, backgroundColor: '#235b79' },
  disabled: { opacity: 0.4 },
});
