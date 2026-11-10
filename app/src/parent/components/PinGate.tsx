import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PinLock } from '../pin';
import { PinPad } from './PinPad';
import { BackLink, colors } from './ui';

type Step =
  | { kind: 'loading' }
  | { kind: 'create' }
  | { kind: 'confirm'; first: string }
  | { kind: 'enter' }
  | { kind: 'open' };

/**
 * Renders `children` only after the PIN is entered. On first use it asks for a new PIN twice.
 * Unlocking lasts until the gate unmounts, so leaving the parent area locks it again.
 */
export function PinGate({ lock, children }: { lock: PinLock; children: ReactNode }) {
  const [step, setStep] = useState<Step>({ kind: 'loading' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    lock.hasPin().then(
      (has) => setStep({ kind: has ? 'enter' : 'create' }),
      (e: Error) => setError(e.message),
    );
  }, [lock]);

  if (step.kind === 'open') return children;

  const submit = async (pin: string) => {
    setError(null);
    if (step.kind === 'create') return setStep({ kind: 'confirm', first: pin });
    if (step.kind === 'confirm') {
      if (pin !== step.first) {
        setError("Those PINs didn't match. Start again.");
        return setStep({ kind: 'create' });
      }
      await lock.setPin(pin);
      return setStep({ kind: 'open' });
    }
    if (await lock.verify(pin)) return setStep({ kind: 'open' });
    setError('Wrong PIN. Try again.');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <BackLink
          label="Kids’ home"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      </View>
      <View style={styles.body}>
        {step.kind === 'loading' ? (
          error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator size="large" color={colors.primary} />
          )
        ) : (
          <PinPad
            title={
              step.kind === 'create'
                ? 'Pick a parent PIN'
                : step.kind === 'confirm'
                  ? 'Confirm your PIN'
                  : 'Parent PIN'
            }
            message={
              step.kind === 'create'
                ? 'Pick 4 digits your kids don’t know.'
                : step.kind === 'confirm'
                  ? 'Enter the PIN again.'
                  : 'Grown-ups only past this point.'
            }
            error={error}
            onComplete={submit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 16, color: colors.danger, textAlign: 'center' },
});
