import { REPORT_COMMENT_MAX } from '@bright-trail/shared';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { KidButton, KidIconButton, useKidType } from '../design/kid';
import { Text, useDyslexicFont } from '../design/Text';
import { color, dyslexicFont, font, radius, shadow } from '../design/tokens';
import { useLayout } from '../learning/theme';
import { SpeakerButton, useAutoNarration } from '../narration';

const TITLE = 'What looks wrong?';
const LEDE = 'You can tell us in your own words, or just tap Send.';

/**
 * The sheet a flag opens: one optional comment and Send. Closing it drops the report.
 * Mount it only while it shows, so each flag starts with an empty box.
 */
export function ReportSheet({
  onSend,
  onClose,
}: {
  onSend: (comment: string) => void;
  onClose: () => void;
}) {
  const { scale: s } = useLayout();
  const type = useKidType();
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const dyslexic = useDyslexicFont();
  useAutoNarration([TITLE, LEDE]);

  const send = () => {
    if (sending) return;
    setSending(true);
    onSend(comment);
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View accessibilityViewIsModal style={[styles.sheet, { maxWidth: 640 * s }]}>
          {/* Scrolls when the keyboard leaves too little room, so Send stays reachable. */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ padding: 20 * s, gap: 14 * s }}
          >
            <View style={styles.top}>
              <SpeakerButton text={[TITLE, LEDE]} />
              <Text accessibilityRole="header" style={[type.prompt, styles.title]}>
                {TITLE}
              </Text>
              <KidIconButton icon="close" label="Close" variant="quiet" onPress={onClose} />
            </View>
            <Text style={type.lede}>{LEDE}</Text>
            <TextInput
              accessibilityLabel="What looks wrong"
              testID="report-comment"
              value={comment}
              onChangeText={setComment}
              maxLength={REPORT_COMMENT_MAX}
              multiline
              placeholder="The picture doesn't match the question"
              placeholderTextColor={color.kidInkSoft}
              style={[
                styles.input,
                dyslexic && dyslexicFont({ ...styles.input, fontSize: 20 * s }),
                { minHeight: 110 * s, fontSize: 20 * s, padding: 14 * s, borderRadius: radius.md },
              ]}
            />
            <View style={styles.bottom}>
              <KidButton icon="check" label="Send" showLabel onPress={send} disabled={sending} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: color.kidScrim,
  },
  sheet: {
    width: '100%',
    flexShrink: 1,
    backgroundColor: color.kidBg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    ...shadow.lift,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, textAlign: 'left' },
  input: {
    ...font.body(),
    color: color.kidInk,
    backgroundColor: color.kidSurfaceRaised,
    borderWidth: 2,
    borderColor: color.kidLine,
    textAlignVertical: 'top',
  },
  bottom: { flexDirection: 'row', justifyContent: 'flex-end' },
});
